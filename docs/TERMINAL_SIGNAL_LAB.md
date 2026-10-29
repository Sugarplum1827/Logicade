# Terminal signal lab

Historical implementation note: this component-directory approach was superseded by the user's corrected per-game connected-node requirement. Its directory scripts/styles and practice-only component library have been removed. The current runtime is documented in `CONNECTED_TERMINAL_GAMES.md`.

The native terminal games now open an original monochrome component directory inspired by the supplied reference. It is available wherever a Canvas mission has `programming.family = terminal`, including the algorithm stations and C-variable terminal stations. The assigned challenge remains visible in the left column and can be resumed at any time.

## Components

| Component | Executed practice contract |
| --- | --- |
| Self-Test Diagnostic | Relay every value unchanged. |
| Signal Amplifier | Multiply each numeric value by the displayed gain. |
| Differential Converter | Read pairs and output first minus second. |
| Signal Comparator | Output -1, 0 or 1 for each pair's relationship. |
| Signal Multiplexer | Read selector, A and B; select A for 0, otherwise B. |
| Sequence Generator | Generate 1 through N for each positive input N. |
| Sequence Counter | Output a cumulative event count, one event per input. |
| Signal Edge Detector | Compare each value with its predecessor, initially zero. |
| Interrupt Handler | Forward values strictly above a displayed threshold, otherwise zero. |
| Signal Pattern Detector | Detect adjacent 2 then 7. |
| Sequence Peak Detector | Output the running maximum, initially zero. |
| Sequence Reverser | Reverse batches of four values using node variables. |
| Stack Memory Sandbox | Reverse four values using PUSH/POP and per-node LIFO memory. |
| Simple Sandbox | Experiment within an explicit input/output relay contract. |

Each component has three generated verification streams, two editable nodes, Run, Step, Stop and Reset controls, visible registers, queues, program counters and memory. Execution uses the existing bounded interpreter, with no JavaScript evaluation or external compiler. PUSH/POP are permitted only by the stack lab's instruction contract and require `practice_only: true`; capacity is 32 values per node. Underflow, overflow and cycle/instruction limits fail visibly.

## Programs and statistics

Create up to eight drafts per component, copy the current program, switch drafts, or generate a new input dataset. Drafts and statistics are kept in memory for this extracted game session; leaving/reloading the game clears them. There is no simulated filesystem or misleading Open Save Directory button in the sandboxed browser frame.

Directory histograms contain only actual successful practice runs from this session. Cycles measure the first verification stream's recorded execution frames; node and instruction counts describe the submitted two-node program. These are local diagnostics, not a leaderboard or all-time study totals. Empty states appear before any successful runs.

## Study integration

The lab preserves the assigned program, selected learning objective, difficulty and remaining lives. While the component directory or lab is open, assigned simulation execution and its active-play clock stop. Host Pause/Resume also stops practice execution. An Oracle hint returns to the assigned challenge so its stored hint remains relevant.

Practice emits a custom `terminal_lab_checked` telemetry event with `practice_only: true` and `formal_assessment: false`. It never emits `question_answered`, `activity_completed` or `game_over`, never grants rewards, never completes a study stage and never asks the background worker to replace a slot. The assigned challenge retains its original scoring and replacement path. Pair processing, signal patterns and stack concepts are offered as extra practice rather than silently replacing approved CP1 level objectives.

## Files

- `games/runtime/terminal-components.js`: original contracts, streams and reference programs.
- `games/runtime/terminal-lab.js`: directory, program drafts, trace canvas, practice checks and statistics.
- `games/runtime/terminal-lab.css`: responsive monochrome presentation.
- `games/runtime/program-model.js`: existing interpreter plus bounded practice-only PUSH/POP.
- `games/runtime/program-workbench.js`: assigned-challenge/lab navigation and pause isolation.
- `games/runtime/index.html`: shared script/style loading.
- `server/game_packages.py`: required shared-runtime file checks.

No fallback JSON curriculum records, LLM prompt rules or database schema changes are required. A newly prepared ZIP includes the shared lab script/style references; existing leases opened before this update should be exited and prepared again. Restart FastAPI if it is not running with automatic reload, then refresh the browser.

## Validation

All 112 frontend tests passed, including 14 component references across four seeds, intentionally incorrect programs, stack limits, and existing authored missions. All 51 affected package/replacement tests passed. Browser checks covered failing and passing amplifier programs, copying a draft, actual statistics, stack stepping, practice telemetry isolation, returning to the original assigned program, and a 768-pixel tablet directory with all 14 cards and no horizontal overflow. Preview tests used disposable packages and wrote no learner/study records.

Screenshot: `artifacts/terminal-lab-directory.png`.
