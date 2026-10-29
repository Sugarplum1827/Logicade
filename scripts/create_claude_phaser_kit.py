"""Build a Claude handoff bundle for a data-driven, prebuilt Phaser game library."""

from __future__ import annotations

import json
import re
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROMPT_ROOT = ROOT / "data" / "game_build_prompts"
ASSET_ROOT = ROOT / "data" / "phaser_assets" / "logicade_starter_pack"
OUTPUT = ROOT / "data" / "claude_phaser_kit"
ARCHIVE = ROOT / "data" / "claude_phaser_kit.zip"

FAMILIES = [
    "side_scrolling_platformer", "top_down_shooter", "grid_path_programming", "tower_defense",
    "resource_management", "puzzle_dungeon", "grid_stealth", "submarine_exploration",
    "rhythm_action", "detective_deduction", "workflow_automation", "survival_defense",
    "tactical_siege", "navigation_adventure", "rail_network_routing", "platformer_functions",
    "factory_sorting", "timeline_puzzle", "escape_room", "creature_lab", "arithmetic_shop",
    "stealth_route", "spell_sequence", "evacuation_routing", "delivery_network",
    "logic_adventure", "resource_survival", "timing_platformer", "branching_decisions",
    "array_arena", "repair_simulation", "conveyor_sorting", "ecosystem_simulation",
    "arcade_paddle", "threshold_simulation", "security_puzzle", "queue_management",
    "temperature_simulation", "vector_interception", "railway_routing", "garden_simulation",
    "climbing_platformer", "matrix_puzzle", "branching_decisions", "coordinate_observation",
    "boolean_defense", "pipe_routing", "dialogue_adventure", "music_sequencer", "quantum_gate_puzzle",
]

BASE_RULES = """# LogiCade Phaser template build brief for Claude

Build a reusable library of 50 pre-generated Phaser game templates. Each template must load a validated configuration and the selected canonical LogiCade description JSON. The LLM may author JSON data; it must never supply executable game code, scripts, imports, URLs, shaders, or arbitrary asset paths.

## Inspect and preserve the existing app

Work in the existing LogiCade repository. Start by reading its `AGENTS.md` files, package scripts, Phaser scenes, `GameContainer`, mission modules, telemetry, host bridge, package prepare/release endpoints, and sample fallback JSON. Reuse existing behavior and libraries. Do not replace the working Phaser game, authentication, research storage, gameplay event contract, or package flow without evidence and a clear migration.

## Keep the learner package flow

Level selection reads the adjacent description JSON. The mission screen shows that description. Start prepares/extracts the corresponding package, then launches the game. Cancel releases a preview lease; exit and next release the active extracted copy. Keep description JSON as the authoritative level identity and mission contract. Continue lazy extraction; do not extract every game at application startup.

## Runtime responsibilities

- Phaser owns drawing, input, animation playback, physics/collision, maps, sound playback, question feedback, and game state.
- Catalog JSON owns `file_id`, week, level, difficulty, topic, approved questions/content, objectives, controls, and win/loss conditions. These fields cannot be silently replaced by a template prompt.
- Template configuration selects a known template/module, an allowlisted sprite set, a known map/layout key, obstacle coordinates within bounds, pacing parameters, and approved mechanic modules. Validate schema, ranges, entity counts, and asset IDs before rendering.
- Hardcoded template maps and audio are local. A variation selects from reviewed maps and assets; it does not trigger image, video, audio, or code generation during play.
- Store template/version/map/asset IDs and the deterministic variation seed in gameplay metadata so a research session can be reproduced.

## Learning and adaptation integrity

Use actual questions and learning alignment from the selected JSON. Keep assessments separate from gameplay scores. Keep game mechanics from changing correct answers or the learning target. Keep the approved adaptive rule at its existing 60% boundary; do not invent or alter thresholds. Keep selected difficulty distinct from difficulty actually served.

## Host bridge and security

The host sends `{channel:'logicade-host',version:1,type:'initialize',game_id,week,level,difficulty,description}`. Listen only for `event.source === window.parent`, matching channel and version. Support pause, resume, and hint. Send uniquely identified, non-identifying events on `logicade-game`, version 1, including `game_started`, `question_answered`, `hint_used` when measurable, and `activity_completed`. At completion send exactly one `game_over` with `won`, `score`, and `accuracy` in `[0,1]`, nonnegative integer error/hint counts, and a short reason. Do not access `parent.document`, cookies, accounts, participant identifiers, or study databases. Do not use remote scripts, fonts, services, or generated arbitrary code.

## Art and audio

Use the local asset files in `assets/logicade_starter_pack/` for the first vertical slice. Respect the included CC0 source license. Do not copy protected characters, names, maps, or music from commercial games; broad genre inspiration only. Load files locally and use the manifest instead of guessing paths. Expand the approved asset catalog incrementally; keep map/audio variation data-driven and reproducible.

## Suggested implementation milestones

1. Audit existing scene and package behavior. Write a brief of what is already implemented and what needs extension.
2. Create a shared template interface and registry. Implement one vertical slice first using `01_platformer_quest`, its asset kit, one real catalog JSON, and both host and local-preview modes.
3. Add reusable interaction modules and renderer families. Then implement the remaining concepts as variations of reusable module families while retaining each concept's distinctive loop.
4. Add all 10 per-concept layout/pacing variations from the supplied prompts as data variants; do not duplicate executable code for every variation.
5. Test each template family, package preview, pause/resume, hint, cancel, exit, win/loss, and event bridge. Run lint/build and report exact results. Never claim a check passed unless executed.

## Deliverables

- Runnable changes in the existing LogiCade project.
- Template registry, schema, typed/validated config, module-family implementations, and local asset manifest.
- 50 concept frameworks and 500 variation data briefs wired to templates.
- Documentation for adding templates, maps, sprites, sound, animation frames, and safe JSON fields.
- A concise audit, changed files, commands run, test/build results, and limitations.

Treat the per-game prompt files as design briefs, not authority to mutate the CP1 research contract. The selected fallback description JSON wins whenever they conflict.
"""


