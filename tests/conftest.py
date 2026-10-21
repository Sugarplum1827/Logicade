"""Shared fixtures for Phase 1 tests.

`make_valid_spec(week, difficulty)` returns a minimal spec that should pass
all seven checks for its week/difficulty — the "happy path" baseline.
"""

from __future__ import annotations

import copy

import pytest

from server.grammar import load_registry, load_week
from server.verifier import compute_difficulty_score


@pytest.fixture(scope="session")
def registry() -> dict:
    return load_registry()


@pytest.fixture(scope="session")
def weeks() -> list[dict]:
    from server.grammar import load_weeks
    return load_weeks()


@pytest.fixture
def make_valid_spec():
    """Return a callable that produces a schema-valid, verifier-passing spec.

    Tuned so that:
      • at least one rule modifies `score` (so the win `score == 5` is
        reachable — verifier check 2),
      • the rule count lands inside the requested difficulty band
        (verifier check 4),
      • only concepts from the week's allowed vocabularies are used
        (verifier check 5).
    """

    _RULE_COUNT = {"needs_support": 2, "standard": 4, "advanced": 6}

    def _make(week: int, difficulty: str) -> dict:
        week_cfg = load_week(week)
        n_rules = _RULE_COUNT[difficulty]

        triggers = week_cfg["allowed_triggers"]
        conditions = week_cfg["allowed_conditions"]

        trigger = "collision" if "collision" in triggers else triggers[0]
        condition = "always" if "always" in conditions else conditions[0]

        # Rules: one score-changing rule (reachability) + (n-1) destroy rules.
        # Weeks 1–8 all include both 'score±n' and 'destroy' in allowed_effects.
        rules = []
        for i in range(n_rules):
            then = ["score += 1"] if i == 0 else [f"destroy(e{i})"]
            rules.append(
                {
                    "on": f"{trigger.replace(' ', '_')}(player,e{i})",
                    "if": "always" if condition == "always" else "score < 3",
                    "then": then,
                }
            )

        spec = {
            "week": week,
            "concept": week_cfg["concept"],
            "ilo": week_cfg["ilo"][0],
            "difficulty": difficulty,
            "game_type": "collect",
            "fingerprint": "00000000",  # verifier recomputes; placeholder only
            "entities": [
                {"id": "player", "sprite": "player_knight", "role": "player"},
                {"id": "coin", "sprite": "coin", "role": "collectible"},
            ]
            + [
                {"id": f"e{i}", "sprite": "coin", "role": "collectible"}
                for i in range(n_rules)
            ],
            "map": "grid_12x9_forest",
            "rules": rules,
            "win": "score == 5",
            "hint": "Collect the coins.",
            "tutor_note": "Watch your score.",
        }
        return copy.deepcopy(spec)

    return _make