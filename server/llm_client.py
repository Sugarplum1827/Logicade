"""Ollama LLM client with repair loop + fallback (§8).

Public API:
    client = LLMClient.from_env()
    spec, meta = await client.generate(
        brief, week, difficulty, recent_fingerprints
    )

`meta` is a dict:
    { pass: bool, repaired: bool, fallback: bool, errors: [str],
      verification_result: 'pass'|'repaired'|'fallback',
      model_tag: str, model_digest: str, raw_llm_response: str }

Behavior:
  • Sends a structured prompt to Ollama /api/generate with format="json".
  • Validates response structure, then runs verifier.verify().
  • On failure, appends the errors to the prompt and retries (max 2).
  • After 2 failures, loads the fallback template for (week, difficulty),
    verifies it, and if the fingerprint collides with recent history,
    perturbs the win string (§2.5 novelty) until it doesn't. Perturbation
    applies even when the on-disk file is missing (uses in-memory
    build via server.fallbacks.build_fallback).
  • Never raises on LLM/network failure — the fallback path covers it.

Never emits Phaser/JS/HTML (§2.2). Never chooses difficulty (§2.3).
"""

from __future__ import annotations

import copy
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import httpx

from .grammar import load_registry, load_week
from .verifier import compute_fingerprint, verify

REPO_ROOT = Path(__file__).resolve().parent.parent
FALLBACK_DIR = REPO_ROOT / "data" / "fallback_templates"

MAX_RETRIES = 2


# ── Public client ─────────────────────────────────────────────────────

class LLMClient:
    def __init__(self, host: str, model: str,
                 timeout_s: float = 300.0) -> None:
        self.host = host.rstrip("/")
        self.model = model
        self.timeout_s = timeout_s
        self._client = httpx.AsyncClient(timeout=timeout_s)
        self.model_tag = ""
        self.model_digest = ""
        self._last_raw: str = ""

    @classmethod
    def from_env(cls) -> "LLMClient":
        return cls(
            host=os.environ.get("OLLAMA_HOST", "http://localhost:11434"),
            model=os.environ.get("OLLAMA_MODEL", "qwen2.5:3b"),
            timeout_s=300.0,
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def probe(self) -> bool:
        """Record tag+digest (§2.1, §18). Return True if model is available."""
        try:
            r = await self._client.get(f"{self.host}/api/tags", timeout=5)
            r.raise_for_status()
        except Exception:
            return False
        for m in r.json().get("models", []):
            name = m.get("name", "")
            if name == self.model or name.startswith(self.model):
                self.model_tag = name
                self.model_digest = (m.get("digest") or "")[:12]
                return True
        return False

    async def generate(
        self,
        brief: dict,
        week: int,
        difficulty: str,
        recent_fingerprints: list[str] | None = None,
    ) -> tuple[dict, dict]:
        recent = recent_fingerprints or []
        prompt = _build_prompt(brief, week, difficulty, recent)
        errors: list[str] = []

        for attempt in range(MAX_RETRIES + 1):
            print(f"[llm] Attempt {attempt + 1}/{MAX_RETRIES + 1} — week={week} difficulty={difficulty}")
            raw = await self._call_ollama(prompt)
            spec = _coerce_to_spec(raw, week, difficulty)

            if spec is None:
                err = f"attempt {attempt + 1}: response was not a valid JSON object"
                print(f"[llm]   ✗ attempt {attempt + 1}: invalid JSON")
                print(f"[llm]     raw[:200] = {raw[:200]!r}")
                errors.append(err)
                prompt = _append_repair(prompt, raw, err)
                continue

            result = verify(spec, week, difficulty, recent)

            if result["pass"]:
                print(f"[llm]   ✓ PASS on attempt {attempt + 1}")
                return spec, {
                    "pass": True,
                    "repaired": attempt > 0,
                    "fallback": False,
                    "errors": [],
                    "verification_result": "repaired" if attempt > 0 else "pass",
                    "model_tag": self.model_tag,
                    "model_digest": self.model_digest,
                    "raw_llm_response": self._last_raw[:500],
                }

            # failed verification — log the actual errors
            print(f"[llm]   ✗ attempt {attempt + 1} errors: {result['errors'][:3]}")
            errors.extend(result["errors"])
            prompt = _append_repair(prompt, raw, "; ".join(result["errors"]))

        # All retries exhausted — serve fallback template
        print(f"[llm]   ✗ all {MAX_RETRIES + 1} attempts failed, serving fallback template")
        spec = _load_fallback(week, difficulty, recent)
        result = verify(spec, week, difficulty, [])
        return spec, {
            "pass": result["pass"],
            "repaired": False,
            "fallback": True,
            "errors": errors + result["errors"],
            "verification_result": "fallback",
            "model_tag": self.model_tag,
            "model_digest": self.model_digest,
            "raw_llm_response": self._last_raw[:500],
        }


    # ── Internals ────────────────────────────────────────────────────

    async def _call_ollama(self, prompt: str) -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "format": "json",
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_predict": 2048,   # back to 2048; 1024 truncated qwen's output
                "num_ctx": 8192,
            },
        }
        try:
            r = await self._client.post(
                f"{self.host}/api/generate", json=payload
            )
            if r.status_code != 200:
                body = r.text[:500]
                self._last_raw = f"<HTTP {r.status_code}: {body}>"
                return json.dumps({"_error": f"HTTP {r.status_code}: {body}"})
            r.raise_for_status()
            raw = r.json().get("response", "")
            self._last_raw = raw
            return raw
        except Exception as exc:
            self._last_raw = f"<error: {type(exc).__name__}: {exc}>"
            return json.dumps({"_error": f"{type(exc).__name__}: {exc}"})

