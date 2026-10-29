# Connected C programming games

This replaces the component-directory interpretation with the requested per-game TIS-inspired workspace. Each assigned terminal challenge opens directly into multiple editable connected nodes, execution controls, and its target/actual output panel. The previous directory scripts, styles and standalone component library have been removed.

## Gameplay

- Needs Support uses four nodes; Standard and Advanced use six, arranged across two rows. Arrows and each node's port labels describe its actual incoming/outgoing connections.
- Every node uses a full C `int main(void)` program. Simple arithmetic is distributed as C assignments between nodes in order. Countdown algorithms use a bounded C `while` loop. C-variable lessons preserve their required declaration/type checks. Assembly input is rejected in every editor.
- Each node shows typed C variables, source line, read/sent counts, execution mode and measured idle percentage. White code lines executed during the displayed cycle; gray lines wait to read or write. Highlights refer to actual C source statements, excluding comments and include directives.
- Connections have capacity one. Incorrect ports, extra output, deadlocks, invalid instructions and exhausted cycle budgets fail verification. Every required node must receive and forward data before success.
- Run animates execution, Fast advances it more quickly, Step advances one cycle, Pause retains the current trace, and Stop resets the simulation while preserving programs and prior checks. Host pause, Oracle hints and normal game completion events remain integrated.
- All input streams run automatically during verification. Players cannot select or skip test streams; the output panel follows the current execution frame.

## Output views

Numbers shows exact target and actual values. Text displays string signals and printable ASCII integer codes. Signal image displays a grayscale encoding of the same ordered values, using a fixed scale derived from the target and a row-major grid. Empty cells represent values that have not arrived. This is a signal visualization, not an unrestricted image/video generator; exact stream values and C type requirements still determine success in every view.

The challenge assigns its output format. There are no player-facing Output View or Test Stream selectors, and no selection handlers remain in the runtime.

## C language and node connections

Each node runs `main` once for each incoming signal. It must read one input and send one result. `readPort(LEFT)` and `writePort(RIGHT, value)` are LogiCade game helpers declared by the virtual `logicade.h` header, not standard C library functions. Directions are `UP`, `RIGHT`, `DOWN`, `LEFT`. Existing C lessons can also use `readInput()` and `printf`; their output follows the node's connected outgoing channel. Port reads occur at their traced C statement, and writes wait when the next channel is full.

The bounded interpreter supports `int`, `float`, `double`, `char`, declarations, assignments, arithmetic, comparisons, `if/else`, `while`, `for`, postfix increment/decrement and compound assignments. Loop conditions and bodies count against execution limits. Block/for scopes and existing character/type/format checks remain enforced. This is a documented educational C subset, with no native execution, pointers, arrays, filesystem, arbitrary includes or external libraries. Use `double` for fractional forwarding and `char` for character forwarding; relays retain both without unwanted integer truncation.

## Existing records and LLM integration

`terminal-network-model.js` deterministically adapts the selected challenge into a version-2 C-only connected network. Older stored algorithm references are translated as trusted authoring data into C statements; players never enter or execute that older assembly syntax. Existing fallback JSONs keep their original problems, cases, expected outputs, learning objectives and difficulty budgets. There is no bulk rewrite of participant data or previously published pool records.

The trusted server verifier loads the same adapter and independently executes the connected C reference solution and an invalid negative control before an LLM replacement can be published. Its receipt includes `terminal_network_version: 2`, `language: c` and node count. Gameplay events and code checkpoints also identify network version 2 and C. Existing JSON/ZIP selection, private extraction leases, completion, reward and background replacement mechanisms remain in use.

The normal engine dispatches terminal missions to `terminal-network.js`; other game families continue using their existing renderers. Newly prepared ZIPs load its shared model, UI and CSS from `games/runtime`. Existing extracted games should be exited and prepared again to load the updated HTML script references. Restart FastAPI if necessary and refresh the client.

## Main files

- `games/runtime/terminal-network-model.js`: deterministic node/port adaptation and bounded execution.
- `games/runtime/terminal-network.js`: per-node editors, trace highlighting, transfers and output views.
- `games/runtime/terminal-network.css`: monochrome grid and responsive layout.
- `games/runtime/c-runtime.js`: C statement source-line information in execution traces.
- `games/runtime/index.html`, `engine.js`: shared resource loading and renderer dispatch.
- `server/canvas_verify.cjs`: independent connected-reference verification.
- `server/game_packages.py`: required shared runtime files.

## Validation

All 660 existing terminal definitions across the algorithm, C-variable and examination regions pass with C programs in every connected node. Tests also cover missing node code, rejection of assembly, wrong ports, nonterminating programs, C loop/branch semantics, loop scope, fractional/character ports, source-line mapping and invalid declaration types. All 120 frontend tests and 51 affected backend package/replacement tests passed. Script syntax checks passed.

Isolated browser previews confirmed the connected grid, white source-line highlights, active transfer arrows and target/output checking. The C-only update replaces every editor and variable watch with C. No participant/study records or production pool files were written by these preview tests.

Current proof: `artifacts/c-only-node-execution.png`. The earlier `connected-terminal-*` screenshots document the superseded mixed-language iteration.
