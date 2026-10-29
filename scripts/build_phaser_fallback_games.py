"""Build one playable Phaser game package beside every cataloged fallback JSON.

Each small ZIP stores the catalog description and a fixed concept/variation
selection. The Phaser engine and CC0 art stay shared and are extracted with the
package at mission preview time, avoiding thousands of duplicated asset copies.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
POOL = DATA / "fallback_pool"
CATALOG = DATA / "manifest.json"
TEMPLATE_ROOT = DATA / "logicade_phaser_templates" / "logicade_phaser_templates"
TEMPLATE_REGISTRY = TEMPLATE_ROOT / "data" / "registry.json"
ASSET_MANIFEST = TEMPLATE_ROOT / "assets" / "logicade_starter_pack" / "asset_manifest.json"
GAME_MARKER = "logicade_phaser_game.json"

DIFFICULTY_DIRS = {
    "Need Assistance": "needs_support",
    "Standard": "standard",
    "Advance": "advanced",
}
FILE_NAME = re.compile(
    r"^game_week(?P<week>\d+)_level(?P<level>\d+)_difficulty\((?P<difficulty>NeedAssistance|Standard|Advance)\)_(?P<slot>[1-9]\d*)\.json$"
)

INDEX_HTML = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LogiCade game package</title></head>
<body><main>This playable Phaser game is launched by LogiCade so gameplay and research events are recorded.</main></body></html>
"""


def js_hash(value: str) -> int:
    """Match client-react/src/game/templates/core.js hash() for catalog IDs."""
    h = 2166136261
    for char in value:
        h ^= ord(char)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def load_object(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path.relative_to(ROOT)}")
    return value


def source_files() -> dict[str, Path]:
    indexed: dict[str, Path] = {}
    for path in POOL.glob("week_*/level*/*/*.json"):
        spec = load_object(path)
        file_id = str(spec.get("file_id") or "")
        if file_id:
            if file_id in indexed:
                raise ValueError(f"Duplicate fallback file_id {file_id}: {indexed[file_id]} and {path}")
            indexed[file_id] = path
    return indexed


def package_record(entry: dict, spec: dict, games: list[dict], themes: dict) -> dict:
    file_id = str(entry["file_id"])
    week, level = int(entry["week"]), int(entry["level"])
    game = games[js_hash(f"{file_id}:0") % len(games)]
    variation = game["variations"][js_hash(f"{file_id}:{week}:{level}:0") % len(game["variations"])]
    template = {
        "template_id": game["template_id"],
        "display_name": game["display_name"],
        "module_family": game["module_family"],
        "render_family": game["render_family"],
        "variation_id": variation["variation_id"],
        "variation_title": variation["title"],
        "template_version": "1.0.0",
        "visual_theme": themes.get(game["template_id"]),
        "run_id": 0,
        "map_id": variation["map_id"],
    }
    return {
        "runtime": "logicade_phaser_template",
        "schema_version": 1,
        "file_id": file_id,
        "week": week,
        "level": level,
        "difficulty": entry["difficulty"],
        "game_title": spec.get("game_title", entry.get("title", file_id)),
        "template_id": game["template_id"],
        "variation_id": variation["variation_id"],
        "description_sha256": hashlib.sha256(
            json.dumps(spec, ensure_ascii=False, sort_keys=True).encode("utf-8")
        ).hexdigest(),
        "phaser_template": template,
    }


def existing_internal_package(path: Path, file_id: str) -> bool:
    try:
        with zipfile.ZipFile(path) as archive:
            record = json.loads(archive.read(GAME_MARKER).decode("utf-8"))
            return record.get("runtime") == "logicade_phaser_template" and record.get("file_id") == file_id
    except (OSError, zipfile.BadZipFile, KeyError, UnicodeDecodeError, json.JSONDecodeError):
        return False


def build(*, replace: bool = False, dry_run: bool = False) -> int:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    templates = load_object(TEMPLATE_REGISTRY)
    assets = load_object(ASSET_MANIFEST)
    entries = catalog if isinstance(catalog, list) else catalog.get("games", [])
    games = templates.get("games", [])
    if len(entries) != 2700:
        raise ValueError(f"Expected 2,700 catalog entries; found {len(entries)}")
    if len(games) != 50 or any(len(game.get("variations", [])) != 10 for game in games):
        raise ValueError("Expected 50 Phaser concepts with exactly 10 variations each")

    indexed = source_files()
    themes = assets.get("template_themes", {})
    if not themes:
        raise ValueError("The Phaser asset manifest has no template theme assignments")

    created = existing = 0
    missing: list[str] = []
    for entry in entries:
        file_id = str(entry["file_id"])
        source = indexed.get(file_id)
        if source is None:
            missing.append(file_id)
            continue
        spec = load_object(source)
        match = FILE_NAME.fullmatch(source.name)
        if not match:
            raise ValueError(f"Non-canonical fallback JSON path: {source.relative_to(ROOT)}")
        if (int(match["week"]) != int(entry["week"])
                or int(match["level"]) != int(entry["level"])
                or match["difficulty"] != str(entry["difficulty"]).replace(" ", "")):
            raise ValueError(f"Fallback file path does not match its catalog record: {source.relative_to(ROOT)}")

        target = source.with_suffix(".zip")
        record = package_record(entry, spec, games, themes)
        if dry_run:
            if not target.exists():
                created += 1
            elif existing_internal_package(target, file_id):
                existing += 1
            else:
                raise FileExistsError(
                    f"Refusing to replace existing non-LogiCade package: {target.relative_to(ROOT)}"
                )
            continue
        if target.exists() and not replace:
            if existing_internal_package(target, file_id):
                existing += 1
                continue
            raise FileExistsError(
                f"Refusing to replace existing non-LogiCade package: {target.relative_to(ROOT)}"
            )

        target.parent.mkdir(parents=True, exist_ok=True)
        fd, temp_name = tempfile.mkstemp(prefix=f".{target.stem}.", suffix=".tmp", dir=target.parent)
        os.close(fd)
        temp_path = Path(temp_name)
        try:
            with zipfile.ZipFile(temp_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=8) as archive:
                archive.writestr("index.html", INDEX_HTML)
                archive.writestr(GAME_MARKER, json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
            with zipfile.ZipFile(temp_path) as archive:
                bad = archive.testzip()
                if bad:
                    raise zipfile.BadZipFile(f"generated archive failed verification at {bad}")
                expected = {"index.html", GAME_MARKER}
                if set(archive.namelist()) != expected:
                    raise zipfile.BadZipFile("generated archive has an unexpected file list")
            os.replace(temp_path, target)
        finally:
            if temp_path.exists():
                temp_path.unlink()
        created += 1

    if missing:
        raise ValueError(f"Missing catalog fallback JSON for {len(missing)} IDs: {', '.join(missing[:10])}")
    verb = "would create" if dry_run else "created"
    print(f"{verb.capitalize()} {created} playable Phaser game packages; kept {existing} existing matching packages.")
    print(f"Catalog total: {len(entries)} games, {len(games)} concepts × 10 variations.")
    return created


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--replace", action="store_true", help="replace existing sidecar ZIPs")
    parser.add_argument("--dry-run", action="store_true", help="validate catalog paths and report package count")
    args = parser.parse_args()
    try:
        build(replace=args.replace, dry_run=args.dry_run)
    except (OSError, ValueError, zipfile.BadZipFile, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
