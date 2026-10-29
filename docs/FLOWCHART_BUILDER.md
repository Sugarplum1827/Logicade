# Week 1 flowchart builder

Week 1 Stage 2 now asks the learner to build the requested algorithm using draggable flowchart blocks. The neon grid, colored pieces and tray retain the block-puzzle presentation. The board supplies numbered drop positions and connectors, including Yes/No branches and loop-back arrows. Learners choose and arrange operations; connectors are not drawn manually.

## Symbols and interaction

- Rounded Start/End symbols mark the entry and termination.
- Rectangles assign or update variables.
- Parallelograms read input or write output.
- Diamonds evaluate conditions and take a Yes or No branch.

Drag a tray block onto a position. Drag an existing block to another position to move or swap it, or return it to the tray to remove it. **Check chart** executes a complete arrangement; missing blocks prompt the learner to finish without consuming a life. A failed complete check consumes one configured life and explains the structural or execution error. **Clear board** removes placements without resetting lives or prior checks. Construction is untimed.

Keyboard users can select tray pieces with `[` and `]`, choose a position with the arrow keys, and place with Enter. Keys 1–9 select the corresponding tray item; `C` checks the chart. Native accessible buttons also support selecting any piece, placing it in a numbered position, and checking. Escape requests a pause. Host pause, resume, and Oracle hints use the existing package message interface.

## Ten authored scenarios

| Variation | Task |
| --- | --- |
| 1 | Read two numbers and display their sum. |
| 2 | Calculate and display a rectangle's area. |
| 3 | Decide whether an input is positive. |
| 4 | Display Pass for a score of at least 60, otherwise Retry. |
| 5 | Print every even number from 10 through 100, inclusive. |
| 6 | Print positive odd numbers strictly below `n`, then their sum and count. |
| 7 | Print integers from 1 through `n`, including the empty case `n = 0`. |
| 8 | Sum integers from 1 through `n`, including `n = 0`. |
| 9 | Display the larger of two numbers, including equal and negative inputs. |
| 10 | Convert Celsius to Fahrenheit. |

The task's boundary wording controls the expected output: variation 5 includes 100; variation 6 excludes `n`. These definitions correct the conflicting boundary examples in the reference images. The score threshold in variation 4 is a practice task and does not modify the adaptation rule.

Needs Support supplies the required blocks. Standard adds one distractor and Advanced adds two. Each canonical identity has a reproducibly shuffled tray. The ten scenario definitions are shared across profiles; these are not thirty unrelated algorithms.

## Execution and research data

`scripts/flowchart_scenarios.py` authors the puzzle data. `games/runtime/flowchart-model.js` interprets a restricted operation tree: named variables, assignments, input, output, arithmetic, comparisons, and bounded branching/loops. It does not evaluate JavaScript or arbitrary generated code. Runtime errors include undefined inputs, invalid placement, division by zero, unsupported operations, and a loop that exceeds the step bound.

Checking compares actual outputs with each scenario's expected outputs. A valid equivalent ordering can pass; for example, independent sum and count updates may be swapped. The supplied topology still constrains the possible solutions. Authored cases cover selected normal and boundary inputs, rather than proving correctness for every possible input.

Gameplay emits block placement/removal, reset, checkpoint and check events. Each checked input/output case produces a `question_answered` record; final accuracy is passed cases divided by all cases checked across the run, under `accuracy_basis: flowchart_execution_cases`. A successful final chart can therefore have less than 100% accuracy after earlier incorrect checks. Active and wall-clock durations are reported separately. These are gameplay measures, not formal assessment grades. The practice package contains its reference solution and case data.

## Files and packages

- `scripts/build_canvas_games.py` mirrors the canonical pool and attaches flowchart data to the internal `tetris` mode. Week 1 Stage 2 descriptions and controls match the builder. Other unavailable Week 1 records remain retained.
- `games/runtime/flowchart.js` draws and controls the board, symbols, drag/drop, keyboard access, feedback and telemetry.
- `games/runtime/index.html` loads both flowchart modules before the shared engine routes the mode.
- `server/canvas_games.py` verifies required flowchart content and compiles the selected definition into the existing ZIP/description/manifest workflow.
- `server/game_packages.py` requires the two shared modules when validating native packages.
- `client-react/tests/flowchart-model.test.mjs` checks all thirty scenario/profile references, output boundaries, invalid charts, bounded loops, safe operations and equivalent solutions.

Refresh with `python scripts/build_canvas_games.py --write`, then verify with `--check`. Restart FastAPI when changing source JSONs without a Python reload so its in-memory catalog refreshes. Existing prepared leases retain their selected data; select the stage again to prepare a fresh package after rebuilding.
