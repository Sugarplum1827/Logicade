"""Deterministic 7-check verifier — §9.

Every spec passes all seven checks before it is served:

  1. Schema             — fields, verbs, entities, in allowed lists
  2. Reachability       — win condition satisfiable by at least one rule
  3. Termination        — no infinite loops, no uncapped spawns
  4. Difficulty         — computed score lands in the target band
  5. Concept alignment  — rules match the week's grammar
  6. No leakage         — spec text/concepts avoid later-week concepts
  7. Novelty            — fingerprint not in the student's recent history

Returns:
  { "pass": bool, "repaired": bool, "fallback": bool, "errors": [str] }

`repaired` is set by the LLM client's repair loop (§8), not by this module.
`fallback` is set by the LLM client when a template is served.
"""

from __future__ import annotations

import hashlib

from .grammar import (
    ALLOWED_GAME_TYPES,
    ALLOWED_ROLES,
    load_registry,
    load_week,
    parse_condition,
    parse_effect,
    parse_trigger,
    registry_sprite_map,
    registry_tilemap_map,
    validate_concept_alignment,
)

# ── Difficulty bands (§9 check 4) ────────────────────────────────────
# Score = 2 * rule_count + sum(condition_weight) + sum(effect_weight).
# Bands are inclusive. Tuned so the fallback templates for each week sit
# comfortably inside their target band; Phase 3 will widen or narrow
# these as needed once real Ollama output is scored.

_CONDITION_WEIGHT = {
    "always": 0,
    "if score </>/= n": 1,
    "if timer </> n": 1,
    "if count </> n": 1,
    "if carrying(X)": 2,
    "compound (AND/OR)": 3,
}

_EFFECT_WEIGHT = {
    "score±n": 1,
    "destroy": 1,
    "spawn": 2,
    "teleport": 2,
    "freeze": 2,
    "swap": 2,
    "invert_controls": 2,
    "slow": 1,
    "speed_up": 1,
    "reset": 2,
}

DIFFICULTY_BANDS: dict[str, tuple[int, int]] = {
    "needs_support": (0, 9),
    "standard": (10, 16),
    "advanced": (17, 10_000),
}


# ── Fingerprint (§2.5, §6) ───────────────────────────────────────────
# hash(triggers + effects + win_condition). Conditions are deliberately
# excluded — the spec's §2.5 formula omits them, and the fingerprint is
# used to detect structurally identical "shapes", not condition variance.

def compute_fingerprint(spec: dict) -> str:
    rule_parts: list[str] = []
    for rule in spec.get("rules", []):
        try:
            t = parse_trigger(rule["on"])
        except (KeyError, ValueError):
            continue
        effects = []
        for e in rule.get("then", []):
            try:
                effects.append(parse_effect(e))
            except ValueError:
                pass
        rule_parts.append(f"{t}:{','.join(sorted(effects))}")
    joined = "|".join(sorted(rule_parts)) + "||" + str(spec.get("win", ""))
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()[:8]


# ── Check 1: schema ──────────────────────────────────────────────────

_REQUIRED_TOP_FIELDS = (
    "week", "concept", "ilo", "difficulty", "game_type",
    "entities", "map", "rules", "win", "hint", "tutor_note",
    # "objectives" — REMOVED. Client derives display objectives from `win`.
)


def _check_schema(spec: dict, week: int, difficulty: str) -> list[str]:
    errors: list[str] = []

    for f in _REQUIRED_TOP_FIELDS:
        if f not in spec:
            errors.append(f"missing required field '{f}'")

    if spec.get("week") != week:
        errors.append(f"spec.week={spec.get('week')!r} != target week {week}")
    if spec.get("difficulty") != difficulty:
        errors.append(
            f"spec.difficulty={spec.get('difficulty')!r} != target {difficulty!r}"
        )
    if spec.get("game_type") not in ALLOWED_GAME_TYPES:
        errors.append(f"spec.game_type={spec.get('game_type')!r} not in closed set")

    maps = registry_tilemap_map()
    if spec.get("map") not in maps:
        errors.append(f"spec.map={spec.get('map')!r} not in registry")
    else:
        if week not in maps[spec["map"]]["allowed_contexts"]:
            errors.append(
                f"spec.map={spec['map']!r} not allowed in week {week}"
            )

    sprites = registry_sprite_map()
    entity_ids: set[str] = set()
    for i, ent in enumerate(spec.get("entities", [])):
        for f in ("id", "sprite", "role"):
            if f not in ent:
                errors.append(f"entities[{i}] missing '{f}'")
        if ent.get("sprite") not in sprites:
            errors.append(
                f"entities[{i}].sprite={ent.get('sprite')!r} not in registry"
            )
        if ent.get("role") not in ALLOWED_ROLES:
            errors.append(
                f"entities[{i}].role={ent.get('role')!r} not in closed set"
            )
        if ent.get("id"):
            if ent["id"] in entity_ids:
                errors.append(f"entities[{i}].id={ent['id']!r} is duplicated")
            entity_ids.add(ent["id"])

    if not isinstance(spec.get("rules"), list) or not spec["rules"]:
        errors.append("spec.rules must be a non-empty list")
    else:
        for i, rule in enumerate(spec["rules"]):
            if "on" not in rule:
                errors.append(f"rules[{i}] missing 'on'")
            if "then" not in rule or not isinstance(rule["then"], list):
                errors.append(f"rules[{i}] missing 'then' list")

    return errors


