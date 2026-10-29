"""Check or normalize fallback-pool JSON filenames to LogiCade's slot scheme.

Canonical filename:
  game_week{week}_level{level}_difficulty({Difficulty})_{slot}.json

The JSON's embedded game identity is preserved when a legacy filename is
renamed. Run with --apply to normalize; without it the command is read-only.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POOL = ROOT / "data" / "fallback_pool"
CANONICAL = re.compile(
    r"^game_week(?P<week>\d+)_level(?P<level>\d+)_difficulty\((?P<difficulty>NeedAssistance|Standard|Advance)\)_(?P<slot>[1-9]\d*)\.json$"
)
FOLDER_DIFFICULTY = {
    "needs_support": "NeedAssistance",
    "standard": "Standard",
    "advanced": "Advance",
}


def _read_object(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path.relative_to(ROOT)} is not a JSON object")
    return value


def _folder_identity(path: Path) -> tuple[int, int, str]:
    try:
        week_match = re.fullmatch(r"week_(\d+)", path.parent.parent.parent.name)
        level_match = re.fullmatch(r"level(\d+)", path.parent.parent.name)
        difficulty = FOLDER_DIFFICULTY[path.parent.name]
    except KeyError as exc:
        raise ValueError(f"unexpected pool folder: {path.parent}") from exc
    if not week_match or not level_match:
        raise ValueError(f"unexpected pool folder: {path.parent}")
    return int(week_match.group(1)), int(level_match.group(1)), difficulty


def _canonical_identity(path: Path) -> tuple[int, int, str, int] | None:
    match = CANONICAL.fullmatch(path.name)
    if not match:
        return None
    week, level, difficulty = _folder_identity(path)
    result = (int(match["week"]), int(match["level"]), match["difficulty"], int(match["slot"]))
    if result[:3] != (week, level, difficulty):
        raise ValueError(f"filename does not match its directory: {path.relative_to(ROOT)}")
    return result


def normalize(apply: bool) -> int:
    if not POOL.is_dir():
        raise FileNotFoundError(f"fallback pool does not exist: {POOL}")

    files = sorted(POOL.glob("week_*/level*/*/*.json"))
    used_slots: dict[tuple[int, int, str], set[int]] = defaultdict(set)
    pending: list[tuple[Path, Path, dict]] = []

    # First validate all existing canonical slots and identities before planning
    # any rename, so a bad file cannot cause a partial migration.
    for path in files:
        identity = _canonical_identity(path)
        if identity:
            used_slots[identity[:3]].add(identity[3])

    for path in files:
        if _canonical_identity(path):
            continue
        spec = _read_object(path)
        week, level, difficulty = _folder_identity(path)
        try:
            spec_identity = (
                int(spec["week"]), int(spec["level"]),
                str(spec["difficulty"]).strip().lower().replace(" ", "").replace("_", ""),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"missing week/level/difficulty in {path.relative_to(ROOT)}") from exc
        difficulty_aliases = {
            "needsupport": "NeedAssistance", "needassistance": "NeedAssistance",
            "standard": "Standard", "advanced": "Advance", "advance": "Advance",
        }
        normalized_difficulty = difficulty_aliases.get(spec_identity[2])
        if (spec_identity[0], spec_identity[1], normalized_difficulty) != (week, level, difficulty):
            raise ValueError(f"JSON metadata does not match pool folder: {path.relative_to(ROOT)}")

        key = (week, level, difficulty)
        slot = max(used_slots[key], default=0) + 1
        while slot in used_slots[key]:
            slot += 1
        used_slots[key].add(slot)
        target = path.with_name(
            f"game_week{week}_level{level}_difficulty({difficulty})_{slot}.json"
        )
        if target.exists():
            raise FileExistsError(f"normalization target already exists: {target.relative_to(ROOT)}")
        pending.append((path, target, spec))

    if not apply:
        for old, new, _ in pending:
            print(f"would rename {old.relative_to(ROOT)} -> {new.relative_to(ROOT)}")
        print(f"checked {len(files)} JSON files; {len(pending)} need canonical names")
        return 1 if pending else 0

    # Targets were checked as a group above. Preserve each payload and update a
    # source_path field only if a caller has embedded one in the JSON.
    for old, new, spec in pending:
        old_rel = old.relative_to(ROOT).as_posix()
        new_rel = new.relative_to(ROOT).as_posix()
        if spec.get("source_path") == old_rel:
            spec["source_path"] = new_rel
            temp = new.with_suffix(".tmp")
            temp.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            os.replace(temp, old)
        old.replace(new)
        print(f"renamed {old_rel} -> {new_rel}")
    print(f"normalized {len(pending)} files; total JSON files: {len(files)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="perform planned renames")
    args = parser.parse_args()
    try:
        return normalize(args.apply)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
