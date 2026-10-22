"""Fallback spec construction — §8.

Single source of truth for fallback template content. Used by:
  • scripts/generate_fallbacks.py  (writes committed JSON files)
  • server/llm_client.py           (in-memory fallback when file missing)

Keeping them from the same module means the committed files and the
runtime in-memory fallbacks cannot drift. `generate_fallbacks.py
--check` catches drift against this module specifically.

Shape: "collect N coins by collision". Valid for weeks 1–9, scores
cleanly in each difficulty band (see §10 table). Win text varies by
week so files don't all share one fingerprint.

Note: this is the canonical fallback for the LLM pool path. The
2,700 pre-generated games in data/fallback_pool/ are served by
fallback_loader.Registry, not here.
"""

from __future__ import annotations

from .grammar import load_registry, load_week
from .verifier import compute_fingerprint

DIFFICULTIES = ("needs_support", "standard", "advanced")
RULE_COUNT = {"needs_support": 2, "standard": 3, "advanced": 5}

# Operator chosen per week so the 27 files don't collapse to 3 fingerprints.
WIN_STYLE = {
    1: "==", 4: "==", 7: "==",
    2: ">=", 5: ">=", 8: ">=", 9: ">=",
    3: ">",  6: ">",
}


def _pick_sprite(week: int, role: str) -> str:
    for s in load_registry()["sprites"]:
        if s["role"] == role and week in s["allowed_contexts"]:
            return s["id"]
    raise RuntimeError(f"no sprite with role={role!r} for week {week}")


def _pick_map(week: int) -> str:
    for m in load_registry()["tilemaps"]:
        if week in m["allowed_contexts"]:
            return m["id"]
    raise RuntimeError(f"no tilemap allows week {week}")


def _make_win(week: int, n: int) -> str:
    style = WIN_STYLE[week]
    if style == "==":
        return f"score == {n}"
    if style == ">=":
        return f"score >= {n}"
    return f"score > {n - 1}"


def build_fallback(week: int, difficulty: str) -> dict:
    week_cfg = load_week(week)
    n = RULE_COUNT[difficulty]

    player_id = _pick_sprite(week, "player")
    collectible_id = _pick_sprite(week, "collectible")
    map_id = _pick_map(week)

    entities = [{"id": "player", "sprite": player_id, "role": "player"}]
    rules = []
    for i in range(n):
        coin_id = f"coin{i}"
        entities.append(
            {"id": coin_id, "sprite": collectible_id, "role": "collectible"}
        )
        rules.append(
            {
                "on": f"collision(player,{coin_id})",
                "if": "always",
                "then": ["score += 1", f"destroy({coin_id})"],
            }
        )

    spec = {
        "week": week,
        "concept": week_cfg["concept"],
        "ilo": week_cfg["ilo"][0],
        "difficulty": difficulty,
        "game_type": "collect",
        "fingerprint": "placeholder",
        "entities": entities,
        "map": map_id,
        "rules": rules,
        "win": _make_win(week, n),
        "hint": f"Collect all {n} coins by walking into them.",
        "tutor_note": (
            f"Each collision with a coin adds 1 to your score. "
            f"Reach {n} to win."
        ),
        "objectives": [
            f"Collect {n} items",
            "Complete in under 60s",
            "Perfect Accuracy",
        ],
    }

    spec["fingerprint"] = compute_fingerprint(spec)
    return spec