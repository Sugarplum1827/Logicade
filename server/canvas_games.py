"""Mirrored, data-driven Canvas games and compact ZIP package compiler."""

from __future__ import annotations

import hashlib
import io
import json
import os
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path

PACKAGE_RUNTIME = "logicade_canvas_game_v2"
COURSE_PATH = Path(__file__).resolve().parent.parent / "data" / "curriculum.json"
GAME_MODES = {"welcome_video", "tetris", "circuit", "terminal", "pending", "factory", "dungeon"}
C_NETWORK_CONTROLS = "Write a C main function in every connected node. Use readPort(direction) and writePort(direction, value) from logicade.h. Run or Step highlights C statements and transferred values. Compare the final output with every target stream."


def course_lesson(week: int) -> dict:
    try:
        course = json.loads(COURSE_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"week": week, "title": f"CP1 Week {week}", "objectives": [], "genres": sorted(GAME_MODES)}
    return next((dict(row, curriculum_version=course.get("version"))
                 for row in course.get("weeks", []) if row.get("week") == week), {})


def canonical_difficulty(raw: str) -> str:
    token = str(raw or "standard").lower().replace(" ", "_").replace("-", "_")
    value = {"easy": "needs_support", "need_assistance": "needs_support", "needassistance": "needs_support",
             "normal": "standard", "hard": "advanced", "advance": "advanced"}.get(token, token)
    if value not in {"needs_support", "standard", "advanced"}:
        raise ValueError("Unknown Canvas game difficulty")
    return value


@dataclass(frozen=True)
class CanvasGame:
    game_id: str
    slug: str
    display_name: str
    variation_id: str
    variation_title: str
    index: int
    config: dict
    config_path: Path
    week: int
    level: int
    difficulty: str
    file_id: str

    @property
    def content_revision(self) -> str:
        return hashlib.sha256(json.dumps(self.config,sort_keys=True,separators=(',',':')).encode()).hexdigest()

    def public_info(self) -> dict:
        return {
            "game_id": self.game_id,
            "slug": self.slug,
            "display_name": self.display_name,
            "variation_id": self.variation_id,
            "content_revision": self.content_revision,
            "content_origin": 'llm_verified_pool' if self.config.get('generation',{}).get('runtime_verification',{}).get('passed') else 'authored_fallback_pool',
            "served_from_pool": True,
            "variation_title": self.variation_title,
            "index": self.index,
            "seed": self.config.get('seed'),
            "runtime": "native_canvas",
            "template_version": "2.0.0",
            "curriculum_version": self.config.get('curriculum_version') or course_lesson(self.week).get("curriculum_version"),
            "week": self.week,
            "level": self.level,
            "difficulty": self.difficulty,
            "mode": self.slug,
            "mechanic_family": self.config.get('programming', {}).get('family', self.slug),
            "mission_schema_version": self.config.get('programming', {}).get('version'),
            "control_flow_type": self.config.get('programming', {}).get('controller', {}).get('required_kind'),
            "map_features": self.config.get('programming', {}).get('map_features'),
            "routing_topology": self.config.get('programming', {}).get('routing', {}).get('topology'),
            "branch_targets": self.config.get('programming', {}).get('routing', {}).get('targets'),
            "source_week": self.config.get('source_week',self.week),
            "source_level": self.config.get('source_level'),
            "learning_objective_id": self.config.get('learning_objective_id'),
            "lesson": self.config.get('lesson'),
            "playable": self.week != 1 or self.level <= 2,
            "controls": C_NETWORK_CONTROLS if self.config.get('programming',{}).get('family')=='terminal' else self.config.get("controls", "Select an answer with 1–4 or click."),
            "objective": self.config.get("objective", "Complete the CP1 stations."),
        }


def valid_objective_binding(config: dict, course: dict) -> bool:
    """Reject stale/misfiled definitions rather than silently serving another lesson."""
    try:
        week, level = int(config['week']), int(config['level'])
        origin = int(course['exam_blueprint'][str(level)]) if week == 9 else week
        target = int(course['exam_level_blueprint'][str(level)]) if week == 9 else min(level,2) if week == 1 else level
        row = next(row for row in course['weeks'] if row['week'] == origin)
        identity = f'cp1_w{origin}_l{target}'
        lesson = config['lesson']
        if not (config['curriculum_version'] == course['version']
                and config['source_week'] == origin and config['source_level'] == target
                and config['learning_objective_id'] == identity
                and lesson['objective_id'] == identity and lesson['source_level'] == target
                and lesson['source_week'] == origin and lesson['stage_title'] == row['stages'][target-1]):
            return False
        if config.get('programming'):
            return config['programming']['objective_id'] == identity and config['programming']['source_level'] == target
        if config.get('flowchart'):
            return config['flowchart']['objective_id'] == identity and (origin != 2 or config['flowchart']['source_level'] == target)
        return config['mode'] == 'welcome_video' or all(task['objective_id'] == identity for task in config['tasks'])
    except (KeyError, TypeError, ValueError, StopIteration, IndexError):
        return False


