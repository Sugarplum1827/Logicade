"""Phase 1 acceptance tests.

Directly exercises §17 criteria:
  3  (partial)  — fingerprint duplicate rejection
  4             — week-3 spec using a week-6 concept is rejected
  6             — rolling-5 no-repeat across four shuffle dimensions
  8             — every threshold boundary in §10's table

Plus the deterministic-core sanity checks that make those four provable:
grammar parsers, verifier checks, difficulty engine, shuffler behaviour.
"""

from __future__ import annotations

import random

import pytest

from server.difficulty_engine import next_difficulty
from server.grammar import (
    ALLOWED_CONDITIONS,
    ALLOWED_EFFECTS,
    ALLOWED_GAME_TYPES,
    ALLOWED_TRIGGERS,
    load_registry,
    load_week,
    parse_condition,
    parse_effect,
    parse_trigger,
    validate_concept_alignment,
)
from server.shuffler import build_brief
from server.verifier import (
    compute_difficulty_score,
    compute_fingerprint,
    verify,
)


# ══════════════════════════════════════════════════════════════════════
# §10 difficulty engine — criterion 8
# ══════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize(
    "accuracy,replays,expected",
    [
        # Below 60%
        (0.00, 0, "needs_support"),
        (0.50, 0, "needs_support"),
        (0.599, 0, "needs_support"),
        (0.599, 5, "needs_support"),
        # 60% – <80%, ≥ 2 replays
        (0.60, 2, "needs_support"),
        (0.60, 3, "needs_support"),
        (0.70, 2, "needs_support"),
        (0.799, 2, "needs_support"),
        # 60% – <80%, 0–1 replays
        (0.60, 0, "standard"),
        (0.60, 1, "standard"),
        (0.70, 1, "standard"),
        (0.799, 0, "standard"),
        (0.799, 1, "standard"),
        # ≥ 80%, ≥ 2 replays
        (0.80, 2, "standard"),
        (0.80, 5, "standard"),
        (1.00, 2, "standard"),
        (1.00, 10, "standard"),
        # ≥ 80%, 0–1 replays
        (0.80, 0, "advanced"),
        (0.80, 1, "advanced"),
        (0.95, 0, "advanced"),
        (1.00, 1, "advanced"),
    ],
)
def test_threshold_table(accuracy, replays, expected):
    """Criterion 8 — §10 authoritative table reproduced exactly."""
    assert next_difficulty(accuracy, replays, total_errors=0) == expected


def test_difficulty_rejects_out_of_range_accuracy():
    with pytest.raises(ValueError):
        next_difficulty(-0.01, 0)
    with pytest.raises(ValueError):
        next_difficulty(1.01, 0)


def test_difficulty_third_input_accepted_but_unused():
    """§10 lists three inputs; the table does not read total_errors."""
    a = next_difficulty(0.70, 1, total_errors=0)
    b = next_difficulty(0.70, 1, total_errors=99)
    assert a == b == "standard"


# ══════════════════════════════════════════════════════════════════════
# Grammar parsers — foundational for every other check
# ══════════════════════════════════════════════════════════════════════

def test_trigger_parsers_cover_closed_set():
    cases = {
        "collision(player,coin)": "collision",
        "timer(30)": "timer",
        "score_threshold(5)": "score threshold",
        "score threshold": "score threshold",
        "key_press(space)": "key press",
        "proximity(player,goal)": "proximity",
        "count_reached(3)": "count reached",
    }
    for raw, want in cases.items():
        assert parse_trigger(raw) == want
        assert want in ALLOWED_TRIGGERS


def test_condition_parsers_cover_closed_set():
    cases = {
        "always": "always",
        "score < 5": "if score </>/= n",
        "score >= 5": "if score </>/= n",
        "timer > 10": "if timer </> n",
        "count <= 3": "if count </> n",
        "carrying(key)": "if carrying(X)",
    }
    for raw, want in cases.items():
        assert parse_condition(raw) == want
        assert want in ALLOWED_CONDITIONS


def test_effect_parsers_cover_closed_set():
    cases = {
        "score += 1": "score±n",
        "score -= 2": "score±n",
        "destroy(coin)": "destroy",
        "spawn(slime)": "spawn",
        "teleport(player)": "teleport",
        "freeze": "freeze",
        "swap(a,b)": "swap",
        "invert_controls": "invert_controls",
        "slow(player)": "slow",
        "speed_up": "speed_up",
        "reset": "reset",
    }
    for raw, want in cases.items():
        assert parse_effect(raw) == want
        assert want in ALLOWED_EFFECTS


# ══════════════════════════════════════════════════════════════════════
# Verifier — happy path + check-specific rejections
# ══════════════════════════════════════════════════════════════════════

def test_verifier_passes_minimal_valid_spec(make_valid_spec):
    spec = make_valid_spec(week=3, difficulty="standard")
    result = verify(spec, week=3, difficulty="standard")
    assert result["pass"], result["errors"]