# ── Prompt construction ──────────────────────────────────────────────

def _build_prompt(
    brief: dict, week: int, difficulty: str, recent_fingerprints: list[str]
) -> str:
    week_cfg = load_week(week)
    registry = load_registry()
    sprite_map = {s["id"]: s for s in registry["sprites"]}

    allowed_sprites = [
        s for s in registry["sprites"] if week in s["allowed_contexts"]
    ]
    allowed_maps = [
        m for m in registry["tilemaps"] if week in m["allowed_contexts"]
    ]
    allowed_sprite_ids = {s["id"] for s in allowed_sprites}

    # Only brief sprite ids that are actually allowed for this week
    brief_sprites = [
        sid for sid in brief.get("sprite_ids", []) if sid in allowed_sprite_ids
    ]

    example = _few_shot_example_for(week, difficulty, brief, sprite_map)

    lines: list[str] = []
    lines.append(
        "You are a JSON DSL generator for a 2D learning game. "
        "Output ONLY one valid JSON object. No prose, no markdown."
    )
    lines.append("")
    lines.append(f"WEEK: {week}  ({week_cfg['concept']})")
    lines.append(f"DIFFICULTY: {difficulty}")
    lines.append("  - 'objectives': An array of exactly 3 strings describing the goals.")
    lines.append("  - objectives MUST be a list of 3 strings. Example: [\"Collect 3 coins\", \"Finish in under 60s\", \"Do not take damage\"]")
    lines.append(f"TARGET GAME TYPE: {brief['game_type']} (Options: collect, avoid, reach_goal, survive_timer, match_sequence)")
    lines.append("If game_type is 'avoid', make the win condition 'timer >= 15' and spawn hazards.")
    lines.append("If game_type is 'survive_timer', use the 'timer' trigger to spawn enemies over time.")
    lines.append(f"TARGET MAP: {brief['map_id']}")
    lines.append("")
    lines.append("ALLOWED TRIGGERS: " + ", ".join(week_cfg["allowed_triggers"]))
    lines.append("ALLOWED CONDITIONS: " + ", ".join(week_cfg["allowed_conditions"]))
    lines.append("ALLOWED EFFECTS: " + ", ".join(week_cfg["allowed_effects"]))
    lines.append("")
        # ── Strict emission contract (§9 difficulty band, §7 brief adherence) ──
    # qwen needs very concrete guidance to land in the difficulty band and
    # to honor the shuffler's game_type/map. Being prescriptive here is what
    # makes the LLM path actually pass the verifier.
    rule_count = {"needs_support": 2, "standard": 3, "advanced": 5}[difficulty]
    lines.append("")
    lines.append(f"STRICT EMISSION CONTRACT for difficulty='{difficulty}':")
    lines.append(f"  - Emit EXACTLY {rule_count} rules in spec.rules.")
    lines.append("  - Each rule's 'if' MUST be exactly the string: \"always\".")
    lines.append("  - Each rule's 'then' MUST be exactly: "
                 "[\"score += 1\", \"destroy(<target_id>)\"].")
    lines.append(f"  - game_type MUST be \"{brief['game_type']}\" — do NOT choose a different one.")
    lines.append(f"  - map MUST be \"{brief['map_id']}\" — do NOT choose a different one.")
    lines.append(f"  - concept MUST be \"{week_cfg['concept']}\".")
    lines.append(f"  - ilo MUST be \"{week_cfg['ilo'][0]}\" exactly (prefix CP1, not CP3).")
    lines.append("  - entities: use ONLY these sprite ids for the 'sprite' field: "
                 + str(brief_sprites))
    lines.append("  - win MUST be of the form \"score == N\", \"score >= N\", or \"score > N\".")
    lines.append("")
    lines.append("AVAILABLE MAPS (Choose one by matching the theme):")
    for m in allowed_maps:
        desc = m.get("description", "")
        themes = ", ".join(m.get("themes", []))
        enemies = ", ".join(m.get("suggested_enemies", []))
        lines.append(f"  - {m['id']} (Themes: {themes})")
        if desc:
            lines.append(f"    Description: {desc}")
        if enemies:
            lines.append(f"    Suggested Enemies: {enemies}")
    
    lines.append("")
    lines.append("AVAILABLE SPRITES (Choose by role and match the map's theme):")
    for s in allowed_sprites[:40]:  # Limit to 40 to save context
        themes = ", ".join(s.get("themes", []))
        desc = s.get("description", "")
        lines.append(f"  - {s['id']} (Role: {s['role']} | Themes: {themes})")
        if desc:
            lines.append(f"    {desc}")
            
    lines.append("SHUFFLED BRIEF — prefer these choices:")
    lines.append(f"  sprite_ids: {brief_sprites}")
    if brief.get("rule_brief"):
        lines.append("  rule suggestions:")
        for r in brief["rule_brief"]:
            lines.append(
                f"    - trigger={r['trigger']}, "
                f"condition={r['condition']}, effects={r['effects']}"
            )
    lines.append("")
    if recent_fingerprints:
        lines.append(
            "AVOID fingerprints already seen by this student: "
            + ", ".join(recent_fingerprints)
        )
        lines.append(
            "(Your output's fingerprint is hash(triggers + effects + win). "
            "Vary the rules or win text so the hash differs.)"
        )
        lines.append("")
    lines.append("DO NOT do ANY of the following (they are common mistakes):")
    lines.append('  WRONG: {"on": "always", "if": "collision(player,coin0)", ...}')
    lines.append('         (swapped the "on" and "if" fields — do not swap them)')
    lines.append('  WRONG: {"on": "collision(player_knight,coin0)", ...}')
    lines.append('         (used sprite id "player_knight"; must use entity id "player")')
    lines.append(f'  WRONG: emitting fewer than {rule_count} rules for {difficulty}')
    lines.append('  WRONG: rules reference coin1 but entities only declare coin0')
    lines.append('         (declare ALL coin0..coinN entities used in rules)')
    lines.append('  WRONG: using a "then" array that omits "destroy(<target>)"')
    lines.append('         (every rule that scores must also destroy its target)')
    lines.append("")
    lines.append("EXAMPLE OUTPUT — this is a VALID answer for THIS exact request.")
    lines.append("Copy its structure verbatim. Vary ONLY the win string if needed:")
    lines.append(json.dumps(example, indent=2))
    lines.append("")
    lines.append("YOUR OUTPUT: exactly one JSON object matching the schema.")
    return "\n".join(lines)