# ── Check 2: reachability ────────────────────────────────────────────

def _check_reachability(spec: dict) -> list[str]:
    errors: list[str] = []
    win = str(spec.get("win", ""))

    def _has_effect(predicate) -> bool:
        for rule in spec.get("rules", []):
            for e in rule.get("then", []):
                try:
                    if predicate(parse_effect(e)):
                        return True
                except ValueError:
                    continue
        return False

    if "score" in win:
        if not _has_effect(lambda e: e == "score±n"):
            errors.append(
                "win condition references 'score' but no rule modifies score "
                "(unreachable)"
            )

    if "count" in win:
        if not _has_effect(lambda e: e in {"spawn", "score±n"}):
            errors.append(
                "win condition references 'count' but no rule changes count "
                "(unreachable)"
            )

    if win.strip() == "":
        errors.append("win condition is empty")

    return errors


# ── Check 3: termination ─────────────────────────────────────────────

def _check_termination(spec: dict) -> list[str]:
    errors: list[str] = []
    for i, rule in enumerate(spec.get("rules", [])):
        try:
            cond = parse_condition(rule.get("if", "always"))
        except ValueError:
            continue
        spawns = False
        for e in rule.get("then", []):
            try:
                if parse_effect(e) == "spawn":
                    spawns = True
                    break
            except ValueError:
                continue
        if spawns and cond == "always":
            errors.append(
                f"rules[{i}] spawns under 'always' — uncapped spawn risk "
                "(termination)"
            )
    return errors


# ── Check 4: difficulty ──────────────────────────────────────────────

def compute_difficulty_score(spec: dict) -> int:
    rules = spec.get("rules", [])
    score = 2 * len(rules)
    for rule in rules:
        try:
            c = parse_condition(rule.get("if", "always"))
            score += _CONDITION_WEIGHT.get(c, 1)
        except ValueError:
            score += 1
        for e in rule.get("then", []):
            try:
                etype = parse_effect(e)
                score += _EFFECT_WEIGHT.get(etype, 1)
            except ValueError:
                score += 1
    return score


def _check_difficulty(spec: dict, target: str) -> list[str]:
    if target not in DIFFICULTY_BANDS:
        return [f"unknown target difficulty {target!r}"]
    lo, hi = DIFFICULTY_BANDS[target]
    score = compute_difficulty_score(spec)
    if not (lo <= score <= hi):
        return [
            f"difficulty score {score} outside target band {target!r} "
            f"({lo}–{hi})"
        ]
    return []


# ── Check 6: leakage ─────────────────────────────────────────────────

def _check_leakage(spec: dict, week: int) -> list[str]:
    week_cfg = load_week(week)
    forbidden = [c.lower().replace("_", " ") for c in week_cfg["forbidden_concepts"]]
    blob = " ".join(
        str(spec.get(k, "")) for k in ("hint", "tutor_note", "win")
    ).lower()
    errors: list[str] = []
    for concept in forbidden:
        if concept and concept in blob:
            errors.append(
                f"leakage: forbidden concept '{concept}' for week {week} "
                f"appears in spec text"
            )
    return errors


# ── Check 7: novelty ─────────────────────────────────────────────────

def _check_novelty(spec: dict, recent_fingerprints: list[str]) -> list[str]:
    fp = compute_fingerprint(spec)
    if fp in recent_fingerprints:
        return [f"novelty: fingerprint {fp} matches recent history"]
    return []


# ── Public entry point ───────────────────────────────────────────────

def verify(
    spec: dict,
    week: int,
    difficulty: str,
    recent_fingerprints: list[str] | None = None,
) -> dict:
    """Run all seven checks. `repaired`/`fallback` are set by the caller."""
    errors: list[str] = []
    errors.extend(_check_schema(spec, week, difficulty))
    errors.extend(_check_reachability(spec))
    errors.extend(_check_termination(spec))
    errors.extend(_check_difficulty(spec, difficulty))
    errors.extend(validate_concept_alignment(spec, week))
    errors.extend(_check_leakage(spec, week))
    errors.extend(_check_novelty(spec, recent_fingerprints or []))

    return {
        "pass": len(errors) == 0,
        "repaired": False,
        "fallback": False,
        "errors": errors,
    }