def test_verifier_rejects_missing_field(make_valid_spec):
    spec = make_valid_spec(week=3, difficulty="standard")
    del spec["hint"]
    result = verify(spec, week=3, difficulty="standard")
    assert not result["pass"]
    assert any("hint" in e for e in result["errors"])


def test_termination_rejects_always_spawn(make_valid_spec):
    spec = make_valid_spec(week=3, difficulty="standard")
    spec["rules"][0]["if"] = "always"
    spec["rules"][0]["then"] = ["spawn(slime)"]
    result = verify(spec, week=3, difficulty="standard")
    assert any("uncapped spawn" in e for e in result["errors"])


def test_reachability_rejects_score_win_without_score_effect(make_valid_spec):
    spec = make_valid_spec(week=3, difficulty="standard")
    spec["rules"] = [
        {"on": "collision(player,coin)", "if": "always", "then": ["destroy(coin)"]}
    ]
    result = verify(spec, week=3, difficulty="standard")
    assert any("unreachable" in e for e in result["errors"])


# ══════════════════════════════════════════════════════════════════════
# §9 check 5 — concept alignment + §9 check 6 — leakage
# criterion 4
# ══════════════════════════════════════════════════════════════════════

def test_concept_alignment_rejects_week6_effect_in_week3(make_valid_spec):
    """Criterion 4 — a week-3 spec using swap (introduced in week 6) is rejected."""
    spec = make_valid_spec(week=3, difficulty="standard")
    spec["rules"][0]["then"] = ["swap(player,coin)"]
    result = verify(spec, week=3, difficulty="standard")
    # swap is not in week 3's allowed_effects
    assert any("swap" in e for e in result["errors"]), result["errors"]


def test_concept_alignment_rejects_week7_condition_in_week3(make_valid_spec):
    """Criterion 4 — carrying(...) is week 7, not week 3."""
    spec = make_valid_spec(week=3, difficulty="standard")
    spec["rules"][0]["if"] = "carrying(key)"
    result = verify(spec, week=3, difficulty="standard")
    assert any("carrying" in e for e in result["errors"]), result["errors"]


def test_leakage_rejects_forbidden_concept_in_text(make_valid_spec):
    """Criterion 4 — free-text leak of a forbidden concept is caught by check 6."""
    spec = make_valid_spec(week=3, difficulty="standard")
    spec["tutor_note"] = "This level uses functions and loops to iterate."
    result = verify(spec, week=3, difficulty="standard")
    assert any("leakage" in e for e in result["errors"]), result["errors"]


# ══════════════════════════════════════════════════════════════════════
# §2.5 novelty — criterion 3 (partial)
# ══════════════════════════════════════════════════════════════════════

def test_fingerprint_is_deterministic(make_valid_spec):
    a = make_valid_spec(week=3, difficulty="standard")
    b = make_valid_spec(week=3, difficulty="standard")
    assert compute_fingerprint(a) == compute_fingerprint(b)


def test_fingerprint_changes_with_rules(make_valid_spec):
    """Fingerprint changes when the *shape* of a rule changes.

    Note on granularity: compute_fingerprint hashes normalized effect
    types (§2.5 — 'same shape, different parameter' must collide), so
    score += 1 vs score += 5 do NOT change the fingerprint. To change
    the fingerprint we change the effect type itself.
    """
    a = make_valid_spec(week=3, difficulty="standard")
    b = make_valid_spec(week=3, difficulty="standard")
    # rules[0] currently has "score += 1"; change its effect type.
    b["rules"][0]["then"] = ["destroy(e0)"]
    assert compute_fingerprint(a) != compute_fingerprint(b)


def test_novelty_rejects_duplicate_fingerprint(make_valid_spec):
    """Criterion 3 (partial) — duplicate fingerprint is rejected."""
    spec = make_valid_spec(week=3, difficulty="standard")
    fp = compute_fingerprint(spec)
    result = verify(
        spec, week=3, difficulty="standard", recent_fingerprints=[fp]
    )
    assert not result["pass"]
    assert any("novelty" in e for e in result["errors"])


def test_novelty_passes_when_fingerprint_is_new(make_valid_spec):
    spec = make_valid_spec(week=3, difficulty="standard")
    result = verify(
        spec, week=3, difficulty="standard",
        recent_fingerprints=["deadbeef", "cafebabe"],
    )
    assert result["pass"], result["errors"]


# ══════════════════════════════════════════════════════════════════════
# §7 shuffler — criterion 6
# ══════════════════════════════════════════════════════════════════════