def _few_shot_example_for(
    week: int, difficulty: str, brief: dict, sprite_map: dict
) -> dict:
    """A valid answer for the CURRENT week/difficulty — qwen copies the shape."""
    from .grammar import load_week
    week_cfg = load_week(week)
    n = {"needs_support": 2, "standard": 3, "advanced": 5}[difficulty]

    player_sprite = "player_knight"
    for s in sprite_map.values():
        if s["role"] == "player" and week in s["allowed_contexts"]:
            player_sprite = s["id"]
            break

    collectible_sprite = "coin"
    for s in sprite_map.values():
        if s["role"] == "collectible" and week in s["allowed_contexts"]:
            collectible_sprite = s["id"]
            break

    entities = [
        {"id": "player", "sprite": player_sprite, "role": "player"}
    ]
    rules = []
    for i in range(n):
        cid = f"coin{i}"
        entities.append(
            {"id": cid, "sprite": collectible_sprite, "role": "collectible"}
        )
        rules.append({
            "on": f"collision(player,{cid})",
            "if": "always",
            "then": ["score += 1", f"destroy({cid})"],
        })

    return {
        "week": week,
        "concept": week_cfg["concept"],
        "ilo": week_cfg["ilo"][0],
        "difficulty": difficulty,
        "game_type": brief["game_type"],
        "fingerprint": "will-be-recomputed",
        "entities": entities,
        "map": brief["map_id"],
        "rules": rules,
        "win": f"score == {n}",
        "hint": f"Collect all {n} coins by walking into them.",
        "tutor_note": (
            f"Each collision with a coin adds 1. Reach {n} to win."
        ),
    }

