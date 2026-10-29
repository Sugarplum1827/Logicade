"""Safe, lazy extraction helpers for optional static game builds.

An archive is an optional same-stem sidecar to a canonical fallback-pool JSON.
The JSON remains the catalog/spec record; the ZIP must contain index.html at
its root. Each mission preview receives a private extraction lease so it can
be released without interrupting another learner using the same package.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import shutil
import tempfile
import time
import zipfile
from pathlib import Path, PurePosixPath

MAX_ARCHIVE_BYTES = 100 * 1024 * 1024
MAX_EXPANDED_BYTES = 300 * 1024 * 1024
MAX_FILES = 5000
MAX_MEMBER_BYTES = 80 * 1024 * 1024


class PackageError(ValueError):
    """The selected package is malformed or exceeds safe import limits."""


def _safe_member_path(root: Path, name: str) -> Path:
    # ZIP names use slash separators; reject Windows drive paths and traversal
    # before resolving against the extraction directory.
    normalized = name.replace("\\", "/")
    path = PurePosixPath(normalized)
    if path.is_absolute() or not path.parts or any(part in ("", ".", "..") for part in path.parts):
        raise PackageError(f"unsafe archive path: {name[:160]}")
    if ":" in path.parts[0]:
        raise PackageError(f"drive-qualified archive path is not allowed: {name[:160]}")
    target = root.joinpath(*path.parts).resolve()
    if not target.is_relative_to(root.resolve()):
        raise PackageError(f"archive path escapes extraction directory: {name[:160]}")
    return target


def prepare_package(
    source_json: Path,
    pool_root: Path,
    cache_root: Path,
    shared_assets_archive: Path | None = None,
    shared_web_runtime_root: Path | None = None,
    expected_generated_game_id: str | None = None,
    shared_canvas_runtime_root: Path | None = None,
) -> dict | None:
    """Extract a matching ZIP and its shared Phaser or OpenCode runtime."""
    pool_root = pool_root.resolve()
    source_json = source_json.resolve()
    if not source_json.is_relative_to(pool_root) or source_json.suffix.lower() != ".json":
        raise PackageError("game source is outside the fallback pool")
    archive = source_json.with_suffix(".zip")
    has_sidecar = archive.is_file()
    if not has_sidecar:
        if shared_assets_archive is None or not shared_assets_archive.is_file():
            return None
        archive = shared_assets_archive.resolve()
    if archive.stat().st_size > MAX_ARCHIVE_BYTES:
        raise PackageError("game archive exceeds the 100 MiB compressed-size limit")

    phaser_game: dict | None = None
    opencode_manifest: dict | None = None
    if has_sidecar:
        try:
            with zipfile.ZipFile(archive) as bundle:
                try:
                    raw_game = bundle.read("logicade_phaser_game.json")
                except KeyError:
                    raw_game = None
                try:
                    raw_opencode_manifest = bundle.read("package_manifest.json")
                except KeyError:
                    raw_opencode_manifest = None
            if raw_game is not None:
                value = json.loads(raw_game.decode("utf-8"))
                if (not isinstance(value, dict)
                        or value.get("runtime") != "logicade_phaser_template"
                        or value.get("schema_version") != 1
                        or value.get("file_id") != _read_source_file_id(source_json)
                        or not isinstance(value.get("phaser_template"), dict)):
                    raise PackageError("Phaser game package does not match its fallback JSON")
                phaser_game = value
            if raw_opencode_manifest is not None:
                value = json.loads(raw_opencode_manifest.decode("utf-8"))
                native_canvas = isinstance(value, dict) and value.get("runtime") in {
                    "logicade_canvas_game", "logicade_canvas_game_v2"
                }
                canvas_v2 = isinstance(value, dict) and value.get("runtime") == "logicade_canvas_game_v2"
                required = ("index.html", "variation.json", "description.json", "game.json") if canvas_v2 else (
                    ("index.html", "variation.json", "description.json") if native_canvas else (
                    "index.html", "variation.json", "questions.json", "description.json")
                )
                if (not isinstance(value, dict)
                        or value.get("runtime") not in {"logicade_opencode_game", "logicade_canvas_game", "logicade_canvas_game_v2"}
                        or value.get("schema_version") != 1
                        or value.get("source_file_id") != _read_source_file_id(source_json)
                        or not all((archive_name in bundle.namelist()) for archive_name in required)):
                    raise PackageError("Game package does not match its description JSON")
                if expected_generated_game_id and value.get("variation_id") != expected_generated_game_id:
                    raise PackageError("OpenCode game package does not match the selected variation")
                if (shared_canvas_runtime_root if native_canvas else shared_web_runtime_root) is None:
                    raise PackageError("The selected game's shared runtime is not configured")
                opencode_manifest = value
            elif expected_generated_game_id:
                raise PackageError("OpenCode game package has not been compiled for the selected variation")
        except (zipfile.BadZipFile, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise PackageError("game archive is malformed") from exc

    use_shared_assets = phaser_game is not None or not has_sidecar
    archives: list[Path] = []
    if use_shared_assets:
        if shared_assets_archive is None or not shared_assets_archive.is_file():
            if phaser_game is not None:
                # The selected description JSON still supports the regular
                # Phaser renderer. Missing optional extracted assets must not
                # prevent the learner from opening the mission details.
                return None
            return None
        shared = shared_assets_archive.resolve()
        if shared != archive:
            archives.append(shared)
    if has_sidecar:
        archives.append(archive.resolve())
    else:
        archives.append(archive.resolve())
    for item in archives:
        if item.stat().st_size > MAX_ARCHIVE_BYTES:
            raise PackageError("game archive exceeds the 100 MiB compressed-size limit")

    digest = hashlib.sha256()
    for item in archives:
        digest.update(item.name.encode("utf-8"))
        with item.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
    package_hash = digest.hexdigest()
    cache_root.mkdir(parents=True, exist_ok=True)
    # Each preview gets its own extracted directory. A Cancel action can then
    # remove its files without deleting a package another participant is using.
    package_id = f"{package_hash}-{secrets.token_hex(16)}"
    target_root = (cache_root / package_id).resolve()

    staging: Path | None = None
    try:
        staging = Path(tempfile.mkdtemp(prefix=f"{package_hash[:12]}-", dir=cache_root)).resolve()
        expanded = 0
        seen: set[str] = set()
        for item in archives:
            with zipfile.ZipFile(item) as bundle:
                members = bundle.infolist()
                if len(members) > MAX_FILES:
                    raise PackageError(f"archive contains more than {MAX_FILES} entries")
                for member in members:
                    key = member.filename.replace("\\", "/").rstrip("/")
                    # The shared ZIP has its own informational index; for a
                    # catalog game preserve the per-game package's root index.
                    if phaser_game is not None and item != archive.resolve() and key == "index.html":
                        continue
                    if key in seen:
                        raise PackageError(f"duplicate archive path: {member.filename[:160]}")
                    seen.add(key)
                    target = _safe_member_path(staging, member.filename)
                    mode = (member.external_attr >> 16) & 0o170000
                    if mode == 0o120000:
                        raise PackageError("symbolic links are not allowed in game archives")
                    if member.file_size > MAX_MEMBER_BYTES:
                        raise PackageError(f"archive entry is too large: {member.filename[:160]}")
                    expanded += member.file_size
                    if expanded > MAX_EXPANDED_BYTES:
                        raise PackageError("archive exceeds the 300 MiB expanded-size limit")
                    if member.is_dir():
                        target.mkdir(parents=True, exist_ok=True)
                        continue
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with bundle.open(member) as source, target.open("wb") as destination:
                        shutil.copyfileobj(source, destination, length=1024 * 1024)
        if not (staging / "index.html").is_file():
            raise PackageError("game archive must contain index.html at its root")
        if opencode_manifest is not None:
            if opencode_manifest.get("runtime") in {"logicade_canvas_game", "logicade_canvas_game_v2"}:
                runtime_root = shared_canvas_runtime_root.resolve()
                required_runtime = ("runtime/index.html", "runtime/engine.js", "runtime/flowchart-model.js", "runtime/flowchart.js", "runtime/c-runtime.js", "runtime/lesson-guide.js", "runtime/program-model.js", "runtime/program-workbench.js", "runtime/program-workbench.css", "runtime/terminal-network-model.js", "runtime/terminal-network.js", "runtime/terminal-network.css", "assets/manifest.json") if opencode_manifest.get("runtime") == "logicade_canvas_game_v2" else (
                    "index.html", "registry.json", "src/core/GameEngine.js"
                )
                for name in required_runtime:
                    if not (runtime_root / name).is_file():
                        raise PackageError(f"Owned Canvas runtime is missing {name}")
            else:
                runtime_root = shared_web_runtime_root.resolve()
                for directory in ("engine", "public", "vendor"):
                    source = (runtime_root / directory).resolve()
                    if not source.is_relative_to(runtime_root) or not source.is_dir():
                        raise PackageError(f"OpenCode shared runtime is missing {directory}")
                if not (runtime_root / "vendor" / "phaser.esm.min.js").is_file():
                    raise PackageError("OpenCode shared runtime is missing Phaser")
        try:
            os.replace(staging, target_root)
            staging = None
        except PermissionError:
            # Windows indexing/sync software can briefly deny a directory
            # rename. Fall back to copying the completed private extraction.
            shutil.copytree(staging, target_root)
            shutil.rmtree(staging, ignore_errors=True)
            staging = None
        launch_url = f"/game-builds/{package_id}/index.html"
        result = {
            "runtime": "phaser_assets" if use_shared_assets else "html5_package",
            "launch_url": launch_url,
            "package_id": package_id,
            "sha256": package_hash,
            "archive": archive.name,
        }
        if use_shared_assets:
            result["asset_base"] = f"/game-builds/{package_id}/assets/logicade_starter_pack/"
        if phaser_game is not None:
            result["phaser_template"] = phaser_game["phaser_template"]
            result["game_package"] = {
                "file_id": phaser_game["file_id"],
                "template_id": phaser_game["phaser_template"]["template_id"],
                "variation_id": phaser_game["phaser_template"]["variation_id"],
            }
        if opencode_manifest is not None:
            result["generated_game"] = {
                "game_id": opencode_manifest.get("game_id"),
                "slug": opencode_manifest.get("game_slug"),
                "display_name": opencode_manifest.get("game_title"),
                "variation_id": opencode_manifest.get("variation_id"),
                "variation_title": opencode_manifest.get("variation_title"),
                "difficulty": opencode_manifest.get("difficulty"),
            }
        return result
    except zipfile.BadZipFile as exc:
        raise PackageError("game archive is not a valid ZIP file") from exc
    finally:
        if staging is not None:
            shutil.rmtree(staging, ignore_errors=True)


def _read_source_file_id(source_json: Path) -> str | None:
    try:
        value = json.loads(source_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return str(value.get("file_id")) if isinstance(value, dict) and value.get("file_id") else None


def release_package(package_id: str, cache_root: Path) -> bool:
    """Remove one extracted package lease, never the source ZIP or other leases."""
    if not re.fullmatch(r"[a-f0-9]{64}-[a-f0-9]{32}", package_id):
        raise PackageError("invalid extracted package identifier")
    root = cache_root.resolve()
    target = (root / package_id).resolve()
    if target == root or not target.is_relative_to(root):
        raise PackageError("package identifier escaped the extraction cache")
    if not target.exists():
        return False
    if not target.is_dir():
        raise PackageError("extracted package path is not a directory")
    for attempt in range(3):
        try:
            shutil.rmtree(target)
            return True
        except FileNotFoundError:
            # Cancel, navigation, and unmount cleanup may race; releasing an
            # already-removed lease is a successful idempotent operation.
            return False
        except PermissionError:
            if not target.exists():
                return False
            if attempt == 2:
                raise
            time.sleep(0.05 * (attempt + 1))
    return False


def cleanup_expired_packages(cache_root: Path, *, max_age_seconds: int = 24 * 60 * 60) -> int:
    """Remove abandoned package leases left by closed tabs or server crashes."""
    root = cache_root.resolve()
    if not root.is_dir():
        return 0
    cutoff = time.time() - max_age_seconds
    removed = 0
    for child in root.iterdir():
        if not child.is_dir() or not re.fullmatch(r"[a-f0-9]{64}-[a-f0-9]{32}", child.name):
            continue
        try:
            if child.stat().st_mtime < cutoff:
                shutil.rmtree(child)
                removed += 1
        except OSError:
            continue
    return removed
