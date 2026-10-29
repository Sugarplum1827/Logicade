# Executable weekly mechanics

The latest user-specified syllabus integration supersedes the earlier weekly mapping and counts below. See [CP1 curriculum integration](CP1_CURRICULUM_INTEGRATION.md) for the current executable flowcharts, C source exercises, true global/local scope and Week 9 coverage. The following sections retain the earlier implementation history.

Implemented 29 October 2026 after browser research of the source games. These are smaller LogiCade practice simulations inspired by their mechanics, not implementations of the commercial games or copies of their levels.

## Research and adaptation

- [Factorio's official content guide](https://www.factorio.com/game/content) describes production chains, finite logistics scenarios, energy and programmable automation. [Its belt-system documentation](https://wiki.factorio.com/Belt_transport_system) explains transport and throughput. LogiCade adapts the build–route–power–produce loop; its conveyors have one-cell buffers and its two recipes are deliberately simpler than Factorio's production system.
- [TIS-100's official description](https://www.zachtronics.com/tis-100/) and [reference manual](https://www.zachtronics.com/images/TIS-100P%20Reference%20Manual.pdf) center on repairing executable instruction nodes and evaluating streams. LogiCade has two editable nodes connected by bounded queues, accumulator/backup state, arithmetic, labels, conditional jumps and visible stepping. Its IN/OUT interface is a simplified linear pipeline, not the complete directional-port TIS architecture.
- [SHENZHEN I/O's official description](https://www.zachtronics.com/shenzhen-io/) connects circuit construction, components, code and verification. LogiCade adapts component placement, real pin connections and testing input/output traces. Its current circuit is an acyclic, one-input-per-component signal network; programmable microcontrollers, clocked memory and multi-pin Boolean chips are outside this implementation.
- [CodeCombat's official engineering worksheet](https://files.codecombat.com/docs/resources/WorksheetExample.pdf) teaches planning, writing a program, running it and debugging visible behavior. The public starter's map/editor/Run loop was inspected in the browser. LogiCade uses a bounded command parser for typed variable declarations, assignment, arithmetic, nested lexical scopes, observation and movement. It is neither a complete C compiler nor a Python/JavaScript interpreter.

## Active catalog

The 2,700 canonical identities and filenames remain. There are 2,460 learner-playable records: 30 welcome-video choices, 30 opening flowchart choices and 2,100 executable weekly choices plus 300 unchanged neutral Week 4 choices. The 240 historical Week 1 Stage 3–10 definitions remain unavailable. Canonical source JSON, mirrored game definitions and prepared ZIPs keep their existing relationships.

| Week | Mechanics | Measured success |
| --- | --- | --- |
| 1 | Existing welcome video and executable drag/drop flowchart | Video completion or actual chart output checks |
| 2 | Circuit components, placement, pin wiring and stream tests | Three authored input/output cases |
| 3 | Two editable stream-processing nodes | All input/output cases, including negative inputs |
| 4 | Original neutral challenge; theme undecided | Existing CP1 station questions and configured time/lives |
| 5 | Draggable conveyors, splitter/router forks, fair mergers, separate production paths, power and batch controllers | Exact total plus each branch's quantity, processing path and destination |
| 6 | Programmed movement and declarations | Collectibles, exit position and required observed variable values |
| 7 | Stream nodes with required declared/updated resource state | Output cases plus the final required variable state |
| 8 | Programmed navigation and lexical shadowing | World goals plus inner/outer observations |
| 9 | Navigation, declarations and scope review | Combined world and variable-trace goals; this is not yet an exhaustive review of every Week 2–8 concept |

The user chose to keep Week 4 unchanged. The proposed terminal archive was reverted: all 300 Week 4 definitions use the original neutral challenge, descriptions, tutorials and timers; its mode remains `pending`. New builds do not attach programming missions to Week 4. The 60% adaptation rule, stratum definitions, coin authority and formal assessment route were not changed.

## What varies in JSON

`scripts/programming_missions.py` authors each challenge, delegating Week 5 networks to `scripts/factory_missions.py`. `scripts/build_canvas_games.py` creates its versioned `programming` object in the mirrored definition and updates the matching canonical objective, controls, tutorial, win and loss text. Original objective/mechanic/title fields are preserved under `source_*` where changed.

Shared fields include `version`, `mission_id`, `family`, `objective`, `rules`, `controls`, `hint` and the practice `reference`. Mode-specific fields are:

- Terminal: editable `nodes`, `instruction_set`, input/expected-output `cases`, optional archive `constants` and `required_variable`.
- Circuit: component `palette`, starting `nodes`, `wires`, component values and stream `cases`.
- Factory: dimensions, fixed and editable `machines`, directions, power `wires`, finite `ore`, actual `ore_values`, `recipes`, exact `target`, belt budget, controller socket/type and each controller sprite's `quota`. The versioned `routing` contract specifies fork type/socket, permitted branch labels, router condition, optional merger socket and per-branch targets (`id`, `target`, required processing machine IDs in `via`, destination `output`).
- Adventure: collision `map`, measured `map_features`, `start`, `exit`, `gems`, expected observed values, command budget and editable `program`.

There are ten authored scenario entries per weekly stage/profile, varied by deterministic parameters. The 900 adventure definitions now contain 900 distinct seeded maze layouts, from 13×9 to 21×15 cells. They combine carved corridors, rooms, dead ends and extra cross passages; measured junction counts range from 6 to 82 and every layout has at least two cycles. A breadth-first route check constructs a reference that visits every crystal and reaches the exit. Required observations, crystal counts and positions also vary. These are 2,100 parameterized executable definitions sharing four simulators. Selection rotates available objectives per learner, stage and difficulty. After exhaustion, the pool cycles without immediately repeating the last objective; it does not generate unlimited new content at runtime.

## Assembly sprite interaction

The machine sprites are the draggable blocks. The tray contains Conveyor, Splitter, Conditional Router, Merger, IF/ELSE, WHILE and FOR sprites with short descriptions. Players drag the batch controller onto the gold socket, the splitter/router onto the purple fork socket and, when required, a merger onto the blue join socket. They set batch size, fork output directions, router condition/threshold, repair conveyors and connect power. Placed editable sprites can be moved; fixed production machines cannot. Click-to-select plus numbered grid controls provide a keyboard alternative. The factory has no text-code editor or nested textual block editor.

All assembly routes include horizontal and vertical sections with editable conveyor bends. Connecting a conveyor's incoming neighbor automatically draws a rounded corner when input and output are perpendicular; R rotates the output arrow. The geometry uses the same directions as material transport. Production machines occupy straight route cells so they do not hide the corners, and missing pieces include a turn to repair. The simulator still advances one grid cell per transfer; rounded rendering does not introduce diagonal shortcuts.

Each controller implements a preset production policy: IF/ELSE releases when the source is clear and waits otherwise, WHILE releases until the batch condition becomes false, and FOR releases one item per counted iteration. All policies respect source backpressure and the batch quota. The simulator checks controller type, socket, power, routing, recipe order and exact output count. The trace displays the active controller action. These are configured controller sprites, not arbitrary learner-authored C statements or a general loop interpreter.

All 300 factory definitions now have two real production branches. Ten variations per stage/profile combine three topologies: separate output depots; plate streams merging before a shared assembler; and separate assemblers merging finished components before a shared output. Route rows, fork positions, batch sizes, ore values and conditions vary. The stage descriptions include the actual branch rows so rotation continues to distinguish all ten objectives.

Splitters alternate A/B and wait when the scheduled output is blocked; they never send that item down the other branch to satisfy throughput. Routers evaluate each item's value using an even-number or >= threshold condition, selecting IF/ELSE and waiting for that destination. Both output directions are configurable. Mergers have a one-item buffer and arbitrate ready upstream pieces by round robin; material already queued in upstream conveyors waits until there is space. No transfer overwrites an occupied buffer or duplicates an item.

Each item retains its identity, value, chosen branch and actual processing history. Delivery is counted separately by output and by branch contract; an item only satisfies a branch when it visited that branch's required machines and reached its declared depot. The final result includes a total-production check and two branch checks. Input values and branch targets are visible to the learner, and the live trace shows per-branch deliveries. Batch controllers and routing junctions are separate machines.

## Runtime and data boundaries

`games/runtime/program-model.js` is a pure bounded interpreter/simulator; `program-workbench.js` and its stylesheet provide the Canvas world and accessible editors, controls and inspectors. `index.html` loads them before the engine dispatches the selected family. No student text is passed to eval, Function, a shell or direct server execution. Unsupported syntax, disconnected/cyclic circuits, blocked movement, missing power, incorrect recipes, quotas, output order and execution limits produce failed checks.

Construction is untimed. Every completed execution check contributes its measured goals/cases to the run's `program_execution_goals` accuracy; failed checks consume existing configured lives. A successful final revision can therefore have less than 100% aggregate accuracy. Clear/reset retains prior checks. Step displays successive computed simulation states; Run plays the trace and verifies all configured cases. Pause stops playback; editing or reset discards the active trace. Failed output traces remain visible for inspection until the next edit/run.

Telemetry includes execution start, displayed steps, check results, checkpoint solutions, hints and reset events. Only verified success emits activity_completed. Reward and attempt persistence stay in the existing host bridge; no study data was fabricated or inserted by the isolated browser tests. Gameplay results remain separate from formal assessment scores.

Packages still use `/serve` → description → prepare/ZIP → private extraction → Start → completion/exit/repeat pop and release. Canvas code and Kenney assets are shared by URL. The new JS/CSS modules are required during package validation.

## Verification and limits

The model tests execute reference solutions for every one of the 2,100 executable definitions, plus adversarial cases covering cycles, deadlocks, unsupported code, bad outputs, missing power/routes, wrong quotas, collision and scope leakage. Browser QA uses disposable source copies and exercises editable terminal programs, component wiring, conveyor repair, power connections, a real quota, collision feedback and corrected adventure goals through the existing sandbox contract.

The authored fixtures cover chosen cases and boundaries, not a proof of every possible program. Practice packages include their references and cases. Factory power is connectivity-based, without an energy consumption model. There are no combat systems, enemies, trains, mining research trees, general functions or arbitrary C loops in this release. Map/command/goal fields support bounded authored variations; additional mechanics require explicit interpreter/controller support and tests. LLM-authored mission generation is not enabled by adding these schemas.

The 29 October sprite/maze revision passed 97 frontend tests, 41 focused backend tests, a production frontend build and the 2,700-definition mirror check. Browser tests used real pointer drags for all three controller types, rejected a controller moved off its socket, then accepted the corrected factory. See `artifacts/sprite-factory-and-mazes/2026-10-29/RESULTS.md` for screenshots and the scope of those checks.

The later branching revision passes 103 frontend tests, including every executable reference, all 300 factories with reversed-corner failures, routing predicates, per-branch destinations, blocked ports, item conservation and congested mergers. See `artifacts/factory-branches/2026-10-29/RESULTS.md` for browser evidence and final package/build checks.
