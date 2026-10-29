# Historical Relay Works delivery

> This file describes a retired prototype and is not part of the current game runtime. The current four-mode Canvas engine and mirrored per-fallback game folder are documented in [GAME_PACKAGE_FLOW.md](GAME_PACKAGE_FLOW.md).

## Current game catalog

Relay Works is the single active owned Canvas game. It has ten production-line layouts, each available at Needs Support, Standard, and Advanced difficulty. The registry retains historical identifiers (`canvas_platformer`, slug `platformer`, and `canvas_platformer_v01`–`v10`) so existing learner routes, saved completion, and research records still resolve. The playable code and data are now only in `game-platform/games/automation/`.

All nine curriculum weeks point to this game. The server reserves a different variation for each level selection, cycles through the ten variations per participant and week, compiles the selected layout and description into the existing package format, and keeps using the normal prepare/release/pop lifecycle. There is no LLM generation in this game selection path.

## Factory game and learning systems

The fixed-step simulation handles finite ore, in-flight items, buffers, storage, construction credits, power links, controller registers, and execution traces. Ore becomes plate in a smelter and plate becomes circuits in an assembler. Belts route real materials; blocked routes, invalid instructions, unavailable power, and full storage stop production rather than creating phantom outputs.

The bounded relay language is `READ`, `REQUIRE material`, `ROUTE E/S/W/N`, `WHEN material ROUTE direction`, `COUNT`, and `YIELD`. The workbench supports construction, wiring, inspection, program editing, run, pause, single-step, reset, and speed controls. Difficulty profiles change the missing route pieces, resources, power budget, instruction budget, and material branch.

The nine-week curriculum, bounded C interpreter, untimed public practice, and separate authenticated instructor assessment remain available. Learning evidence is not a formal grade; gameplay scores are not assessment results or account coin balances. Institution-specific text and an approved private question bank remain instructor-supplied.

## Game-package and data boundaries

The learner keeps the existing `POST /serve`, `/api/games/prepare`, release, and pop flow. The package contains a launcher, variation data, description, and manifest; shared Canvas code and Kenney artwork stay outside per-level ZIPs. Prepared packages use private temporary leases. Selection state is private under `.state/canvas_usage.json`.

The cleanup removes the seven retired native genres from the registry, runtime imports, and selection path, and removes their exclusive device-controller UI and checks. Their source directories remain in the OneDrive-backed workspace because Windows safety review could not confirm the cloud reparse targets before recursive deletion. The 2,700 canonical fallback JSON records, the 270 fallback templates, student accounts, gameplay/research history, shared asset library, and optional legacy Phaser runtime are retained. Historical IDs and older verification reports are not active catalog entries.

## Builder and checks

`scripts/build_automation_catalog.py` is the source builder for the ten factory layouts and their 30 profiles. `scripts/build_canvas_catalog.py` remains as a small compatibility command that calls the same builder and cannot recreate the retired genres. The active browser checks are `scripts/check_automation_browser.mjs` and `scripts/check_factory_package_browser.mjs`; active package integration checks are in `tests/test_canvas_packages.py`.

No learner database rows are rewritten by removing these game directories. Restart FastAPI after updating so its in-memory registry and curriculum reload.