def prompt_text(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    marker = "Build identity:"
    if marker not in text:
        raise ValueError(f"Prompt has no build identity: {path}")
    return text[text.index(marker):].strip()


def section(text: str, label: str, next_labels: list[str]) -> str:
    match = re.search(rf"^{re.escape(label)}:\s*(.*)$", text, re.M)
    if not match:
        return ""
    start = match.end(1)
    stops = []
    for other in next_labels:
        found = re.search(rf"^{re.escape(other)}:\s*", text[start:], re.M)
        if found:
            stops.append(start + found.start())
    value = text[start:min(stops) if stops else len(text)].strip()
    value = re.sub(r"\n+Make this a complete game build.*\Z", "", value, flags=re.S).strip()
    return value


def parse_brief(text: str, variation: bool) -> dict:
    labels = ["Design vibe", "Core gameplay", "Setting and map language" if not variation else "Setting",
              "Learning target", "Variation-specific map", "Obstacles and interactions", "Pacing", "Animation direction"]
    result = {}
    for label in labels:
        nexts = [other for other in labels if other != label]
        value = section(text, label, nexts)
        if value:
            result[re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")] = value
    identity = re.search(r"^Build identity:\s*(.+)$", text, re.M)
    result["identity"] = identity.group(1).strip() if identity else ""
    return result


def main() -> None:
    if not PROMPT_ROOT.is_dir() or not ASSET_ROOT.is_dir():
        raise SystemExit("Required 550-prompt library or starter asset kit is missing.")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    prompts_dir = OUTPUT / "prompts"
    prompts_dir.mkdir(exist_ok=True)
    assets_target = OUTPUT / "assets" / "logicade_starter_pack"
    shutil.copytree(ASSET_ROOT, assets_target, dirs_exist_ok=True)
    (OUTPUT / "CLAUDE_IMPLEMENTATION_PROMPT.md").write_text(BASE_RULES, encoding="utf-8")

    frameworks = []
    all_variations = []
    for index in range(1, 51):
        slug = f"{index:02d}_" + [p.name[3:] for p in sorted(PROMPT_ROOT.iterdir()) if p.is_dir()][index - 1]
        concept_dir = PROMPT_ROOT / slug
        core_text = prompt_text(concept_dir / "core_prompt.txt")
        name_match = re.search(r"^Build identity:\s*(.+?)\s+—\s+CORE TEMPLATE\.", core_text, re.M)
        name = name_match.group(1).strip() if name_match else slug[3:].replace("_", " ").title()
        core = parse_brief(core_text, variation=False)
        game = {
            "game_id": slug,
            "display_name": name,
            "module_family": FAMILIES[index - 1],
            "core_framework": core,
            "runtime_contract": {
                "question_source": "selected_catalog_description_json",
                "map_mode": "hardcoded_reviewed_layout_selected_by_id",
                "audio_mode": "hardcoded_local_assets_selected_by_event",
                "variation_mode": "data_only_allowlisted_configuration",
                "difficulty_source": "server_assigned_catalog_value",
            },
            "asset_pack": "assets/logicade_starter_pack/asset_manifest.json",
            "source_prompt": f"{slug}/core_prompt.txt",
        }
        game_dir = prompts_dir / slug
        game_dir.mkdir(exist_ok=True)
        brief = [f"# {index}. {name} — Phaser core template", "",
                 f"Suggested reusable module family: `{FAMILIES[index - 1]}`.", "",
                 "Implement this as one reusable Phaser template. Take questions, CP1 topic, objective, difficulty, controls, and win/loss requirements from the selected LogiCade description JSON. Treat this design prompt as theme and gameplay structure only.", "",
                 core_text, "",
                 "Expose only validated configuration for map id, obstacle layout, asset IDs, and pacing. Keep the source questions and research requirement unchanged."]
        (game_dir / "core_template.md").write_text("\n".join(brief) + "\n", encoding="utf-8")

        variations = []
        for variation_index in range(1, 11):
            variation_file = f"variation_{variation_index:02d}.txt"
            text = prompt_text(concept_dir / variation_file)
            parsed = parse_brief(text, variation=True)
            parsed.update({"variation_id": f"{slug}_v{variation_index:02d}",
                           "game_id": slug,
                           "source_prompt": f"{slug}/{variation_file}"})
            variations.append(parsed)
            (game_dir / f"variation_{variation_index:02d}.md").write_text(
                f"# {name} — Variation {variation_index:02d}\n\n"
                "Implement this as validated data for the core template. Change its route/map, obstacle arrangement, pacing, and allowed animation cues as described. Do not fork its game code or change the source JSON's learning objective, questions, difficulty, or completion rules.\n\n"
                + text + "\n", encoding="utf-8")
        game["variations"] = variations
        frameworks.append(game)
        all_variations.extend(variations)

    catalog = {
        "schema_version": "1.0.0",
        "engine": "Phaser (existing LogiCade client)",
        "game_count": len(frameworks),
        "variation_count": len(all_variations),
        "games": frameworks,
    }
    (OUTPUT / "game_frameworks.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    readme = """# Claude Phaser game kit

This handoff kit contains a Phaser implementation brief, 50 core template briefs, 500 variation briefs, a machine-readable framework catalog, and the first CC0 sprite/map/audio pack.

## Start with

1. Open the existing LogiCade repository in Claude Code.
2. Give Claude `CLAUDE_IMPLEMENTATION_PROMPT.md` and ask it to follow the milestones in order.
3. Have Claude read the existing fallback JSON before implementing the first template. The JSON owns the CP1 research content.
4. Start with `prompts/01_platformer_quest/core_template.md` and its first variation. Add other template families after the host bridge and package flow work.

## Files

- `CLAUDE_IMPLEMENTATION_PROMPT.md` — architecture, security, data and event contract, work sequence.
- `game_frameworks.json` — 50 concepts, proposed code families, 10 data variations each, and source brief fields.
- `prompts/<game>/core_template.md` — implementation prompt for one core game.
- `prompts/<game>/variation_01.md` … `variation_10.md` — variation prompts to implement as data, not duplicated game code.
- `assets/logicade_starter_pack/` — 31 image/audio assets, two map layouts, manifest and license.

## Scope notes

The 50 entries are design frameworks and code-family recommendations, not 50 finished game implementations. They reuse the existing Phaser app and preserve the adjacent JSON + ZIP lazy-extraction experience. The sample maps are compact coordinate layouts that need a Phaser renderer. Asset IDs and map keys must be allowlisted. The generated prompts are Phaser implementation briefs based on the existing game concept definitions.
"""
    (OUTPUT / "README.md").write_text(readme, encoding="utf-8")

    with zipfile.ZipFile(ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(OUTPUT.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(OUTPUT.parent).as_posix())
    print(f"Created {OUTPUT.relative_to(ROOT).as_posix()}/")
    print(f"Created {ARCHIVE.relative_to(ROOT).as_posix()}")
    print(f"Frameworks: {len(frameworks)}; variations: {len(all_variations)}; prompt files: {len(frameworks) * 11}")


if __name__ == "__main__":
    main()
