# Weekly game interface research and asset handoff

Reviewed 29 October 2026. This document records browser observations, an implementation design, and downloaded materials. The weekly learner interfaces have not been rebuilt by this asset-import task.

Subsequent implementation: [EXECUTABLE_WEEKLY_MECHANICS.md](EXECUTABLE_WEEKLY_MECHANICS.md) documents the new working simulations and current limits. The observations below remain the original research/asset handoff.

## Inspected references

| Reference | Evidence inspected | Interface observations |
| --- | --- | --- |
| Factorio | [Official screenshot gallery](https://www.factorio.com/game/screenshots), screenshot 5 | The factory fills the workspace. Conveyors, machines, wires and item motion communicate state. A compact slot-based quickbar sits at the bottom; controls support the simulation rather than replacing it with a large question card. |
| TIS-100 | [Official product page](https://www.zachtronics.com/tis-100/) and its linked Steam screenshot | Black canvas, thin pale borders, dense monospace text. Objective and input/expected-output columns occupy the left. A matrix of instruction nodes occupies the rest; each has register/state readouts. Arrows connect nodes. Stop, Step, Play and Fast controls sit along the bottom. |
| SHENZHEN I/O | [Official product page](https://www.zachtronics.com/shenzhen-io/) and its linked Steam screenshot | A dark teal circuit board dominates the center, with chips, pin labels, embedded code, live register readouts and routed wires. The bottom combines execution controls, test progress and signal traces. A parts palette supports construction. |
| CodeCombat | [Public play flow](https://codecombat.com/play): dungeon map, first mission, hero/inventory setup, mission instructions and editor | Dungeon scene on the left; goals, source editor, Run button and available commands on the right. A compact top bar holds map/title/menu/hints. Bottom controls provide execution position, audio and display options. Goals and code are evaluated against visible world actions. |

Browser captures are in `artifacts/ui-research/2026-10-29/`. Desktop-game observations are from published screenshots, not interactive playtests of installed games. The CodeCombat public starter was opened without entering user credentials or completing a mission.

These observations support similar composition and interaction patterns using LogiCade's own styling. The downloaded assets are replacements; they do not reproduce the exact artwork, fonts, character designs or branding of these games. CodeCombat documents separate licenses for code, art/music and levels in its [repository](https://github.com/codecombat/codecombat); its levels are not open source. No source-game level, screenshot or commercial art is bundled in playable packages.

## Mapping to the approved weekly flow

| Week | Interface family | Programming activity and essential panels |
| --- | --- | --- |
| 2 | Circuit workbench | Flowchart symbols, input/output ports, draggable components and connectors; objective inspector, selected-node explanation, Run/Step/Reset and actual vs expected output. Keep CP1 flowcharting, rather than requiring the reference game's assembly language. |
| 3 | Terminal node grid | Ordered algorithm instructions in editable nodes; left input/output columns, node arrows, current-step highlight, local state, trace and execution controls. |
| 4 | Theme pending | Preserve the current neutral C-origins archive. No reference game has been approved for this week. Shared panels can be used without assigning a new gameplay theme. |
| 5 | Factory workbench | Main top-down factory map, conveyor routing and source-fragment machines; bottom tool slots, compact objective/progress inspector, machine input/output, Run/Step/Reset. Program fragments must determine observable output. |
| 6 | Code-guided adventure | Dungeon/world on left, line-numbered editor and command reference on right, Run/Reset below editor. Execute simple program statements to produce world actions and a launch result. |
| 7 | Terminal node grid | Typed resource declarations, assignment execution and variable watch table. Show scope and current line where relevant without changing the syllabus's variable-declaration focus. |
| 8 | C scope circuit workshop | Updated implementation: sensor → C controller → output probe, curved signal wires, highlighted C execution, global/local watches and target/actual output traces. See `WEEK8_SCOPE_CIRCUITS.md`. |
| 9 | Code-guided adventure and review | Mixed review of Weeks 2–8, editor, map, trace, goals and measured outputs. Formal assessment remains a separate server-controlled activity. |

Proposed proportions at 1440×900: terminal objective/I/O 22%, node grid 78%, bottom execution strip 12% height; circuit board 70%, parts/inspector 20%, navigation 10%, bottom traces 24% height; factory world roughly 80% with compact overlays and a bottom quickbar; adventure world 64%, editor/commands 36%, shared top bar and bottom timeline. These are LogiCade design targets inferred from the references, not exact measurements or requirements imposed by those games. At tablet sizes, panels should stack or become tabs instead of shrinking code text.

## Downloaded shared materials

All five packs were downloaded from their official pages, their bundled CC0 licenses checked, and the original archives retained. They are extracted once under `vendor/kenney/weekly-ui/`.

| Pack | Intended use | Official source |
| --- | --- | --- |
| UI Pack | Buttons, panels, sliders, arrows and slot controls | [Kenney](https://kenney.nl/assets/ui-pack) |
| UI Pack – Sci-Fi | Circuit workbench panels and instrument controls | [Kenney](https://kenney.nl/assets/ui-pack-sci-fi) |
| UI Pack – Adventure | Adventure panels, banners, checks, bars and buttons | [Kenney](https://kenney.nl/assets/ui-pack-adventure) |
| Fantasy UI Borders | Resizable fantasy panel frames | [Kenney](https://kenney.nl/assets/fantasy-ui-borders) |
| Tiny Factory | Top-down factory/conveyor tiles | [Kenney](https://kenney.nl/assets/tiny-factory) |

`games/assets/weekly-ui-manifest.json` lists exact URLs, file sizes, hashes, license paths, source URLs and intended weeks. Its `downloaded_not_integrated` status is intentional. View the packs at `/canvas-runtime/assets/weekly-ui-preview.html` while FastAPI runs. `scripts/fetch_weekly_ui_assets.py` reproduces the import and refuses to overwrite edited local assets.

Reuse the existing `vendor/kenney/organized/tiles/roguelike_rpg_pack/`, `roguelike_characters/`, `organized/audio/interface/` and other local audio libraries. The former `vendor/kenney/industrial/tiny-factory/` directory was empty; the newly populated Tiny Factory pack is under `weekly-ui/tiny-factory/`. No second dungeon/audio collection was downloaded. TIS-style frames, grid lines, node arrows, pin sockets and signal plots can be drawn directly in Canvas; they need execution data rather than large image libraries.

## Changes needed in the application

1. Split `games/runtime/engine.js` into real circuit, terminal, factory and adventure controllers. Its current weekly presentations are animated quiz shells, with answer buttons and decorative state. Assets alone cannot make their nodes, wires, machines and programs editable or executable.
2. Add accessible source editing, a bounded interpreter or approved execution backend, line diagnostics and state tracing. Never run student code with `eval`, `Function` or direct server execution. Distinguish parse errors, runtime errors and failed goal checks.
3. Define mode-specific JSON: map/tile layers, placed entities, collisions/boundaries, input fixtures, editable program or circuit, allowed commands, expected outputs and completion checks. Keep stable fallback identities and the existing week/level/difficulty directory structure.
4. Audit question-to-week alignment before migrating content: the current builder's Week 7 bank discusses scope while the curriculum names variable declarations; Week 8's bank discusses Boolean operators while the curriculum names scope. New world tasks must follow the approved course mapping. This download task does not silently rewrite those research definitions.
5. Align each description JSON's objective with a real completion predicate. Some legacy goals describe collection/streak/survival mechanics that the present four-station runner does not implement. Preserve source provenance when replacing those goals.
6. Feed node evaluations, executed lines, output comparisons, hint use, resets, retries and completion into the existing package event bridge. Keep first-attempt evidence, selected vs served difficulty, server coin authority and idempotent rewards.
7. Preserve `/serve` objective rotation, prepare/ZIP/description/manifest, private extraction leases, Start, pop and release. Shared assets remain URL references, never copied into thousands of packages.
8. Browser-test one complete interaction for each family before refreshing the full catalog: circuit wiring + test, terminal edit + step, factory routing + output, adventure source + collision + goal. Verify keyboard/touch, pause/Oracle, repeat/next/exit, reload and missing-asset errors.

Suggested build order: terminal executable core, circuit connections and traces, factory routing, adventure editor/world integration, then catalog migration and full learner regression. Week 4 stays pending until its design is selected. This is remaining implementation work, not a claim that the new interfaces or all weekly game mechanics are complete.
