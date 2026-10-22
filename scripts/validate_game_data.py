"""Read-only integrity check for the catalogue and both game JSON families."""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
POOL = DATA / "fallback_pool"
TEMPLATES = DATA / "fallback_templates"

POOL_REQUIRED = {
    "file_id", "game_title", "game_concept", "genre", "theme",
    "core_gameplay_loop", "primary_mechanic", "secondary_mechanics",
    "player_objective", "controls", "win_condition", "lose_condition",
    "difficulty", "estimated_play_time_minutes", "learning_alignment",
    "assets_style", "unique_identity_key", "duplicate_check_notes", "week",
    "level", "trial", "topic", "region", "code_snippet", "game_settings", "tutorial",
}
TEMPLATE_REQUIRED = {
    "template_id", "is_fallback", "fallback_for", "file_id", "game_title",
    "game_concept", "genre", "theme", "core_gameplay_loop", "primary_mechanic",
    "secondary_mechanics", "player_objective", "controls", "win_condition",
    "lose_condition", "difficulty", "week", "level", "topic", "region",
    "learning_objectives", "assets", "game_settings", "ui", "rules", "waves",
    "win", "lose", "hint", "tutorial", "feedback", "accessibility",
}
DIFFICULTY = {
    "need assistance": "needs_support", "needs support": "needs_support", "needassistance": "needs_support",
    "needs_support": "needs_support", "advance": "advanced",
    "advanced": "advanced", "standard": "standard",
}


def read_json(path: Path, errors: list[str]):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception as exc:  # report every corrupt item in one pass
        errors.append(f"{path.relative_to(ROOT)}: invalid JSON ({exc})")
        return None


def index_pool_files() -> dict[str, Path]:
    """Index game JSON by its embedded identity; folder layout supplies location."""
    files: dict[str, Path] = {}
    for path in POOL.glob("week_*/level*/*/*.json"):
        spec = read_json(path, [])
        if isinstance(spec, dict) and spec.get("file_id"):
            files[str(spec["file_id"])] = path
    return files


def validate() -> tuple[int, int, list[str]]:
    errors: list[str] = []
    manifest = read_json(DATA / "manifest.json", errors)
    if not isinstance(manifest, list):
        return 0, 0, errors + ["data/manifest.json must be an array"]

    ids: set[str] = set()
    identities: set[str] = set()
    buckets: Counter[tuple[int, int, str]] = Counter()
    pool_files = index_pool_files()
    for entry in manifest:
        required = {"file_id", "unique_identity_key", "week", "level", "difficulty", "primary_mechanic", "mission_type"}
        missing = required - set(entry)
        if missing:
            errors.append(f"manifest entry missing fields: {sorted(missing)}")
            continue
        if entry["file_id"] in ids:
            errors.append(f"duplicate game id: {entry['file_id']}")
        ids.add(entry["file_id"])
        if entry["unique_identity_key"] in identities:
            errors.append(f"duplicate identity: {entry['unique_identity_key']}")
        identities.add(entry["unique_identity_key"])
        difficulty = DIFFICULTY.get(str(entry["difficulty"]).replace("-", " ").lower().replace("_", " "), DIFFICULTY.get(str(entry["difficulty"]).lower()))
        if not difficulty:
            errors.append(f"{entry['file_id']}: unknown difficulty {entry['difficulty']!r}")
            continue
        buckets[(int(entry["week"]), int(entry["level"]), difficulty)] += 1
        file_path = pool_files.get(str(entry["file_id"]))
        expected_dir = POOL / f"week_{int(entry['week'])}" / f"level{int(entry['level'])}" / difficulty
        if file_path is None or file_path.parent.resolve() != expected_dir.resolve():
            errors.append(f"{entry['file_id']}: no matching JSON in {expected_dir.relative_to(ROOT)}")
            continue
        spec = read_json(file_path, errors)
        if not isinstance(spec, dict):
            errors.append(f"{entry['file_id']}: game definition is not an object")
            continue
        missing = POOL_REQUIRED - set(spec)
        if missing:
            errors.append(f"{entry['file_id']}: missing game fields {sorted(missing)}")
        if spec.get("file_id") != entry["file_id"]:
            errors.append(f"{entry['file_id']}: manifest id does not match definition")
        if spec.get("unique_identity_key") != entry["unique_identity_key"]:
            errors.append(f"{entry['file_id']}: identity does not match manifest")
        if not isinstance(spec.get("game_settings"), dict):
            errors.append(f"{entry['file_id']}: game_settings must be an object")
        if not isinstance(spec.get("tutorial"), list):
            errors.append(f"{entry['file_id']}: tutorial must be an array")

    expected_buckets = {(week, level, difficulty) for week in range(1, 10) for level in range(1, 11) for difficulty in ("needs_support", "standard", "advanced")}
    for missing in sorted(expected_buckets - set(buckets)):
        errors.append(f"missing catalogue bucket: {missing}")

    template_count = 0
    template_ids: set[str] = set()
    for path in TEMPLATES.rglob("*.json"):
        template_count += 1
        spec = read_json(path, errors)
        if not isinstance(spec, dict):
            continue
        missing = TEMPLATE_REQUIRED - set(spec)
        if missing:
            errors.append(f"{path.relative_to(ROOT)}: missing template fields {sorted(missing)}")
        template_id = spec.get("template_id")
        if template_id in template_ids:
            errors.append(f"duplicate template id: {template_id}")
        template_ids.add(template_id)
        for field in ("rules", "waves", "tutorial", "learning_objectives"):
            if field in spec and not isinstance(spec[field], list):
                errors.append(f"{path.relative_to(ROOT)}: {field} must be an array")

    return len(manifest), template_count, errors


if __name__ == "__main__":
    game_count, template_count, issues = validate()
    print(f"Checked {game_count} games and {template_count} fallback templates.")
    if issues:
        print(f"Found {len(issues)} issue(s):")
        for issue in issues[:100]:
            print(f" - {issue}")
        if len(issues) > 100:
            print(f" - ... {len(issues) - 100} additional issue(s)")
        raise SystemExit(1)
    print("All identity lookups, directory buckets, and required data fields are valid.")
