"""Build one Canvas game definition beside every matching fallback-pool slot.

The shared browser engine lives in games/runtime. This script makes the authored
game data 1:1 with data/fallback_pool without copying Kenney files into 2,700
separate packages. Re-run with --write after editing fallback definitions.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import random
import re
import tempfile
import time
from pathlib import Path
try:
    from .flowchart_scenarios import make_flowchart
    from .programming_missions import programming_mission
    from .cp1_lessons import source_week, source_level, lesson_for
    from .archive_lessons import archive_questions
except ImportError:
    from flowchart_scenarios import make_flowchart
    from programming_missions import programming_mission
    from cp1_lessons import source_week, source_level, lesson_for
    from archive_lessons import archive_questions

ROOT = Path(__file__).resolve().parents[1]
POOL = ROOT / "data" / "fallback_pool"
GAMES = ROOT / "games"
MANIFEST_PATH = ROOT / "data" / "manifest.json"
MODES = ("welcome_video", "tetris", "circuit", "terminal", "pending", "factory", "dungeon")
CURRICULUM = json.loads((ROOT / "data" / "curriculum.json").read_text(encoding="utf-8"))

# Week 4 remains deliberately unthemed until its course design is approved.
WEEK_MODES = {
    1: "tetris",
    2: "circuit",
    3: "terminal",
    4: "pending",
    5: "factory",
    6: "dungeon",
    7: "terminal",
    8: "circuit",
    9: "dungeon",
}
MODE_NAMES = {
    "welcome_video": "LogiCade Prologue",
    "tetris": "Flowchart Block Puzzle",
    "circuit": "Logic Circuit Workshop",
    "terminal": "Register Operations Console",
    "pending": "Week 4 Challenge · Theme Pending",
    "factory": "Code Assembly Factory",
    "dungeon": "Programming Quest",
}
GENRE_BY_MODE = {
    "welcome_video": "Full-screen welcome video",
    "tetris": "Drag-and-drop executable flowchart puzzle",
    "circuit": "Logic circuit and register puzzle",
    "terminal": "Assembly and register tracing puzzle",
    "pending": "CP1 challenge; Week 4 theme pending",
    "factory": "Resource-routing factory puzzle",
    "dungeon": "Code-guided adventure puzzle",
}
LOOP_BY_MODE = {
    "welcome_video": "Watch the full-screen LogiCade prologue; completion unlocks the flowchart stage.",
    "tetris": "Read the requested procedure, drag flowchart shapes into the chart, then run checks against example inputs and expected outputs.",
    "circuit": "Inspect the circuit board, solve the CP1 station, and advance the signal through its gates.",
    "terminal": "Inspect the register trace, select the correct instruction or result, and advance the program counter.",
    "pending": "Solve the CP1 stations in the shared Canvas shell while the Week 4 game theme awaits course approval.",
    "factory": "Solve each CP1 station to route the moving resource through the assembly line.",
    "dungeon": "Solve each CP1 station to open the next route through the code labyrinth.",
}
CONTROLS_BY_MODE = {
    "welcome_video": "Full-screen video; no pause or skip controls. Click only if sound autoplay is blocked.",
    "tetris": "Drag blocks from the tray into chart positions. Drag them back to remove them. Check chart runs the algorithm. Keyboard: [ or ] selects a block, arrows choose a position, Enter places, C checks, Escape pauses.",
    "circuit": "Click or press 1–4 to solve a gate; Escape pauses.",
    "terminal": "Click or press 1–4 to choose an instruction; Escape pauses.",
    "pending": "Click or press 1–4 to answer; Escape pauses.",
    "factory": "Click or press 1–4 to route a resource; Escape pauses.",
    "dungeon": "Click or press 1–4 to choose a code action; Escape pauses.",
}


def q(prompt: str, answer: str, distractors: list[str], explanation: str, node_type: str | None = None) -> dict:
    return {"prompt": prompt, "answer": answer, "distractors": distractors,
            "explanation": explanation, "node_type": node_type}


QUESTION_BANK: dict[int, list[dict]] = {
    1: [
        q("Before activating a stage, which information tells you what success requires?", "The objective and win condition", ["The decorative map title", "The current coin balance", "The sound setting"], "Read the objective and win condition before starting."),
        q("How many coins does one hint cost in LogiCade?", "6 coins", ["2 coins", "10 coins", "20 coins"], "A hint spends 6 coins."),
        q("What does a first-clear reward represent?", "A reward for the first successful completion", ["A reward for every retry", "A penalty after a loss", "A reward for opening the level panel"], "The first successful clear earns the level's one-time reward."),
        q("What should you do when a station rejects your program?", "Inspect the feedback and revise the step", ["Change the study score", "Skip the learning task", "Assume the output is correct"], "Use the feedback to diagnose and revise your work."),
    ],
    2: [
        q("Which flowchart symbol represents a decision?", "Diamond", ["Rectangle", "Oval", "Parallelogram"], "A diamond branches based on a condition.", "DECISION"),
        q("Which flowchart symbol represents a process step?", "Rectangle", ["Diamond", "Oval", "Arrow"], "A rectangle represents a process or operation.", "PROCESS"),
        q("Which flowchart symbol commonly represents input or output?", "Parallelogram", ["Diamond", "Rectangle", "Oval"], "A parallelogram represents input or output.", "INPUT / OUTPUT"),
        q("What does an arrow show in a flowchart?", "The direction of control flow", ["A variable's type", "A stored number", "The program's file name"], "Arrows connect symbols and show the order of flow.", "FLOW"),
    ],
    3: [
        q("Which description best defines an algorithm?", "A finite, ordered set of precise steps", ["A random collection of commands", "A picture with no instructions", "A variable that never changes"], "An algorithm is a finite, ordered procedure for a task."),
        q("Why should an algorithm specify steps clearly?", "So each step can be followed consistently", ["So steps can be skipped at random", "So inputs are never needed", "So the result cannot be checked"], "Precise steps make execution and checking reproducible."),
        q("When tracing an algorithm, what should you record after each step?", "The current state and resulting values", ["Only the final title", "The computer's wallpaper", "A guessed output before execution"], "Tracing follows state changes step by step."),
        q("What is a useful response when a step's precondition is false?", "Revise the steps or satisfy the precondition", ["Pretend the step ran", "Delete the intended result", "Skip all remaining reasoning"], "A failed precondition identifies where the procedure needs attention."),
    ],
    4: [
        q("Who designed the C language at Bell Laboratories?", "Dennis Ritchie", ["Ada Lovelace", "Grace Hopper", "Alan Turing"], "Dennis Ritchie developed C at Bell Laboratories."),
        q("Which description fits C?", "A general-purpose procedural programming language", ["A spreadsheet format", "A markup language only", "A database table"], "C is a general-purpose procedural language."),
        q("Which environment is historically associated with C's development?", "Bell Laboratories", ["The Apollo program only", "The first web browser team", "A modern phone app store"], "C was developed at Bell Laboratories."),
        q("What does procedural programming organize a program around?", "Procedures and ordered operations", ["Only decorative images", "Unrelated files with no control flow", "Hardware purchases"], "Procedural programs organize operations into procedures and control flow."),
        q("When did C's main early development occur?", "The early 1970s", ["The early 1940s", "The late 1990s", "After 2020"], "Ritchie dates C's formation to 1969–1973, with major work in 1972."),
        q("Which language directly preceded C?", "B", ["Java", "Python", "HTML"], "C evolved from B; BCPL is an earlier ancestor."),
        q("Which operating-system project shaped C's development?", "Unix", ["Android's original app store", "The World Wide Web", "MS-DOS only"], "Early C development was closely connected to Unix at Bell Labs."),
        q("What does general-purpose mean for C?", "It can express programs for many application domains", ["It only draws web pages", "It only stores numbers", "It is a single-purpose file format"], "General-purpose describes its range of uses, not a guarantee that every implementation behaves identically."),
        q("Which classification describes C's usual execution toolchain?", "A compiled language", ["A markup document", "A spreadsheet formula format", "An image format"], "C source normally goes through preprocessing, compilation and linking."),
        q("Is middle-level an official ISO C language category?", "No; it is an informal teaching description", ["Yes; it is a mandatory compiler mode", "It means C has no types", "It means every C program is portable unchanged"], "Use precise terms such as general-purpose, procedural and imperative; middle-level is informal."),
    ],
    5: [
        q("What does `#include <stdio.h>` do?", "Makes standard input/output declarations available", ["Starts the main function", "Declares an integer variable", "Ends every statement"], "The preprocessor include directive brings in a header."),
        q("Where does execution of a hosted C program normally begin?", "`main`", ["`#include`", "The last comment", "The file name"], "The `main` function is the program entry point in a hosted C environment."),
        q("What do braces `{ }` delimit in C?", "A block of statements", ["A string literal", "A preprocessor header", "A comment only"], "Braces group statements into a block."),
        q("What punctuation normally ends a C expression statement?", "A semicolon", ["A comma", "A colon", "A question mark"], "A semicolon terminates an expression statement."),
    ],
    6: [
        q("What does `int count = 3;` do?", "Declares an integer and initializes it to 3", ["Compares count with 3", "Prints the word count", "Declares a function named 3"], "The declaration gives `count` type `int` and initializes its value."),
        q("Which type is intended for a single basic character?", "`char`", ["`void`", "`if`", "`return`"], "`char` stores a character value."),
        q("Which type is intended for a whole-number value?", "`int`", ["`char`", "`#include`", "`printf`"], "`int` represents an integer value."),
        q("In `score = score + 1;`, what happens to score?", "Its value is updated to the previous value plus one", ["It is compared with one", "It is declared as a function", "It is printed automatically"], "Assignment stores the computed right-hand value in the variable."),
    ],
    7: [
        q("A variable declared inside a function body is usually visible where?", "Within its enclosing block", ["In every source file automatically", "Only in comments", "Only before its declaration"], "A block-scope local is visible within its scope."),
        q("A file-scope variable is declared where?", "Outside function bodies", ["Only inside a loop body", "Inside a string literal", "After the program ends"], "A file-scope declaration appears outside function bodies."),
        q("What is shadowing?", "An inner declaration hides an outer name in its scope", ["A variable changes the screen brightness", "A function deletes every global", "A comment becomes executable"], "An inner declaration can hide an outer declaration with the same name."),
        q("When does an automatic local variable normally exist?", "During execution of its enclosing block", ["Before the program starts forever", "Only while a comment is read", "After every program has terminated"], "An automatic local's lifetime is tied to its block execution."),
    ],
    8: [
        q("In C, what does `&&` mean in a condition?", "Logical AND: both sides must be true", ["Logical OR: either side may be true", "Assignment", "Integer division"], "Logical AND is true only when both operands are true."),
        q("In C, what does `||` mean in a condition?", "Logical OR: at least one side must be true", ["Logical AND: both sides must be true", "Assignment", "A comment"], "Logical OR is true when at least one operand is true."),
        q("If `x` is 5, is `x > 2 && x < 8` true?", "Yes, both comparisons are true", ["No, the first comparison is false", "No, AND always means false", "It assigns 8 to x"], "Both comparisons are true for x equal to 5."),
        q("If `ready` is false and `hasKey` is true, is `ready || hasKey` true?", "Yes, one side is true", ["No, both sides are required", "It changes hasKey", "It declares ready"], "Logical OR is true when either operand is true."),
    ],
}

# Match the user's sequence: declaration basics precede the Week 8 scope lesson.
QUESTION_BANK[7] = [
    q('Which declaration creates an integer named count?', 'int count;', ['count int;', 'integer(count);', 'int = count;'], 'A declaration gives a type followed by an identifier.'),
    q('Which statement initializes an integer to 3?', 'int count = 3;', ['count == 3;', 'int 3 = count;', 'return count;'], 'Initialization supplies the first value while declaring the object.'),
    q('Is printf a C keyword?', 'No; it is a library function identifier', ['Yes; all library names are keywords', 'Yes; it is a data type', 'It is a preprocessor symbol'], 'Keywords and library identifiers have different roles.'),
    q('Which type represents a basic character value?', 'char', ['return', 'main', '#include'], 'char is a basic integer type commonly used for character values.'),
]
QUESTION_BANK[8] = [
    q('Where is a file-scope variable declared?', 'Outside function bodies', ['Inside every loop only', 'In a string literal', 'Only after return'], 'File-scope declarations occur outside function definitions.'),
    q('What happens when a local has the same name as a visible global?', 'The local hides that name within its scope', ['The global is deleted', 'Both values are automatically added', 'The local becomes a keyword'], 'Name lookup uses the closest visible declaration.'),
    q('What happens after leaving a block that shadowed a global?', 'The outer declaration is visible again', ['The global keeps the local value automatically', 'Every variable disappears', 'The header is reloaded'], 'Leaving the inner scope restores visibility of the outer name.'),
    q('What is the initial value of a file-scope int with no explicit initializer?', 'Zero', ['Always an unpredictable local value', 'One', 'It must be a string'], 'Objects with static storage duration are zero-initialized when no explicit initializer is supplied.'),
]


def stable_seed(file_id: str) -> int:
    return int.from_bytes(hashlib.sha256(file_id.encode("utf-8")).digest()[:4], "big")


def tasks_for(week: int, file_id: str, difficulty: str = "Standard", level: int = 10, trial: int = 1) -> list[dict]:
    seed = stable_seed(file_id)
    rng = random.Random(seed)
    bank = QUESTION_BANK[week] if week in QUESTION_BANK else [item for w in range(2, 9) for item in QUESTION_BANK[w]]
    if week == 9:
        start = seed % len(bank)
        selected = [bank[(start + i * 7) % len(bank)] for i in range(4)]
    else:
        start = seed % len(bank)
        selected = [bank[(start + i) % len(bank)] for i in range(4)]
    if week == 4:
        selected = archive_questions(level, trial)
    result = []
    for number, item in enumerate(selected, start=1):
        choices = [item["answer"], *item["distractors"]]
        if str(difficulty).lower().replace("_", " ") in {"need assistance", "needs support"}:
            choices = choices[:3]
        rng.shuffle(choices)
        result.append({
            "id": f"{file_id}_station_{number}",
            "prompt": item["prompt"],
            "choices": choices,
            "answer_index": choices.index(item["answer"]),
            "explanation": item["explanation"],
            "node_type": item.get("node_type"),
            "objective_id": f'cp1_w{week}_l{level}',
        })
    return result


def make_layout(mode: str, seed: int) -> dict:
    rng = random.Random(seed ^ 0x5A17)
    if mode == "welcome_video":
        return {"video_asset": "/canvas-runtime/assets/logicade_prologue.mp4", "fit": "cover", "controls": False}
    if mode == "tetris":
        return {"interaction": "flowchart_drag_drop", "columns": 12, "rows": 10, "seed": seed}
    if mode == "pending":
        return {"width": 14, "height": 9, "seed": seed, "theme_status": "awaiting_course_decision"}
    if mode == "factory":
        return {"width": 14, "height": 9, "route_variant": seed % 6,
                "blocked_cells": [[rng.randrange(3, 12), rng.randrange(1, 8)] for _ in range(5)],
                "stations": [[1, 4], [4, 2 + seed % 4], [7, 2 + (seed >> 2) % 4], [10, 2 + (seed >> 4) % 4], [12, 4]]}
    if mode == "terminal":
        return {"width": 14, "height": 9, "registers": [rng.randrange(0, 32) for _ in range(4)],
                "node_order": [0, 1, 2, 3], "active_node": seed % 4}
    if mode == "circuit":
        return {"width": 14, "height": 9, "gate_order": ["INPUT", "AND" if seed & 1 else "OR", "NOT" if seed & 2 else "XOR", "OUTPUT"],
                "switches": [bool(seed & 4), bool(seed & 8)], "wire_variant": seed % 5}
    width, height = 14, 9
    grid = [["." for _ in range(width)] for _ in range(height)]
    for x in range(width):
        grid[0][x] = grid[-1][x] = "#"
    for y in range(height):
        grid[y][0] = grid[y][-1] = "#"
    for _ in range(14):
        x, y = rng.randrange(2, width - 2), rng.randrange(1, height - 1)
        if (x, y) not in {(1, 4), (width - 2, 4)}:
            grid[y][x] = "#"
    for x in range(1, width - 1):
        grid[4][x] = "."
    grid[4][1] = "S"
    grid[4][-2] = "G"
    grid[2 + seed % 4][3 + (seed >> 3) % 7] = "!"
    return {"width": width, "height": height, "grid": ["".join(row) for row in grid], "seed": seed}


def mode_for(week: int, level: int, trial: int, seed: int) -> str:
    if week == 1 and level == 1:
        return "welcome_video"
    return WEEK_MODES.get(source_week(week,level), "pending")


def adapt_fallback_spec(spec: dict, relative: Path) -> None:
    """Attach the shared game mapping and align the two opening stages."""
    week, level = int(spec["week"]), int(spec["level"])
    origin=source_week(week,level)
    mode = mode_for(week, level, int(spec.get("trial") or 1), stable_seed(str(spec["file_id"])))
    spec["genre"] = GENRE_BY_MODE[mode]
    spec["core_gameplay_loop"] = LOOP_BY_MODE[mode]
    spec["controls"] = CONTROLS_BY_MODE[mode]
    mission = programming_mission(week, level, int(spec.get('trial') or 1), str(spec.get('difficulty')), stable_seed(str(spec['file_id'])))
    if mission:
        for field in ('player_objective','win_condition','lose_condition','game_title','primary_mechanic'):
            spec.setdefault('source_'+field,spec.get(field))
        spec.update(game_title=mission['title'],player_objective=mission['objective'],
                    win_condition='The executed solution satisfies every output and world-state check.',
                    lose_condition='The available unsuccessful execution checks are exhausted.',
                    primary_mechanic=mission['family']+' construction and execution',controls=mission['controls'],
                    hint=mission['hint'])
        spec['genre']=mission['family']+' programming workbench'
        spec['core_gameplay_loop']='Construct a solution, execute it, inspect actual state and outputs, then revise until all mission goals pass.'
        spec['tutorial']=['Read the objective, fixtures and command reference.',
                          'Build the circuit or route, or edit the node/adventure program.',
                          'Use Step to inspect state; Run checks the real outputs and goals.',
                          'Revise errors before using the remaining execution checks.']
        if mission.get('circuit_kind')=='scope_controller':
            spec['tutorial']=['Read the C scope mission and expected signal traces.',
                              'Connect sensor → scope controller → splitter; wire each branch into the SUM merger.',
                              'Write file-scope declarations before main and local declarations inside their blocks.',
                              'Connect merger → LOOP, LOOP → split and LOOP → output. Set the required feedback passes.',
                              'Use Program node to edit every branch. Step inspects scopes and signals; Run verifies all tests.']
        settings=spec.setdefault('game_settings',{})
        spec.setdefault('source_time_limit_seconds',settings.get('time_limit_seconds'))
        settings['time_limit_seconds']=0
    spec["assets_style"] = "Shared Kenney CC0 tile and audio assets with deterministic Canvas layouts; assets are not duplicated per game."
    if week == 1 and level == 1:
        spec.update({
            "game_title": "LogiCade Prologue",
            "game_concept": "A full-screen welcome cinematic introduces LogiCade and its learning journey.",
            "topic": "Platform Orientation",
            "primary_mechanic": "Welcome video",
            "player_objective": "Watch the LogiCade prologue to completion before entering the first learning challenge.",
            "win_condition": "The prologue video reaches its end.",
            "lose_condition": "The video is closed before completion.",
            "learning_alignment": "Platform orientation – learn what the learning adventure is and how to begin.",
            "tutorial": ["Watch the full-screen prologue.", "The video has no skip or pause controls.", "When it ends, continue to Stage 2."],
        })
        settings = spec.get("game_settings") if isinstance(spec.get("game_settings"), dict) else {}
        settings["time_limit_seconds"] = 0
        spec["game_settings"] = settings
    elif week == 1 and level == 2:
        region = spec.get("region") if isinstance(spec.get("region"), dict) else {}
        place = str(region.get("name") or "the Flowchart Field")
        prior_title = str(spec.get("game_title") or "Flowchart Challenge")
        spec.setdefault("source_primary_mechanic", str(spec.get("primary_mechanic") or ""))
        puzzle = make_flowchart(str(spec["file_id"]), int(spec.get("trial") or 1), str(spec.get("difficulty")), stable_seed(str(spec["file_id"])))
        spec.update({
            "game_title": f"Flowchart Workshop – {puzzle['title']}",
            "game_concept": f"A drag-and-drop algorithm puzzle in {place}: create the requested executable flowchart.",
            "topic": "Flowchart Symbols and Control Flow",
            "primary_mechanic": "Drag-and-drop flowchart construction",
            "player_objective": puzzle['prompt'],
            "win_condition": "Build a complete chart whose execution produces the required outputs for every example input.",
            "lose_condition": "The run ends after the available unsuccessful chart checks are used.",
            "learning_alignment": "Week 1 Stage 2 – interpret process, decision, input/output, and control-flow symbols.",
            "tutorial": ["Read the requested procedure.", "Drag correctly shaped blocks into the chart and follow the arrows.", "Select Check chart to run example inputs. Revise incorrect steps and try again."],
            "source_game_title": spec.get("source_game_title") or prior_title,
        })
        settings = spec.get("game_settings") if isinstance(spec.get("game_settings"), dict) else {}
        settings.setdefault("source_time_limit_seconds", settings.get("time_limit_seconds", 0))
        settings["time_limit_seconds"] = 0
        spec["game_settings"] = settings
    elif origin==2:
        puzzle=make_flowchart(str(spec['file_id']),int(spec.get('trial') or 1),str(spec.get('difficulty')),stable_seed(str(spec['file_id'])),level=source_level(week,level))
        spec.update(game_title='Flowchart Lab · '+puzzle['title'],player_objective=puzzle['prompt'],
                    win_condition='Construct a complete chart that passes every executable input/output case.',
                    lose_condition='The available unsuccessful chart checks are exhausted.',
                    controls='Drag the flowchart symbols into connected positions, then Check chart.',
                    tutorial=['Read the algorithm.','Use terminator, input/output, process and decision symbols.','Test the chart with every example input.'])
        spec.setdefault('game_settings',{})['time_limit_seconds']=0
    elif origin==4:
        stage=lesson_for(week,level)['stage_title']
        spec.update(game_title='C Archive · '+stage,player_objective=f'Archive variation {int(spec.get("trial") or 1)}: classify and verify C history, characteristics and language categories for {stage}.',
                    win_condition='All researched archive facts are correctly identified.',
                    controls='Read each archive record and choose the supported C fact.')
    spec['topic']=lesson_for(week,level)['title']
    spec['learning_alignment']=f'CP1 Week {origin}: '+lesson_for(week,level)['stage_title']
    spec['learning_objective_id']=lesson_for(week,level)['objective_id']
    spec['source_week']=origin
    spec['source_level']=source_level(week,level)


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if path.is_file() and path.read_bytes() == raw:
        return
    descriptor, name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        for attempt in range(6):
            try:
                os.replace(temporary, path)
                break
            except PermissionError:
                if attempt==5: raise
                time.sleep(.1*(attempt+1))
    finally:
        temporary.unlink(missing_ok=True)


def build_definition(spec: dict, relative: Path) -> dict:
    file_id = str(spec["file_id"])
    week = int(spec["week"])
    level = int(spec["level"])
    trial = int(spec.get("trial") or 1)
    difficulty = str(spec.get("difficulty") or "Standard")
    mode = mode_for(week, level, trial, stable_seed(file_id))
    origin=source_week(week,level)
    flowchart = make_flowchart(file_id, trial, difficulty, stable_seed(file_id),level=source_level(week,level) if origin==2 else None) if mode == "tetris" or origin==2 else None
    mission = programming_mission(week, level, trial, difficulty, stable_seed(file_id))
    settings = spec.get("game_settings") if isinstance(spec.get("game_settings"), dict) else {}
    lesson = next((item for item in CURRICULUM.get("weeks", []) if item.get("week") == week), {})
    objective = str(spec.get("player_objective") or lesson.get("mechanic") or "Complete the CP1 learning stations.")
    if flowchart:
        flowchart['objective_id']=lesson_for(week,level)['objective_id']
        objective = flowchart["prompt"]
    if mission:
        objective = mission['objective']
    configured_lives = settings.get("lives")
    try:
        lives = max(1, min(8, int(configured_lives)))
    except (TypeError, ValueError):
        lives = 3
    # The source fallback already distinguishes 5/3/2 lives and longer/shorter
    # time limits by support level. Preserve those approved per-record settings.
    course_title = str(("Platform Orientation" if week == 1 and level == 1 else
                        "Flowchart Symbols and Control Flow" if week == 1 and level == 2 else
                        lesson.get("title") or spec.get("topic") or "CP1"))
    learning_objectives = ( ["Learn the platform controls, missions, and progression."] if week == 1 and level == 1 else
                           ["Identify common flowchart symbols.", "Trace the direction of control flow.", "Build a valid route from ordered nodes."] if week == 1 and level == 2 else
                           lesson_for(week,level)['objectives'])
    definition = {
        "schema_version": 2,
        "engine": "logicade_canvas_v2",
        "curriculum_version": CURRICULUM.get('version'),
        "file_id": file_id,
        "variation_id": f"canvas_{file_id}",
        "week": week,
        "level": level,
        "trial": trial,
        "difficulty": difficulty,
        "mode": mode,
        "title": mission['title'] if mission else f"Flowchart Workshop – {flowchart['title']}" if flowchart else str(spec.get("game_title") or file_id),
        "display_name": "C Scope Circuit Workshop" if origin==8 else MODE_NAMES[mode],
        "theme": str(spec.get("theme") or spec.get("region", {}).get("name") or "CP1 GameVerse"),
        "topic": course_title,
        "learning_objectives": learning_objectives,
        "lesson": lesson_for(week,level),
        "learning_objective_id": lesson_for(week,level)['objective_id'],
        "source_level": source_level(week,level),
        "source_week": origin,
        "primary_mechanic": MODE_NAMES[mode] if week == 1 and level == 1 else str(spec.get("primary_mechanic") or MODE_NAMES[mode]),
        "objective": objective,
        "hint": mission['hint'] if mission else flowchart["feedback"] if flowchart else f"Use the {course_title} idea and test one choice against the station goal.",
        "controls": mission['controls'] if mission else CONTROLS_BY_MODE[mode],
        "time_limit_seconds": 0 if mission or flowchart or mode == "welcome_video" else max(0, int(settings.get("time_limit_seconds") or 0)),
        "starting_lives": lives,
        "seed": stable_seed(file_id),
        "layout": make_layout(mode, stable_seed(file_id)),
        **({"flowchart": flowchart} if flowchart else {}),
        **({'programming':mission} if mission else {}),
        "assets": {
            **{
                "factory": {"factory_tile": "/vendor/kenney/weekly-ui/tiny-factory/Tiles/tile_0017.png",
                            **{f'machine_{kind}':f'/vendor/kenney/weekly-ui/tiny-factory/Tiles/tile_{index:04}.png'
                               for kind,index in [('source',100),('smelter',102),('assembler',112),('generator',120),('output',101),('if_else',102),('while',100),('for',112),('splitter',104),('router',105),('merger',106)]}},
                "terminal": {"terminal_tile": "/vendor/kenney/organized/tiles/1_bit_pack/colored_transparent/r00_c01.png"},
                "circuit": {"terminal_tile": "/vendor/kenney/organized/tiles/1_bit_pack/colored_transparent/r00_c01.png"},
                "dungeon": {"dungeon_tile": "/vendor/kenney/organized/tiles/roguelike_rpg_pack/roguelike_sheet_transparent/r26_c06.png",
                            "wall_tile": "/vendor/kenney/organized/tiles/roguelike_rpg_pack/roguelike_sheet_transparent/r13_c24.png"},
                "tetris": {"puzzle_tile": "/vendor/kenney/organized/tiles/1_bit_pack/colored_transparent/r00_c01.png"},
                "pending": {"terminal_tile": "/vendor/kenney/organized/tiles/1_bit_pack/colored_transparent/r00_c01.png"},
                "welcome_video": {"welcome_video": "/canvas-runtime/assets/logicade_prologue.mp4"},
            }[mode],
            **({} if mode == "welcome_video" else {
                "success_sound": "/vendor/kenney/organized/audio/interface/interface_sounds/confirmation_001.ogg",
                "error_sound": "/vendor/kenney/organized/audio/interface/interface_sounds/error_001.ogg",
            **({"block_drop_sound": "/vendor/kenney/organized/audio/interface/interface_sounds/drop_001.ogg",
                "line_clear_sound": "/vendor/kenney/organized/audio/interface/interface_sounds/confirmation_002.ogg"} if mode == "tetris" else {}),
            **({"hero_sprite": "/vendor/kenney/organized/tiles/roguelike_characters/roguelike_char_transparent/r10_c00.png"} if mode == "dungeon" else {}),
            }),
        },
        "tasks": ([{"id": f"{file_id}_welcome", "prompt": "Watch the LogiCade prologue to learn how to begin.",
                    "choices": ["Continue"], "answer_index": 0, "explanation": "The video completion opens the next stage."}]
                  if mode == "welcome_video" else [{"id":slot["id"], "kind":"flowchart_node", "prompt":f"Build position {slot['number']} in the requested chart."} for slot in flowchart["slots"]]
                  if flowchart else [{'id':mission['mission_id'],'kind':'program_execution','prompt':mission['objective']}]
                  if mission else tasks_for(origin, file_id, difficulty, source_level(week,level), trial)),
        "source_path": relative.as_posix(),
        "source_topic": str(spec.get("topic") or ""),
        "source_learning_alignment": str(spec.get("learning_alignment") or ""),
        "source_primary_mechanic": str(spec.get("source_primary_mechanic") or spec.get("primary_mechanic") or ""),
        "source_code_snippet": str(spec.get("code_snippet") or ""),
    }
    if spec.get('canvas_generation'):
        from server.canvas_builder import apply_parameters
        definition=apply_parameters(spec,definition)
    if spec.get('mechanic_migration'):
        definition['mechanic_migration']=copy.deepcopy(spec['mechanic_migration'])
    return definition


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="write mirrored game configs and fallback links")
    parser.add_argument("--check", action="store_true", help="report missing or stale mirrored configs")
    parser.add_argument("--prune-stale", action="store_true", help="remove generated Canvas definitions absent from the canonical manifest")
    args = parser.parse_args()
    if not args.write and not args.check:
        parser.error("choose --write or --check")

    manifest_rows = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if not isinstance(manifest_rows, list):
        raise SystemExit("data/manifest.json must contain the canonical fallback record list")
    canonical = {str(row.get("file_id")): row for row in manifest_rows if isinstance(row, dict) and row.get("file_id")}
    if len(canonical) != len(manifest_rows):
        raise SystemExit("The canonical manifest has missing or duplicate file_id values")

    sources = []
    invalid_sources = []
    seen_file_ids: set[str] = set()
    for path in sorted(POOL.glob("week_*/level*/*/game_*.json")):
        if path.name.endswith((".description.json", ".manifest.json")):
            continue
        try:
            spec = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(spec, dict) or not spec.get("file_id"):
                invalid_sources.append((path, "expected a JSON object with file_id"))
                continue
            match = re.fullmatch(r"week_(\d+)", path.parents[2].name)
            level_match = re.fullmatch(r"level(\d+)", path.parents[1].name)
            if (not match or not level_match
                    or int(match.group(1)) != int(spec.get("week", -1))
                    or int(level_match.group(1)) != int(spec.get("level", -1))):
                invalid_sources.append((path, "week/level metadata does not match its folder"))
                continue
            file_id = str(spec["file_id"])
            if file_id not in canonical:
                # Leave unmanifested historical fallback JSONs exactly as found.
                continue
            record = canonical[file_id]
            if any(int(record.get(key, -1)) != int(spec.get(key, -2)) for key in ("week", "level", "trial")):
                invalid_sources.append((path, "fallback metadata does not match canonical manifest"))
                continue
            if file_id in seen_file_ids:
                invalid_sources.append((path, f"duplicate file_id {file_id}"))
                continue
            seen_file_ids.add(file_id)
            sources.append((path, spec))
        except (OSError, json.JSONDecodeError) as exc:
            invalid_sources.append((path, str(exc)))
            continue

    absent = set(canonical) - seen_file_ids
    if absent:
        invalid_sources.append((POOL, f"{len(absent)} canonical manifest record(s) have no fallback JSON"))
    if invalid_sources:
        for path, error in invalid_sources[:20]:
            print(f"Invalid source JSON: {path.relative_to(POOL)}: {error}")
        print(f"Refusing to build: {len(invalid_sources)} fallback JSON file(s) are invalid.")
        return 1

    missing = 0
    mode_counts = {mode: 0 for mode in MODES}
    for path, spec in sources:
        relative = path.relative_to(POOL)
        destination = GAMES / relative
        adapt_fallback_spec(spec, relative)
        fresh = build_definition(spec, relative)
        if spec.get('canvas_generation'):
            from server.canvas_builder import align_description
            align_description(spec,fresh)
        mode_counts[fresh["mode"]] += 1
        if args.check:
            try:
                existing = json.loads(destination.read_text(encoding="utf-8"))
                pointer = spec.get("canvas_runtime") if isinstance(spec.get("canvas_runtime"), dict) else {}
                if (existing != fresh
                        or pointer.get("engine") != "logicade_canvas_v2"
                        or pointer.get("game_path") != relative.as_posix()
                        or pointer.get("variation_id") != fresh["variation_id"]
                        or pointer.get("mode") != fresh["mode"]):
                    missing += 1
            except (OSError, json.JSONDecodeError):
                missing += 1
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        write_json(destination, fresh)
        spec["canvas_runtime"] = {
            "engine": "logicade_canvas_v2",
            "game_path": relative.as_posix(),
            "variation_id": fresh["variation_id"],
            "mode": fresh["mode"],
            "asset_set": fresh["mode"],
            "playable": not (fresh["week"] == 1 and fresh["level"] > 2),
            "asset_manifest": "games/assets/manifest.json",
        }
        write_json(path, spec)

    if args.write:
        if args.prune_stale:
            removed = 0
            for stale in GAMES.glob("week_*/level*/*/game_*.json"):
                try:
                    value = json.loads(stale.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    continue
                if value.get("engine") == "logicade_canvas_v2" and str(value.get("file_id")) not in canonical:
                    stale.unlink()
                    removed += 1
            print(f"Removed {removed} generated definitions absent from the canonical manifest.")
        registry = {
            "schema_version": 2,
            "engine": "logicade_canvas_v2",
            "folder_pattern": "week_{week}/level{level}/{difficulty}/{fallback_filename}",
            "shared_runtime": "runtime/",
            "shared_assets": "assets/manifest.json",
            "canonical_fallback_records": len(sources),
            "playable_fallback_records": sum(1 for _, spec in sources if int(spec["week"]) != 1 or int(spec["level"]) <= 2),
            "week_1_unavailable_records": sum(1 for _, spec in sources if int(spec["week"]) == 1 and int(spec["level"]) > 2),
            "modes": mode_counts,
            "week_modes": {str(week): ("welcome_video (stage 1), tetris (stage 2)" if week == 1 else "topic-based examination practice" if week==9 else WEEK_MODES[week]) for week in range(1, 10)},
            "week_9_source_weeks": {str(level):source_week(9,level) for level in range(1,11)},
            "week_4_status": "researched C history and classification archive",
            "week_1_visible_stages": 2,
            "asset_source": "vendor/kenney (shared; not copied into each game)",
        }
        GAMES.mkdir(parents=True, exist_ok=True)
        write_json(GAMES / "registry.json", registry)
        print(f"Wrote {len(sources)} mirrored Canvas game definitions; mode distribution: {mode_counts}")
    else:
        print(f"Found {len(sources)} fallback definitions; {missing} mirrored Canvas definitions are missing or stale.")
    return 1 if args.check and missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
