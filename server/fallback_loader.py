"""Manifest-backed fallback game loader — §14/§15.

Uses the week/level/difficulty directory layout to locate files, then uses
the manifest for identity and game metadata. Pool files are indexed once
by their embedded file_id; manifest entries do not store filesystem paths.

Missing / malformed files are logged into `Registry.missing` /
`invalid_entries` / `duplicate_entries`, never fatal.

`stats()` returns a plain dict — matches `server/main.py`'s usage
`s = reg.stats(); s['total']`.

Diagnostic CLI:
    python -m server.fallback_loader
    python -m server.fallback_loader --list-mechanics
    python -m server.fallback_loader --bucket-report
    python -m server.fallback_loader --inspect week=4,level=1,diff=standard
    python -m server.fallback_loader --inspect week=4,level=1,diff=standard --pick-seed=alice
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path
from typing import Iterator

REPO_ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = REPO_ROOT / "data" / "manifest.json"

# Manifest `difficulty` field: "Need Assistance" / "Standard" / "Advance"
# API contract:                 "needs_support"   / "standard" / "advanced"
_DIFFICULTY_ALIASES = {
    "need assistance": "needs_support",
    "needassistance":  "needs_support",
    "need-assistance": "needs_support",
    "needsupport":     "needs_support",
    "needs_support":   "needs_support",
    "standard":        "standard",
    "advance":         "advanced",
    "advanced":        "advanced",
}

# Canonical on-disk directory name for each API token.
_ON_DISK_DIRNAME = {
    "needs_support": "needs_support",
    "standard":      "standard",
    "advanced":      "advanced",
}

_GAME_TEXT_FIELDS = (
    "file_id", "game_title", "game_concept", "genre", "theme",
    "core_gameplay_loop", "primary_mechanic", "player_objective", "controls",
    "win_condition", "lose_condition", "learning_alignment", "unique_identity_key",
    "topic", "code_snippet",
)
_GAME_ARRAY_FIELDS = ("secondary_mechanics", "tutorial")
_MISSION_TYPES = {
    "Survival Siege", "Streak Challenge", "Resource Rush", "Rival Race", "Efficiency Trial",
}


def validate_game_definition(entry: dict, spec: dict) -> str | None:
    """Validate the primary catalogue schema without constraining game prose."""
    missing = [field for field in _GAME_TEXT_FIELDS if not isinstance(spec.get(field), str) or not spec[field].strip()]
    if missing:
        return f"missing or invalid text fields: {', '.join(missing)}"
    if not all(isinstance(spec.get(field), list) for field in _GAME_ARRAY_FIELDS):
        return "secondary_mechanics and tutorial must be arrays"
    if not isinstance(spec.get("region"), dict) or not isinstance(spec.get("game_settings"), dict):
        return "region and game_settings must be objects"
    try:
        if int(spec.get("week")) != int(entry["week"]) or int(spec.get("level")) != int(entry["level"]):
            return "week/level does not match the game manifest"
        if _norm_difficulty(spec.get("difficulty", "")) != _norm_difficulty(entry["difficulty"]):
            return "difficulty does not match the game manifest"
    except (TypeError, ValueError, KeyError):
        return "week, level, or difficulty is invalid"
    if spec["file_id"] != entry.get("file_id"):
        return "file_id does not match the game manifest"
    if spec["unique_identity_key"] != entry.get("unique_identity_key"):
        return "unique_identity_key does not match the game manifest"
    if entry.get("mission_type") not in _MISSION_TYPES:
        return "mission_type is not supported by a registered game module"
    if not all(isinstance(value, (int, float, str, bool))
               for value in spec["game_settings"].values()):
        return "game_settings values must be scalar"
    return None


def _norm_difficulty(raw: str) -> str:
    key = raw.replace("_", " ").replace("-", " ").lower().strip()
    try:
        return _DIFFICULTY_ALIASES[key]
    except KeyError:
        raise ValueError(f"unknown difficulty token {raw!r}")


def _index_pool_files(repo_root: Path) -> tuple[dict[str, Path], set[str]]:
    """Index nested fallback files by embedded identity, without manifest paths."""
    pool_root = repo_root / "data" / "fallback_pool"
    by_id: dict[str, Path] = {}
    duplicates: set[str] = set()
    if not pool_root.is_dir():
        return by_id, duplicates
    for path in pool_root.glob("week_*/level*/*/*.json"):
        try:
            spec = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        file_id = str(spec.get("file_id") or "") if isinstance(spec, dict) else ""
        if not file_id:
            continue
        if file_id in by_id:
            duplicates.add(file_id)
            by_id.pop(file_id, None)
        elif file_id not in duplicates:
            by_id[file_id] = path
    return by_id, duplicates


def _resolve_path(repo_root: Path, entry: dict, indexed_paths: dict[str, Path]) -> Path | None:
    """Find an identity only inside its expected week/level/difficulty folder."""
    try:
        week = int(entry["week"])
        level = int(entry["level"])
        difficulty = _norm_difficulty(entry["difficulty"])
    except (KeyError, TypeError, ValueError):
        return None
    expected_dir = repo_root / "data" / "fallback_pool" / f"week_{week}" / f"level{level}" / _ON_DISK_DIRNAME[difficulty]
    path = indexed_paths.get(str(entry.get("file_id") or ""))
    if path is None:
        return None
    try:
        return path if path.parent.resolve() == expected_dir.resolve() else None
    except OSError:
        return None


class Registry:
    def __init__(self) -> None:
        self.by_identity: dict[str, dict] = {}
        self.by_id: dict[str, dict] = {}
        self.by_wl: dict[tuple[int, int, str], list[dict]] = {}
        self.by_week: dict[tuple[int, str], list[dict]] = {}
        self.by_mechanic: dict[str, list[dict]] = {}

        self.attempted = 0
        self.loaded = 0
        self.invalid = 0
        self.dups = 0
        self.recovered = 0           # files found via layers 2/3

        self.missing: list[str] = []
        self.invalid_entries: list[str] = []
        self.duplicate_entries: list[str] = []

    def add(self, entry: dict, spec: dict) -> None:
        diff = _norm_difficulty(entry["difficulty"])
        week = int(entry["week"])
        level = int(entry["level"])

        indexed = {
            **spec,
            "id": entry["file_id"],
            # The game manifest owns these fields. Keep them at the top level
            # for the runtime while retaining the richer metadata envelope.
            "mission_type": entry["mission_type"],
            "game_type": entry["mission_type"],
            "week": week,
            "level": level,
            "difficulty": diff,
            "unique_identity_key": entry["unique_identity_key"],
            "source_path": entry["source_path"],
            "metadata": {
                "week": week,
                "level": level,
                "difficulty": diff,
                "mechanic": entry["primary_mechanic"],
                "theme": entry["theme"],
                "region": entry["region"],
                "mission_type": entry["mission_type"],
                "trial": int(entry["trial"]),
            },
        }

        key = indexed["unique_identity_key"]
        if key in self.by_identity:
            self.dups += 1
            raise ValueError(
                f"duplicate unique_identity_key {key} "
                f"(file_id={entry['file_id']})"
            )

        self.by_identity[key] = indexed
        indexed["game_id"] = entry["file_id"]
        self.by_id[entry["file_id"]] = indexed
        self.by_wl.setdefault((week, level, diff), []).append(indexed)
        self.by_week.setdefault((week, diff), []).append(indexed)
        self.by_mechanic.setdefault(
            entry["primary_mechanic"], []
        ).append(indexed)
        self.loaded += 1

    def record_missing(self, file_id: str, path: str, reason: str) -> None:
        self.missing.append(f"{file_id}: {path} ({reason})")

    def get(self, week: int, level: int, difficulty: str) -> list[dict]:
        return self.by_wl.get((week, level, difficulty), [])

    def get_week(self, week: int, difficulty: str) -> list[dict]:
        return self.by_week.get((week, difficulty), [])

    def get_by_id(self, game_id: str) -> dict | None:
        return self.by_id.get(game_id) or self.by_identity.get(game_id)

    @staticmethod
    def _summary(spec: dict) -> dict:
        metadata = spec.get("metadata", {})
        return {
            "id": spec.get("game_id", spec.get("id")),
            "title": spec.get("game_title", "Untitled game"),
            "week": metadata.get("week", spec.get("week")),
            "level": metadata.get("level", spec.get("level")),
            "difficulty": metadata.get("difficulty", spec.get("difficulty")),
            "topic": spec.get("topic"),
            "mechanic": metadata.get("mechanic", spec.get("primary_mechanic")),
            "mission_type": metadata.get("mission_type", spec.get("mission_type")),
            "genre": spec.get("genre"),
            "region": metadata.get("region", spec.get("region")),
            "source_path": spec.get("source_path"),
        }

    def list_games(
        self, *, week: int | None = None, level: int | None = None,
        difficulty: str | None = None, mechanic: str | None = None,
        mission_type: str | None = None, search: str | None = None,
    ) -> list[dict]:
        """Return compact catalogue rows; full game definitions stay lazy."""
        normalized = _norm_difficulty(difficulty) if difficulty else None
        query = (search or "").casefold().strip()
        mechanic_query = (mechanic or "").casefold().strip()
        mission_query = (mission_type or "").casefold().strip()
        out = []
        for spec in self.by_identity.values():
            row = self._summary(spec)
            if week is not None and row["week"] != week:
                continue
            if level is not None and row["level"] != level:
                continue
            if normalized and row["difficulty"] != normalized:
                continue
            if mechanic_query and mechanic_query not in str(row["mechanic"]).casefold():
                continue
            if mission_query and mission_query not in str(row["mission_type"]).casefold():
                continue
            if query and query not in " ".join(str(v) for v in row.values()).casefold():
                continue
            out.append(row)
        out.sort(key=lambda row: (row["week"] or 0, row["level"] or 0, row["id"] or ""))
        return out

    def mechanics(self) -> list[dict]:
        counts: dict[str, dict] = {}
        for spec in self.by_identity.values():
            row = self._summary(spec)
            name = row["mechanic"] or "Unknown"
            item = counts.setdefault(name, {"name": name, "count": 0, "topics": set(), "mission_types": set()})
            item["count"] += 1
            if row["topic"]:
                item["topics"].add(row["topic"])
            if row["mission_type"]:
                item["mission_types"].add(row["mission_type"])
        return [
            {**item, "topics": sorted(item["topics"]), "mission_types": sorted(item["mission_types"])}
            for item in sorted(counts.values(), key=lambda value: value["name"].casefold())
        ]

    def pick(
        self, week: int, level: int, difficulty: str,
        *, seed: str | None = None,
    ) -> dict | None:
        pool = self.get(week, level, difficulty)
        if not pool:
            return None
        if seed is None:
            return random.choice(pool)
        rng = random.Random(f"{seed}:{week}:{level}:{difficulty}")
        return rng.choice(pool)

    def iter_buckets(self) -> Iterator[tuple[tuple[int, int, str], list[dict]]]:
        yield from self.by_wl.items()

    def stats(self) -> dict:
        return {
            "attempted": self.attempted,
            "total": self.loaded,
            "recovered": self.recovered,
            "missing": len(self.missing),
            "invalid": self.invalid,
            "dups": self.dups,
            "unique_mechanics": len(self.by_mechanic),
            "mechanics": sorted(self.by_mechanic.keys()),
            "buckets": {
                f"w{w}_l{l}_{d}": len(v)
                for (w, l, d), v in self.by_wl.items()
            },
        }


def load_registry(repo_root: Path | None = None) -> Registry:
    repo_root = repo_root or REPO_ROOT
    manifest_path = repo_root / "data" / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"manifest not found: {manifest_path}")

    entries = json.loads(manifest_path.read_text(encoding="utf-8"))
    reg = Registry()
    reg.attempted = len(entries)
    indexed_paths, duplicate_file_ids = _index_pool_files(repo_root)
    if duplicate_file_ids:
        print(f"[manifest] duplicate file_id values in fallback files: {len(duplicate_file_ids)}")

    for entry in entries:
        file_path = _resolve_path(repo_root, entry, indexed_paths)
        if file_path is None:
            expected = repo_root / "data" / "fallback_pool" / f"week_{entry.get('week')}" / f"level{entry.get('level')}"
            reg.record_missing(entry["file_id"], str(expected), "no matching file_id under its week/level/difficulty folder")
            continue
        runtime_entry = {**entry, "source_path": file_path.relative_to(repo_root).as_posix()}

        try:
            spec = json.loads(file_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            reg.invalid += 1
            reg.invalid_entries.append(
                f"{entry['file_id']}: {file_path} (bad JSON: {exc})"
            )
            continue
        if not isinstance(spec, dict):
            reg.invalid += 1
            reg.invalid_entries.append(
                f"{entry['file_id']}: {file_path} (not a JSON object)"
            )
            continue
        validation_error = validate_game_definition(runtime_entry, spec)
        if validation_error:
            reg.invalid += 1
            reg.invalid_entries.append(f"{entry['file_id']}: {file_path} ({validation_error})")
            continue
        try:
            reg.add(runtime_entry, spec)
        except ValueError as exc:
            reg.duplicate_entries.append(
                f"{entry['file_id']}: {file_path} ({exc})"
            )

    return reg


def _log_summary(reg: Registry) -> None:
    s = reg.stats()
    print(
        f"[manifest] loaded {s['total']}/{s['attempted']} "
        f"({s['recovered']} recovered via path substitution, "
        f"{s['missing']} missing, {s['invalid']} invalid, "
        f"{s['dups']} dup keys, {s['unique_mechanics']} mechanics)"
    )
    if reg.missing:
        print(f"[manifest] ⚠️  {len(reg.missing)} missing files, first 5:")
        for line in reg.missing[:5]:
            print(f"[manifest]     {line}")
    if reg.invalid_entries:
        print(
            f"[manifest] ⚠️  {len(reg.invalid_entries)} invalid files, "
            f"first 5:"
        )
        for line in reg.invalid_entries[:5]:
            print(f"[manifest]     {line}")
    if reg.duplicate_entries:
        print(
            f"[manifest] ⚠️  {len(reg.duplicate_entries)} dup-keys, "
            f"first 5:"
        )
        for line in reg.duplicate_entries[:5]:
            print(f"[manifest]     {line}")


def _cli() -> int:
    parser = argparse.ArgumentParser(
        description="Load data/manifest.json and verify the fallback pool.",
    )
    parser.add_argument("--inspect", metavar="k=v,k=v,...",
                        help="e.g. week=4,level=1,diff=standard")
    parser.add_argument("--list-mechanics", action="store_true")
    parser.add_argument("--bucket-report", action="store_true")
    parser.add_argument("--pick-seed", metavar="STUDENT_ID")
    args = parser.parse_args()

    try:
        reg = load_registry()
    except Exception as exc:
        print(f"❌ failed to load registry: {exc}", file=sys.stderr)
        return 1

    _log_summary(reg)

    if args.list_mechanics:
        print("\nMechanics:")
        for mech in sorted(reg.by_mechanic):
            print(f"  {mech:<30} {len(reg.by_mechanic[mech])}")

    if args.bucket_report:
        print("\nBuckets (week, level, difficulty) -> size:")
        for (w, l, d), specs in reg.iter_buckets():
            print(f"  w{w}_l{l:<2} {d:<14} {len(specs)}")

    if args.inspect:
        try:
            kv = dict(
                pair.split("=", 1) for pair in args.inspect.split(",")
            )
            week = int(kv["week"])
            level = int(kv["level"])
            diff = kv.get("diff") or kv.get("difficulty") or "standard"
        except (KeyError, ValueError) as exc:
            print(
                f"❌ --inspect needs week=, level=, diff= (bad: {exc})",
                file=sys.stderr,
            )
            return 1

        candidates = reg.get(week, level, diff)
        print(
            f"\nInspect w={week} l={level} d={diff}: "
            f"{len(candidates)} candidate(s)"
        )
        for spec in candidates:
            print(
                f"  {spec['id']:<12} "
                f"{spec['metadata']['mechanic']:<25} "
                f"trial={spec['metadata']['trial']:>2} "
                f"({spec['source_path']})"
            )

        if args.pick_seed:
            pick = reg.pick(week, level, diff, seed=args.pick_seed)
            if pick:
                print(
                    f"\n  🎯 pick(seed={args.pick_seed!r}): "
                    f"{pick['id']} — {pick['metadata']['mechanic']}"
                )

    return 0


if __name__ == "__main__":
    sys.exit(_cli())
