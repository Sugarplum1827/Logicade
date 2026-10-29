"""Package a static game build in its project and LogiCade catalog locations.

The source must be a static build directory whose root contains index.html
(usually dist/). It creates <project-name>.zip and copies the description JSON
into the project root, then installs the canonical same-stem ZIP beside the
catalog JSON. It refuses to replace existing output unless --replace is used.
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
POOL = (ROOT / "data" / "fallback_pool").resolve()
MAX_ARCHIVE_BYTES = 100 * 1024 * 1024
MAX_EXPANDED_BYTES = 300 * 1024 * 1024
MAX_FILES = 5000
MAX_MEMBER_BYTES = 80 * 1024 * 1024

FILENAME = re.compile(
    r"^game_week(?P<week>\d+)_level(?P<level>\d+)_difficulty\((?P<difficulty>NeedAssistance|Standard|Advance)\)_(?P<slot>[1-9]\d*)\.json$"
)
FOLDER_DIFFICULTY = {
    "needs_support": "NeedAssistance",
    "standard": "Standard",
    "advanced": "Advance",
}
DIFFICULTY_ALIASES = {
    "needsupport": "NeedAssistance", "needassistance": "NeedAssistance",
    "standard": "Standard", "advanced": "Advance", "advance": "Advance",
}


def validate_target(json_path: Path) -> Path:
    path = json_path.resolve()
    if not path.is_relative_to(POOL) or not path.is_file() or path.suffix.lower() != ".json":
        raise ValueError("target must be an existing .json file inside data/fallback_pool")
    match = FILENAME.fullmatch(path.name)
    if not match:
        raise ValueError("target JSON must use the canonical numbered LogiCade filename")
    try:
        week_dir = re.fullmatch(r"week_(\d+)", path.parent.parent.parent.name)
        level_dir = re.fullmatch(r"level(\d+)", path.parent.parent.name)
        folder_difficulty = FOLDER_DIFFICULTY[path.parent.name]
        spec = json.loads(path.read_text(encoding="utf-8"))
        spec_difficulty = str(spec.get("difficulty", "")).strip().lower().replace(" ", "").replace("_", "")
        identity = (int(spec["week"]), int(spec["level"]), DIFFICULTY_ALIASES[spec_difficulty])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise ValueError(f"target JSON has invalid week/level/difficulty metadata: {path.name}") from exc
    if not week_dir or not level_dir:
        raise ValueError("target must be under week_N/levelN/difficulty/")
    folder_identity = (int(week_dir.group(1)), int(level_dir.group(1)), folder_difficulty)
    filename_identity = (int(match["week"]), int(match["level"]), match["difficulty"])
    if identity != folder_identity or identity != filename_identity:
        raise ValueError("target JSON metadata, filename, and folder week/level/difficulty must agree")
    return path.with_suffix(".zip")


def collect_build_files(build_dir: Path) -> list[tuple[Path, str]]:
    root = build_dir.resolve()
    if not root.is_dir():
        raise ValueError(f"build folder does not exist: {root}")
    files: list[tuple[Path, str]] = []
    seen: set[str] = set()
    total_bytes = 0
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"symbolic links are not permitted in a game build: {path}")
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        key = relative.casefold()
        if key in seen:
            raise ValueError(f"duplicate case-insensitive path in build: {relative}")
        seen.add(key)
        size = path.stat().st_size
        if size > MAX_MEMBER_BYTES:
            raise ValueError(f"build file exceeds the 80 MiB per-file limit: {relative}")
        total_bytes += size
        if total_bytes > MAX_EXPANDED_BYTES:
            raise ValueError("build exceeds the 300 MiB expanded-size limit")
        files.append((path, relative))
        if len(files) > MAX_FILES:
            raise ValueError(f"build has more than {MAX_FILES} files")
    if not any(relative == "index.html" for _, relative in files):
        raise ValueError("build folder must contain index.html at its root (select the static output folder, usually dist/)")
    return files


def package_build(build_dir: Path, json_path: Path, replace: bool) -> tuple[Path, Path, Path]:
    catalog_archive = validate_target(json_path)
    description = json_path.resolve()
    build_root = build_dir.resolve()
    project_dir = build_root.parent
    exports_root = (ROOT / "data" / "game_build_workspaces").resolve()
    if not project_dir.is_relative_to(exports_root):
        raise ValueError("build directory must be inside a project under data/game_build_workspaces")
    project_archive = project_dir / f"{project_dir.name}.zip"
    project_description = project_dir / description.name
    outputs = (project_archive, catalog_archive)
    for output in outputs:
        if output.exists() and not replace:
            raise FileExistsError(f"output already exists; pass --replace to update it: {output}")
    if project_description.exists() and project_description.read_bytes() != description.read_bytes() and not replace:
        raise FileExistsError(
            f"project description differs from the catalog JSON; pass --replace to update it: {project_description}"
        )

    files = collect_build_files(build_root)
    catalog_archive.parent.mkdir(parents=True, exist_ok=True)
    project_dir.mkdir(parents=True, exist_ok=True)
    staged: list[tuple[Path, Path]] = []
    try:
        for output in outputs:
            fd, temp_name = tempfile.mkstemp(prefix=f".{output.stem}-", suffix=".tmp", dir=output.parent)
            os.close(fd)
            staged.append((Path(temp_name), output))
        project_temp = staged[0][0]
        catalog_temp = staged[1][0]
        with zipfile.ZipFile(project_temp, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for source, relative in files:
                archive.write(source, arcname=relative)
        archive_size = project_temp.stat().st_size
        if archive_size > MAX_ARCHIVE_BYTES:
            raise ValueError("compressed package exceeds the 100 MiB limit")
        with project_temp.open("rb") as source, catalog_temp.open("wb") as destination:
            while chunk := source.read(1024 * 1024):
                destination.write(chunk)

        description_temp = project_dir / f".{description.name}.tmp"
        description_temp.write_bytes(description.read_bytes())
        # Stage all data before replacing either published archive.
        os.replace(project_temp, project_archive)
        os.replace(catalog_temp, catalog_archive)
        os.replace(description_temp, project_description)
    finally:
        for temp_path, _ in staged:
            temp_path.unlink(missing_ok=True)
        (project_dir / f".{description.name}.tmp").unlink(missing_ok=True)
    return project_archive, project_description, catalog_archive


def build_digest(build_dir: Path) -> str:
    digest = hashlib.sha256()
    for path, relative in collect_build_files(build_dir):
        digest.update(relative.encode("utf-8") + b"\0")
        digest.update(hashlib.sha256(path.read_bytes()).digest())
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build-dir", required=True, type=Path, help="static output folder containing root index.html (usually dist)")
    parser.add_argument("--game-json", required=True, type=Path, help="existing canonical JSON slot under data/fallback_pool")
    parser.add_argument("--replace", action="store_true", help="replace the project ZIP, catalog ZIP, and copied description JSON")
    args = parser.parse_args()
    try:
        project_archive, description, catalog_archive = package_build(args.build_dir, args.game_json, args.replace)
        print(f"Project archive: {project_archive.relative_to(ROOT).as_posix()}")
        print(f"Project description: {description.relative_to(ROOT).as_posix()}")
        print(f"LogiCade catalog archive: {catalog_archive.relative_to(ROOT).as_posix()}")
        print("LogiCade will extract this package only when a learner presses Start.")
        return 0
    except (OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
