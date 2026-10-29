> Game delivery has moved from the deleted `game-platform/` prototype to the shared Canvas engine in `games/runtime/`. The game package flow is described in [GAME_PACKAGE_FLOW.md](GAME_PACKAGE_FLOW.md). Sections below that describe former game-specific interactions are historical unless explicitly available in the current runtime.

# CP1 curriculum implementation — 2026-10-28

> Current game note: four Canvas presentation modes share a single interaction engine. Lesson stations use this versioned course file; formal assessments remain separate.

The supplied specification is now the native course source. The original lecture document itself was not found in the repository; the nine-week outline supplied in the attachments defines the mapping below. Institutional statements are left empty until the instructor supplies them.

| Week | Mission | Implemented learning interaction |
| --- | --- | --- |
| 1 | Welcome to GameVerse | Controls/field guide, optional configured VMGO/PILOs/CILOs area |
| 2 | The Logic Labyrinth | Scout movement, input key, branching gate, standard flowchart symbols, planned/executed route |
| 3 | Algorithm Expedition | Executable action sequences, collisions, failed preconditions, revision and retry |
| 4 | The Origins of C | Discover/restore archive records on C's origins, procedural organization, uses and trade-offs |
| 5 | The Compiler Fortress | Include directive, reserved identifiers, program organization and a signal program |
| 6 | Power Up the Spaceship | Repair a C program, produce ordered output and power the launch beacon |
| 7 | The Variable Kingdom | int/float/char declarations, initialization diagnostics and live game-state inspection |
| 8 | The Scope of Power | Function calls, file-scope state, automatic locals, shadowing and scope-aware execution traces |
| 9 | The Midterm Expedition | Untimed public practice; separate authenticated, instructor-configured assessment delivery |

`data/curriculum.json` holds the current objectives and lesson mechanics used by the learner map and Canvas station bank. `data/weeks.json` remains the older DSL grammar input so historical game definitions and study records are not silently reinterpreted. New Canvas package descriptions include the curriculum version. Research comparisons must select the relevant curriculum version, especially where legacy fallback topic labels differ from the current week sequence.

## Gameplay and evidence

Use the CP1 mission cards in `/canvas-runtime/library.html`, or the normal signed-in level flow. The current game presents the learning tasks through its Manual / course workbench tab, the flowchart/scout task controls, archive controls, and C station. Thinking time does not affect the learning task's result.

In lesson mode, completing only the arcade objective cannot finish a level. The required programming task must also complete. Individual observations, retries, diagnostics, procedure attempts and practice answers are emitted as `learning_evidence` through the existing host telemetry path. They are explicitly separate from formal pretest/posttest results and game accuracy. Opening a guide or discovering records is evidence of exposure, not proof of mastery. Historical/lecture coverage still needs instructor review.

Standalone progress stores versioned run checkpoints, settings, completion, separate learning evidence and retry notes. Saves retain up to ten live runs; unsupported or malformed state is rejected. Configuration changes invalidate incompatible saves. Embedded participant games retain the existing host progression/outbox behavior; their opaque frame cannot access account storage, and full cross-device live-run restoration is not added here. Learning events inherit the existing unfinished-attempt/outbox limitations documented in REPAIR_VERIFICATION.md.

## C teaching interpreter

`src/education/CSimulator.js` tokenizes source, parses an AST and interprets supported statements. It does not invoke a compiler, evaluate JavaScript or run native student code. The UI labels it as an instructional subset.

Supported: stdio include, int/float/ASCII char declarations, initialization and assignment, basic arithmetic, nested blocks, parameterless helper functions, main(void), return, and literal printf formats using %d/%f/%c/%%. Limits bound source size, nesting, execution steps and call depth. Unsupported constructs such as loops, pointers, arrays, macros and recursion produce diagnostics. Functions must be defined before callers; prototypes are outside this subset. The numerical model uses signed 32-bit int, float32 values and ASCII char for these examples rather than claiming to emulate every C implementation.

Execution traces show the active function and visible typed values. Fresh automatic locals are created per invocation, file-scope state persists across calls, and shadowing is resolved lexically. Program completion is checked against task declarations and interpreted output, not a string search pretending to compile. Game-state inspection is a read-only C-style view of the displayed game resources; changing a beacon program does not grant account coins.

References: [WG14 N1570 C11 draft](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf) and [Ritchie's account of C's development](https://www.nokia.com/bell-labs/about/dennis-m-ritchie/chist.html). Material is paraphrased and examples are local instructional programs.

## Instructor configuration

- `data/curriculum.json`: lesson objectives, descriptions and mechanics. Keep changes versioned.
- `scripts/build_canvas_games.py`: mirrors one playable game definition per canonical fallback record and updates only its `canvas_runtime` pointer. Review the topic mismatch note in `docs/GAME_PACKAGE_FLOW.md` before using legacy topic labels as current research evidence.

## Formal midterm configuration and storage

In the administrator Settings area, upload a private JSON question bank. The server validates its schema and explicit approval flag. A bank with `approved:false` remains unavailable to learners. Approved content is never taken from the public practice bank automatically.

Required bank fields: `id` (letters/digits/underscore/hyphen), `version`, `approved` (boolean), and 1–50 `items`. Optional fields: title and `pass_percent` (null means no passing policy is inferred). Each item has a unique id, a topic from weeks 2–8, a prompt, a format and an answer. Choice items use `format:"choice"`, 2–6 choices and a zero-based integer answer. Numeric prediction items use `format:"numeric"`, a numeric-string answer and optional nonnegative tolerance. `points` defaults to 1 and may be 1–10. This allows multiple formats without grading typing speed or combat.

Vite also denies access to the private state directory, including Windows case variants. Banks are saved outside public mounts at `.state/cp1_midterm_bank.json`; previous versions are preserved under `.state/midterm_bank_versions/`. Changing content or approval requires a new version. Administrative publication is authenticated and audited. No approved bank or fabricated learner results are installed by this change.

In a signed-in week-9 game, select **Open instructor assessment**. The trusted React host requests the bank and a participant-bound signed attempt; the iframe receives no account token. Only questions and choices are returned, without answer keys. The server grades submitted answers and stores the result in the existing `assessments` table with `phase:"other"`, an instrument containing the bank/version, and curriculum/audit metadata. It does not alter pretest/posttest learning-gain data or game rewards. No new migration is needed beyond the existing assessment schema.

Submission retries preserve the same assessment ID and return the original stored result. Offline/storage failures keep answers and the retry token in the trusted host's local draft. Expired or changed-bank sessions require a new session; the UI provides a clear-draft action. Session tokens expire for security, but elapsed time is not part of grading. An immutable submission audit is included in the assessment row; an operational audit-log entry is also attempted. Instructor assessment-attempt limits and external gradebook integration are not assumed or implemented.

## Verification

Native tests: 35 cases, including the original game simulations, 120 C task profiles, 30 scout profiles, lexical scope/diagnostics, run restoration, learning evidence preservation and answer-only practice grading. Browser checks cover twelve lesson flows (all nine weeks plus alternate battle/strategy/platformer lessons), plus 23 collection/package/library cases. The formal assessment UI is tested using a clearly labelled mocked fixture for response failure, draft restoration, stable retry tokens, displayed server results and exit. Python tests validate private-bank redaction, participant binding, grading, idempotency, immutable bank versions and administrator publication. These checks do not constitute an actual learner examination or hands-on acceptance of every course/genre combination.
