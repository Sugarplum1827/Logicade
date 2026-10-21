"""Bounded rule grammar and CP1 week scoping.

Implements:
  §3  weeks.json loader
  §4  closed vocabularies for triggers, conditions, effects, game types, roles
  §6  DSL parsing helpers (on/if/then → normalized vocab keys)
  §9  concept-alignment helper (used by verifier)

The normalized keys returned by `parse_*` are the ones that appear in
weeks.json's allowed_* arrays. Keeping the raw DSL strings out of the
comparison is what makes cross-week leakage and concept-alignment checks
deterministic.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Iterable

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# §4 — closed vocabularies. Nothing outside these is ever valid.
ALLOWED_TRIGGERS: set[str] = {
    "collision", "timer", "score threshold", "key press", "proximity", "count reached",
}
ALLOWED_CONDITIONS: set[str] = {
    "always", "if score </>/= n", "if timer </> n", "if count </> n",
    "if carrying(X)", "compound (AND/OR)",
}
ALLOWED_EFFECTS: set[str] = {
    "score±n", "destroy", "spawn", "teleport", "freeze", "swap",
    "invert_controls", "slow", "speed_up", "reset",
}
ALLOWED_GAME_TYPES: set[str] = {
    "collect", "avoid", "reach_goal", "survive_timer", "match_sequence",
}
# §4 — closed role set.
ALLOWED_ROLES: set[str] = {
    "player", "collectible", "hazard", "obstacle", "goal", "powerup",
}

_weeks_cache: list[dict] | None = None
_registry_cache: dict | None = None


# ── Loaders ────────────────────────────────────────────────────────────

def load_weeks() -> list[dict]:
    global _weeks_cache
    if _weeks_cache is None:
        with open(_DATA_DIR / "weeks.json", encoding="utf-8") as f:
            _weeks_cache = json.load(f)
    return _weeks_cache


def load_week(week_num: int) -> dict:
    for w in load_weeks():
        if w["week"] == week_num:
            return w
    raise ValueError(f"Week {week_num} is not defined in weeks.json")


def load_registry() -> dict:
    global _registry_cache
    if _registry_cache is None:
        with open(_DATA_DIR / "registry.json", encoding="utf-8") as f:
            _registry_cache = json.load(f)
    return _registry_cache


def registry_sprite_map() -> dict[str, dict]:
    return {s["id"]: s for s in load_registry()["sprites"]}


def registry_tilemap_map() -> dict[str, dict]:
    return {m["id"]: m for m in load_registry()["tilemaps"]}


# ── DSL parsers (§6) ──────────────────────────────────────────────────
# These accept the raw DSL strings from the spec and return normalized
# keys that appear in weeks.json's allowed_* arrays.

_TRIGGER_RE = re.compile(r"^\s*([a-zA-Z_ ]+?)\s*(?:\(.*\))?\s*$")
_SCORE_COND_RE = re.compile(r"^\s*score\s*(?:<=|>=|<|>|==|!=)\s*-?\d+(?:\.\d+)?\s*$")
_TIMER_COND_RE = re.compile(r"^\s*timer\s*(?:<=|>=|<|>|==|!=)\s*-?\d+(?:\.\d+)?\s*$")
_COUNT_COND_RE = re.compile(r"^\s*count\s*(?:<=|>=|<|>|==|!=)\s*-?\d+(?:\.\d+)?\s*$")
_CARRYING_RE = re.compile(r"^\s*carrying\s*\(\s*\w+\s*\)\s*$")
_SCORE_EFFECT_RE = re.compile(r"^\s*score\s*[+\-]=\s*\d+\s*$")

_EFFECT_PREFIXES = ("destroy", "spawn", "teleport", "freeze", "swap", "slow", "speed_up")


def parse_trigger(on_str: str) -> str:
    m = _TRIGGER_RE.match(on_str)
    if not m:
        raise ValueError(f"cannot parse trigger: {on_str!r}")
    name = m.group(1).strip().lower().replace("_", " ")
    if name not in ALLOWED_TRIGGERS:
        raise ValueError(f"unknown trigger '{name}' in {on_str!r}")
    return name


def parse_condition(if_str: str) -> str:
    s = (if_str or "always").strip()
    if s == "always":
        return "always"
    if s.lower() in {"compound", "compound (and/or)"}:
        return "compound (AND/OR)"
    if _SCORE_COND_RE.match(s):
        return "if score </>/= n"
    if _TIMER_COND_RE.match(s):
        return "if timer </> n"
    if _COUNT_COND_RE.match(s):
        return "if count </> n"
    if _CARRYING_RE.match(s):
        return "if carrying(X)"
    raise ValueError(f"cannot parse condition: {if_str!r}")


def parse_effect(effect_str: str) -> str:
    s = effect_str.strip()
    if _SCORE_EFFECT_RE.match(s):
        return "score±n"
    if s == "invert_controls":
        return "invert_controls"
    if s == "reset":
        return "reset"
    for verb in _EFFECT_PREFIXES:
        if s == verb or s.startswith(verb + "("):
            return verb
    raise ValueError(f"cannot parse effect: {effect_str!r}")


# ── Concept alignment (§9 check 5) ────────────────────────────────────

def validate_concept_alignment(spec: dict, week: int) -> list[str]:
    """Return a list of human-readable errors; empty means aligned."""
    week_cfg = load_week(week)
    allowed_t = set(week_cfg["allowed_triggers"])
    allowed_c = set(week_cfg["allowed_conditions"])
    allowed_e = set(week_cfg["allowed_effects"])

    errors: list[str] = []
    for i, rule in enumerate(spec.get("rules", [])):
        try:
            t = parse_trigger(rule["on"])
        except (KeyError, ValueError) as exc:
            errors.append(f"rules[{i}].on: {exc}")
            continue
        if t not in allowed_t:
            errors.append(
                f"rules[{i}].on uses trigger '{t}' which is not allowed in week {week}"
            )

        try:
            c = parse_condition(rule.get("if", "always"))
        except ValueError as exc:
            errors.append(f"rules[{i}].if: {exc}")
            continue
        if c not in allowed_c:
            errors.append(
                f"rules[{i}].if uses condition '{c}' which is not allowed in week {week}"
            )

        for j, e in enumerate(rule.get("then", [])):
            try:
                etype = parse_effect(e)
            except ValueError as exc:
                errors.append(f"rules[{i}].then[{j}]: {exc}")
                continue
            if etype not in allowed_e:
                errors.append(
                    f"rules[{i}].then[{j}] uses effect '{etype}' which is not "
                    f"allowed in week {week}"
                )
    return errors


# ── Utilities ─────────────────────────────────────────────────────────

def iter_rule_vocab(spec: dict) -> Iterable[tuple[str, str, str]]:
    """Yield (trigger, condition, effect) triples for every rule/effect pair."""
    for rule in spec.get("rules", []):
        try:
            t = parse_trigger(rule["on"])
            c = parse_condition(rule.get("if", "always"))
        except (KeyError, ValueError):
            continue
        for e in rule.get("then", []):
            try:
                etype = parse_effect(e)
            except ValueError:
                continue
            yield t, c, etype