"""Compile OpenCode variations into the fallback pool's ZIP + description layout."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
import zipfile
from pathlib import Path

from .generated_games import GeneratedGame
from .question_contract import normalize_game_questions


PACKAGE_RUNTIME = "logicade_opencode_game"
PACKAGE_SCHEMA_VERSION = 1


_GAME_ONLY_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="dark">
  <title>LogiCade Game</title>
  <link rel="stylesheet" href="/game-runtime/engine/styles.css">
  <style>
    html, body { width:100%; height:100%; min-height:0; margin:0; overflow:hidden; }
    body { display:block; padding:0; }
    #game-root { position:fixed; inset:0; width:100vw; height:100dvh; min-height:0; aspect-ratio:auto; border-radius:0; }
    #game-root .arcade { min-height:100%; padding:clamp(10px,2vw,24px); }
    #game-root .arcade-stage { min-height:0; }
    #game-root .arcade-scene { min-height:clamp(160px,35vh,360px); }
    #game-root .arcade-actions a { display:none !important; }
    .fatal { position:fixed; inset:0; z-index:10; display:grid; place-items:center; padding:24px; background:#070d17; color:#fff; font:16px/1.5 system-ui,sans-serif; }
  </style>
</head>
<body>
  <div id="game-root" data-variation="./variation.json" data-questions="./questions.json" data-manifest="/game-runtime/public/data/asset_manifest.json" data-asset-base="/game-runtime/public/" data-catalog=""></div>
  <div id="fatal-error" class="fatal" role="alert" hidden><div><strong>The game could not start.</strong><span id="fatal-error-message"></span></div></div>
  <p class="sr-only" id="sr-status" role="status" aria-live="polite"></p>
  <p class="sr-only" id="sr-question" aria-live="polite"></p>
  <p class="sr-only" id="sr-feedback" aria-live="polite"></p>
  <script type="module" src="/game-runtime/engine/play.js"></script>
</body>
</html>
"""


def _json_bytes(value: dict) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, raw_temp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temp = Path(raw_temp)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def _backup_previous_package(source_json: Path, pool_root: Path, archive: Path, backup_root: Path) -> None:
    if not archive.is_file():
        return
    try:
        with zipfile.ZipFile(archive) as bundle:
            manifest = json.loads(bundle.read("package_manifest.json").decode("utf-8"))
        if manifest.get("runtime") == PACKAGE_RUNTIME:
            return
    except (OSError, zipfile.BadZipFile, KeyError, UnicodeDecodeError, json.JSONDecodeError):
        pass
    relative = source_json.resolve().relative_to(pool_root.resolve()).with_suffix(".zip")
    backup = backup_root / relative
    if backup.exists():
        return
    backup.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(archive, backup)


def compile_generated_package(
    *,
    source_json: Path,
    pool_root: Path,
    runtime_root: Path,
    game: GeneratedGame,
    description: dict,
    spec: dict,
    backup_root: Path,
) -> dict:
    """Write a compact game ZIP beside its source description JSON.

    The engine and art remain in the shared, read-only runtime directory.
    This ZIP contains only game-specific data and its launcher, so common
    assets are not duplicated in every variation or extracted lease.
    """
    pool = pool_root.resolve()
    source = source_json.resolve()
    runtime = runtime_root.resolve()
    if not source.is_relative_to(pool) or source.suffix.lower() != ".json":
        raise ValueError("game description is outside the fallback pool")
    if not game.variation_path.resolve().is_relative_to(runtime):
        raise ValueError("OpenCode variation is outside the configured game library")
    engine = runtime / "engine"
    public = runtime / "public"
    if not engine.is_dir() or not public.is_dir():
        raise ValueError("OpenCode game library is missing its shared engine or public assets")

    try:
        authored = json.loads(game.variation_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError("OpenCode variation metadata is unreadable") from exc
    if not isinstance(authored, dict) or not isinstance(description.get("questions"), list):
        raise ValueError("OpenCode variation or its question bank is malformed")
    canonical_questions = normalize_game_questions(description["questions"])

    variation = dict(authored)
    variation["question_bank"] = "./questions.json"
    variation["urls"] = {}
    variation["study_context"] = {
        "week": int(spec.get("week") or 1),
        "level": int(spec.get("level") or 1),
        "difficulty": str(spec.get("difficulty") or "standard"),
        "source_file_id": str(spec.get("file_id") or spec.get("game_id") or ""),
    }
    package_description = {
        **description,
        "questions": canonical_questions,
        "file_id": str(spec.get("file_id") or spec.get("game_id") or ""),
        "week": int(spec.get("week") or 1),
        "level": int(spec.get("level") or 1),
        "difficulty": str(spec.get("difficulty") or "standard"),
        "game_id": game.game_id,
        "variation_id": game.variation_id,
        "variation_title": game.variation_title,
        "target": game.target,
    }
    questions = {
        "learning_target": game.target,
        "questions": canonical_questions,
    }
    manifest = {
        "schema_version": PACKAGE_SCHEMA_VERSION,
        "runtime": PACKAGE_RUNTIME,
        "archive": source.with_suffix(".zip").name,
        "source_file_id": package_description["file_id"],
        "week": package_description["week"],
        "level": package_description["level"],
        "difficulty": package_description["difficulty"],
        "game_id": game.game_id,
        "game_slug": game.slug,
        "game_title": game.display_name,
        "variation_id": game.variation_id,
        "variation_title": game.variation_title,
        "description_file": source.with_name(f"{source.stem}.description.json").name,
        "question_count": len(questions["questions"]),
    }
    manifest["content_sha256"] = hashlib.sha256(
        _json_bytes(variation) + _json_bytes(package_description) + _json_bytes(questions)
    ).hexdigest()

    archive = source.with_suffix(".zip")
    description_path = source.with_name(f"{source.stem}.description.json")
    manifest_path = source.with_name(f"{source.stem}.manifest.json")
    _backup_previous_package(source, pool, archive, backup_root)

    # Keep the searchable description and package manifest beside the existing
    # fallback JSON, then atomically replace the same-stem ZIP.
    _atomic_write(description_path, _json_bytes(package_description))
    _atomic_write(manifest_path, _json_bytes(manifest))
    archive.parent.mkdir(parents=True, exist_ok=True)
    fd, raw_temp = tempfile.mkstemp(prefix=f".{archive.name}.", suffix=".tmp", dir=archive.parent)
    os.close(fd)
    temp = Path(raw_temp)
    try:
        with zipfile.ZipFile(temp, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
            bundle.writestr("index.html", _GAME_ONLY_HTML)
            bundle.writestr("variation.json", _json_bytes(variation))
            bundle.writestr("questions.json", _json_bytes(questions))
            bundle.writestr("description.json", _json_bytes(package_description))
            bundle.writestr("package_manifest.json", _json_bytes(manifest))
        os.replace(temp, archive)
    finally:
        temp.unlink(missing_ok=True)

    return {
        "archive": archive.name,
        "description_file": description_path.name,
        "manifest_file": manifest_path.name,
        "manifest": manifest,
        "description": package_description,
    }