def test_shuffler_brief_is_valid_for_week(registry):
    brief = build_brief(
        week=5, difficulty="standard", recent_levels=None,
        rng=random.Random(1),
    )
    week_cfg = load_week(5)
    assert brief["game_type"] in ALLOWED_GAME_TYPES
    map_ids = {m["id"] for m in registry["tilemaps"]}
    assert brief["map_id"] in map_ids
    sprite_map = {s["id"]: s for s in registry["sprites"]}
    for sid in brief["sprite_ids"]:
        assert sid in sprite_map
        assert 5 in sprite_map[sid]["allowed_contexts"]
    for r in brief["rule_brief"]:
        assert r["trigger"] in week_cfg["allowed_triggers"]
        assert r["condition"] in week_cfg["allowed_conditions"]
        for e in r["effects"]:
            assert e in week_cfg["allowed_effects"]


def test_shuffler_rolling_window_no_repeat(registry):
    """Criterion 6 — no repetition within any rolling window of 5.

    Because the closed set of game_types has exactly 5 members and the
    registry has exactly 5 tilemaps, once 5 consecutive levels have been
    played, the 6th level is forced by the pigeonhole principle to mark
    `pool_status: "exhausted"` for at least one dimension. We accept that
    and assert: `served` ⇒ no repeat in the last 5.
    """
    rng = random.Random(42)
    history: list[dict] = []
    exhausted_count = 0
    for i in range(10):
        brief = build_brief(
            week=3, difficulty="standard", recent_levels=history,
            rng=rng,
        )
        window = history[-5:]
        if brief["pool_status"] == "served":
            assert brief["game_type"] not in [l["game_type"] for l in window]
            assert brief["map_id"] not in [l["map_id"] for l in window]
            assert frozenset(brief["sprite_ids"]) not in [
                frozenset(l["sprite_ids"]) for l in window
            ]
        else:
            exhausted_count += 1
        history.append(
            {
                "game_type": brief["game_type"],
                "map_id": brief["map_id"],
                "sprite_ids": brief["sprite_ids"],
                "fingerprint": f"fp{i:08d}",
            }
        )

    # Sanity: the first 5 must have been served, and once the closed
    # sets are exhausted we should see exhausted markers.
    assert exhausted_count >= 1


def test_shuffler_exhausted_after_five(registry):
    """After exactly 5 distinct picks of a 5-member set, the 6th is exhausted."""
    rng = random.Random(7)
    history: list[dict] = []
    for _ in range(5):
        brief = build_brief(week=3, difficulty="standard", recent_levels=history, rng=rng)
        history.append(
            {
                "game_type": brief["game_type"],
                "map_id": brief["map_id"],
                "sprite_ids": brief["sprite_ids"],
                "fingerprint": "x",
            }
        )
    sixth = build_brief(week=3, difficulty="standard", recent_levels=history, rng=rng)
    # game_type: 5 distinct values already used ⇒ forced exhausted
    assert sixth["pool_status"] == "exhausted"


# ══════════════════════════════════════════════════════════════════════
# Difficulty scoring — internal consistency with the verifier band
# ══════════════════════════════════════════════════════════════════════

def test_difficulty_score_monotone_in_rule_count():
    from server.verifier import compute_difficulty_score
    base = {
        "rules": [
            {"on": "collision(a,b)", "if": "always", "then": ["score += 1"]}
        ],
        "win": "score == 1",
    }
    one = compute_difficulty_score(base)
    base["rules"].append(
        {"on": "collision(a,c)", "if": "always", "then": ["score += 1"]}
    )
    two = compute_difficulty_score(base)
    assert two > one
# ══════════════════════════════════════════════════════════════════════
# Registry contract — Phase 2 regeneration must not drop ids
# ══════════════════════════════════════════════════════════════════════

def test_registry_contract():
    """Registry must contain enough variety per role for the shuffler to work."""
    from server.grammar import load_registry

    reg = load_registry()
    sprites = reg["sprites"]
    by_role: dict[str, list[dict]] = {}
    for s in sprites:
        by_role.setdefault(s["role"], []).append(s)

    required_minimums = {
        "player":      3,
        "collectible": 5,
        "hazard":      8,
        "obstacle":    3,
        "goal":        2,
        "powerup":     2,
    }
    for role, minimum in required_minimums.items():
        count = len(by_role.get(role, []))
        assert count >= minimum, (
            f"registry has only {count} '{role}' sprites, need at least {minimum}"
        )

    for s in sprites:
        assert s.get("id"), f"sprite missing id: {s}"
        assert s.get("sprite_key"), f"sprite {s['id']} missing sprite_key"
        assert s.get("allowed_contexts"), f"sprite {s['id']} missing allowed_contexts"

    required_maps = ["grid_12x9_forest", "grid_12x9_cave", "grid_16x12_castle",
                     "grid_10x8_dungeon", "grid_14x10_ruins"]
    map_ids = {m["id"] for m in reg["tilemaps"]}
    for mid in required_maps:
        assert mid in map_ids, f"missing tilemap {mid}"