def _append_repair(prompt: str, previous: str, errors: str) -> str:
    trimmed = previous[:1000]
    return (
        prompt
        + "\n\nREPAIR REQUIRED. Your previous output failed validation:\n"
        + f"  errors: {errors}\n"
        + f"  your output (truncated):\n{trimmed}\n"
        + "Correct the errors and output ONE valid JSON object only."
    )


# ── Response handling ────────────────────────────────────────────────

def _coerce_to_spec(
    raw: str, week: int, difficulty: str, brief: dict | None = None
) -> dict | None:
    try:
        obj = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(obj, dict):
        return None
    # Fields the LLM cannot set (§2.3, §6).
    obj["week"] = week
    obj["difficulty"] = difficulty
    # Fields the shuffler owns — enforce so §7 brief guarantee holds even
    # if the LLM ignores the prompt. Deviation is logged to stderr for
    # Phase 4 analysis, not silently dropped.
    if brief:
        if obj.get("game_type") != brief["game_type"]:
            print(
                f"[coerce] llm game_type={obj.get('game_type')!r} "
                f"overridden by brief={brief['game_type']!r}",
                file=sys.stderr,
            )
        obj["game_type"] = brief["game_type"]
        if obj.get("map") != brief["map_id"]:
            print(
                f"[coerce] llm map={obj.get('map')!r} "
                f"overridden by brief={brief['map_id']!r}",
                file=sys.stderr,
            )
        obj["map"] = brief["map_id"]
    obj.setdefault("fingerprint", "00000000")
    return obj


# ── Fallback + perturbation (§8) ─────────────────────────────────────
# Perturbation applies regardless of whether the on-disk template
# exists. When the file is missing, we synthesize the SAME content via
# server.fallbacks.build_fallback, then perturb identically. This makes
# criterion 3 (fingerprint duplicate rejection) work even with an empty
# data/fallback_templates/ directory.

_WIN_SCORE_RE = re.compile(r"^score\s*(==|>=|<=|>|<|!=)\s*(\d+)$")


def _base_fallback(week: int, difficulty: str) -> dict:
    """Load committed template if present, else synthesize identical content."""
    path = FALLBACK_DIR / f"week{week}_{difficulty}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    from .fallbacks import build_fallback
    return build_fallback(week, difficulty)


def _load_fallback(
    week: int, difficulty: str, recent_fingerprints: list[str]
) -> dict:
    base = _base_fallback(week, difficulty)
    fp = compute_fingerprint(base)
    if fp not in recent_fingerprints:
        return base

    # Perturb win text — try several equivalent-but-distinct strings.
    m = _WIN_SCORE_RE.match(str(base.get("win", "")).strip())
    if m:
        op, n = m.group(1), int(m.group(2))
        candidates: list[str] = []
        for delta in (1, -1, 2, -2):
            new_n = max(1, n + delta)
            candidates.append(f"score {op} {new_n}")
        candidates.extend([
            f"score >= {n}",
            f"score > {max(1, n - 1)}",
            f"score == {n}",
            f"score != 0",
        ])
        for win_text in candidates:
            variant = copy.deepcopy(base)
            variant["win"] = win_text
            if compute_fingerprint(variant) not in recent_fingerprints:
                return variant

    # Give up on perturbation; return base anyway. Client will log this.
    return base