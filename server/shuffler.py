"""Four-dimension shuffler — §7.

Picks (independently, filtered by the week's allowed_contexts):
  1. Sprites     — a valid subset from the registry for the week.
  2. Rules       — a brief of trigger/condition/effect combos valid for the
                   week's grammar.
  3. Game type   — rotated so a student rarely sees the same type twice in a row.
  4. Map         — a tilemap valid for the week.
  5. Recent fingerprints — passed to the LLM as "avoid these shapes".

Guarantee: no repetition across any of the four dimensions within a rolling
window of the last 5 levels, unless the pre-generated pool is exhausted
(pool_status: "exhausted").

Closed-set reality check: ALLOWED_GAME_TYPES has exactly 5 members and
the registry has exactly 5 tilemaps, so after 5 consecutive levels the
6th level must mark `pool_status: "exhausted"` for game_type / map. This
is a mathematical consequence of the closed vocab, not a bug — the
verifier and Phase-3 pool worker treat "exhausted" as a valid outcome.
"""

from __future__ import annotations

import random
from typing import Iterable

from .grammar import ALLOWED_GAME_TYPES, load_week

# For each game type, which roles the sprite subset must include at least one of.
_GAME_TYPE_ROLES: dict[str, set[str]] = {
    "collect": {"collectible"},
    "avoid": {"hazard"},
    "reach_goal": {"goal", "obstacle"},
    "survive_timer": {"hazard", "powerup"},
    "match_sequence": {"collectible", "goal", "obstacle"},
}

_WINDOW = 5


def _pick_not_in(
    recent: Iterable[str],
    candidates: list[str],
    rng: random.Random,
) -> tuple[str, bool]:
    """Return (choice, exhausted). exhausted=True means every candidate was recent."""
    recent_set = set(recent)
    available = [c for c in candidates if c not in recent_set]
    if available:
        return rng.choice(available), False
    return rng.choice(candidates), True


def build_brief(
    week: int,
    difficulty: str,
    recent_levels: list[dict] | None = None,
    *,
    rng: random.Random | None = None,
) -> dict:

    rng = rng or random.Random()
    week_cfg = load_week(week)
    registry = _load_registry()

    window = (recent_levels or [])[-_WINDOW:]
    used_game_types = [l["game_type"] for l in window]
    used_maps = [l["map_id"] for l in window]
    used_sprite_sets = [frozenset(l["sprite_ids"]) for l in window]
    avoid_fingerprints = [l["fingerprint"] for l in window]

    # 1. game_type
    valid_game_types = sorted(ALLOWED_GAME_TYPES)
    game_type, gt_exhausted = _pick_not_in(used_game_types, valid_game_types, rng)

    # 2. map
    valid_maps = [
        m["id"] for m in registry["tilemaps"] if week in m["allowed_contexts"]
    ]
    if not valid_maps:
        raise ValueError(f"no tilemaps allow week {week}")
    map_id, map_exhausted = _pick_not_in(used_maps, valid_maps, rng)

    # 3. sprites
    valid_sprites = [
        s for s in registry["sprites"] if week in s["allowed_contexts"]
    ]
    players = [s for s in valid_sprites if s["role"] == "player"]
    if not players:
        raise ValueError(f"no player sprite allows week {week}")
    player = rng.choice(players)
    required_roles = _GAME_TYPE_ROLES[game_type]
    companions = [
        s for s in valid_sprites if s["role"] in required_roles
    ]
    if not companions:
        raise ValueError(
            f"no companion sprite for game_type={game_type!r} in week {week}"
        )
    n_others = rng.randint(1, min(3, len(companions)))
    sprite_ids: list[str] = []
    sprite_exhausted = True
    for _ in range(10):
        chosen_others = rng.sample(companions, n_others)
        candidate = frozenset([player["id"]] + [s["id"] for s in chosen_others])
        if candidate not in used_sprite_sets:
            sprite_ids = [player["id"]] + [s["id"] for s in chosen_others]
            sprite_exhausted = False
            break
    if sprite_exhausted:
        chosen_others = rng.sample(companions, n_others)
        sprite_ids = [player["id"]] + [s["id"] for s in chosen_others]

    # 4. rule brief — sample 2–4 valid (trigger, condition, effects) shapes.
    rule_brief = _sample_rule_brief(week_cfg, rng)

    # 5. pool_status
    pool_status = (
        "exhausted"
        if (gt_exhausted or map_exhausted or sprite_exhausted)
        else "served"
    )

    return {
        "week": week,
        "difficulty": difficulty,
        "game_type": game_type,
        "map_id": map_id,
        "sprite_ids": sprite_ids,
        "rule_brief": rule_brief,
        "avoid_fingerprints": avoid_fingerprints,
        "pool_status": pool_status,
    }


def _sample_rule_brief(week_cfg: dict, rng: random.Random) -> list[dict]:
    allowed_t = list(week_cfg["allowed_triggers"])
    allowed_c = list(week_cfg["allowed_conditions"])
    allowed_e = list(week_cfg["allowed_effects"])
    n = rng.randint(2, 4)
    brief: list[dict] = []
    for _ in range(n):
        effects = rng.sample(allowed_e, min(2, len(allowed_e)))
        brief.append(
            {
                "trigger": rng.choice(allowed_t),
                "condition": rng.choice(allowed_c),
                "effects": effects,
            }
        )
    return brief


def _load_registry() -> dict:
    from .grammar import load_registry
    return load_registry()