def discover_canvas_games(root: Path) -> dict[str, list[CanvasGame]]:
    """Load Canvas definitions mirrored to the fallback-pool folder structure."""
    root = root.resolve()
    course = json.loads(COURSE_PATH.read_text(encoding='utf-8'))
    result: dict[str, list[CanvasGame]] = {}
    for path in sorted(root.glob("week_*/level*/*/game_*.json")):
        if path.name.endswith((".description.json", ".manifest.json")):
            continue
        try:
            config = json.loads(path.read_text(encoding="utf-8"))
            mode = str(config.get("mode") or "")
            file_id = str(config.get("file_id") or "")
            difficulty = canonical_difficulty(config.get("difficulty"))
            if not valid_objective_binding(config, course):
                continue
            if (config.get("schema_version") != 2 or mode not in GAME_MODES or not file_id
                    or not isinstance(config.get("tasks"), list) or not config["tasks"]
                    or (mode == "tetris" and (not isinstance(config.get("flowchart"), dict)
                        or not config["flowchart"].get("pieces") or not config["flowchart"].get("cases")))
                    or (mode=='circuit' and not (
                        isinstance(config.get('flowchart'),dict) and config['flowchart'].get('pieces') and config['flowchart'].get('cases')
                        or isinstance(config.get('programming'),dict) and config['programming'].get('family')=='circuit'
                        and config['programming'].get('rules') and config['programming'].get('objective')))
                    or ((int(config.get('week',0)) in {3,5,6,7,8} or int(config.get('week',0))==9 and mode in {'terminal','factory','dungeon'}) and (not isinstance(config.get('programming'),dict)
                        or config['programming'].get('family') not in {'terminal','circuit','factory','adventure'}
                        or not config['programming'].get('rules') or not config['programming'].get('objective')))
                    or (int(config.get('week',0))==4 and config.get('programming') is not None)
                    or (mode=='factory' and (not isinstance(config.get('programming',{}).get('controller'),dict)
                        or config['programming']['controller'].get('required_kind') not in {'if_else','while','for'}))
                    or not (path.resolve().is_relative_to(root))):
                continue
            game = CanvasGame(
                game_id=f"canvas_{mode}", slug=mode,
                display_name=str(config.get("display_name") or f"CP1 {mode.title()}"),
                variation_id=str(config.get("variation_id") or f"canvas_{file_id}"),
                variation_title=str(config.get("title") or path.stem),
                index=int(config.get("trial") or 1), config=config, config_path=path.resolve(),
                week=int(config["week"]), level=int(config["level"]),
                difficulty=difficulty, file_id=file_id,
            )
            result.setdefault(mode, []).append(game)
        except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError):
            continue
    return result


def find_canvas_game(file_id: str, games: dict[str, list[CanvasGame]]) -> CanvasGame | None:
    return next((game for rows in games.values() for game in rows if game.file_id == file_id), None)


def describe_canvas_game(game: CanvasGame, spec: dict) -> dict:
    lesson = course_lesson(game.week)
    settings = spec.get("game_settings") if isinstance(spec.get("game_settings"), dict) else {}
    task_count = len(game.config.get("tasks", []))
    return {
        **game.public_info(),
        "title": str(spec.get("game_title") or game.display_name),
        "subtitle": str(spec.get("theme") or game.variation_title),
        "week": game.week,
        "level": game.level,
        "difficulty": game.difficulty,
        "topic": str(game.config.get("topic") or lesson.get("title") or "CP1"),
        "curriculum_version": game.config.get('curriculum_version') or lesson.get("curriculum_version"),
        "learning_objectives": game.config.get("learning_objectives", lesson.get("objectives", [])),
        "objective": str(game.config.get("objective") or lesson.get("mechanic") or "Complete the CP1 stations."),
        "win_condition": ("The executed design satisfies every input/output and world-state goal." if game.config.get('programming') else "Watch the LogiCade prologue to completion." if game.slug == "welcome_video"
                          else "Build and check a chart that produces the required outputs for every example input." if game.config.get('flowchart')
                          else f"Answer all {task_count} CP1 programming stations correctly."),
        "lose_condition": ("The available unsuccessful execution checks are exhausted; programs are bounded by the mission's execution limits." if game.config.get('programming') else "The prologue can be resumed by selecting Stage 1 again." if game.slug == "welcome_video"
                           else "The run ends after the available unsuccessful chart checks are used." if game.config.get('flowchart')
                           else "The run ends when its configured timer expires or no lives remain."),
        "hint": str(game.config.get("hint") or "Trace the programming rule and compare each choice with the station goal."),
        "controls": {"summary": (C_NETWORK_CONTROLS
                                  if game.config.get('programming',{}).get('family')=='terminal' else game.config.get("controls")),
                     "pause": None if game.slug == "welcome_video" else "Escape",
                     "answers": None if game.config.get('programming') or game.slug in {"welcome_video", "tetris"} else "1–4 or click"},
        "time_limit_seconds": int(settings.get("time_limit_seconds") or 0),
        "formal_assessment": False,
        "accuracy_basis": "program_execution_goals" if game.config.get('programming') else "orientation_completion" if game.slug=='welcome_video' else "flowchart_execution_cases" if game.config.get('flowchart') else "question_answers",
        "asset_source": "shared LogiCade media and Kenney CC0 assets",
        "visual_mode": game.slug,
    }


def _atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def compile_canvas_package(*, source_json: Path, pool_root: Path, runtime_root: Path,
                           game: CanvasGame, spec: dict, backup_root: Path) -> dict:
    """Compile only the selected game data; engine and Kenney art stay shared."""
    source, pool, runtime = source_json.resolve(), pool_root.resolve(), runtime_root.resolve()
    if not source.is_relative_to(pool) or source.suffix.lower() != ".json":
        raise ValueError("Canvas package source is outside the fallback pool")
    if not game.config_path.is_relative_to(runtime):
        raise ValueError("Canvas game configuration is outside the mirrored game library")
    file_id = str(spec.get("file_id") or "")
    if not file_id or game.file_id != file_id:
        raise ValueError("Canvas game does not match the selected fallback identity")
    course = json.loads(COURSE_PATH.read_text(encoding='utf-8'))
    if not valid_objective_binding(game.config, course):
        raise ValueError('Canvas game learning objective is stale or mismatched; rebuild the game pool')
    if (int(spec.get('week',0)) != game.week or int(spec.get('level',0)) != game.level
            or canonical_difficulty(spec.get('difficulty')) != game.difficulty
            or spec.get('learning_objective_id') != game.config.get('learning_objective_id')):
        raise ValueError('Fallback description does not match the selected level learning objective')

    description = {**describe_canvas_game(game, spec), "file_id": file_id}
    context = {"game": game.config, "description": description, "source_spec": spec}
    encoded = json.dumps(context, ensure_ascii=True, separators=(",", ":"))
    encoded = encoded.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    html = (runtime / "runtime" / "index.html").read_text(encoding="utf-8")
    html = html.replace("<!-- LOGICADE_GAME_CONFIG -->", f"<script>window.LOGICADE_CANVAS_GAME={encoded};</script>")
    manifest = {
        "schema_version": 1,
        "archive": source.with_suffix(".zip").name,
        "source_file_id": file_id,
        **game.public_info(),
        "runtime": PACKAGE_RUNTIME,
        "game_slug": game.slug,
        "game_title": description["title"],
        "week": game.week,
        "level": game.level,
        "difficulty": game.difficulty,
        "asset_source": "/vendor/kenney/",
    }
    json_bytes = lambda value: (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for name, content in {
            "index.html": html.encode("utf-8"),
            "game.json": json_bytes(context),
            "variation.json": json_bytes(game.config),
            "description.json": json_bytes(description),
            "package_manifest.json": json_bytes(manifest),
        }.items():
            bundle.writestr(name, content)

    archive = source.with_suffix(".zip")
    if archive.is_file():
        existing = archive.read_bytes()
        if existing != output.getvalue():
            relative = source.relative_to(pool).with_suffix("")
            backup = backup_root / relative.parent / f"{relative.name}.{hashlib.sha256(existing).hexdigest()[:16]}.zip"
            if not backup.exists():
                _atomic_write(backup, existing)
    _atomic_write(archive, output.getvalue())
    _atomic_write(source.with_name(source.stem + ".description.json"), json_bytes(description))
    _atomic_write(source.with_name(source.stem + ".manifest.json"), json_bytes(manifest))
    return {"archive": archive.name, "description": description, "manifest": manifest}
