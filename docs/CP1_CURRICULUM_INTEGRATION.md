# CP1 syllabus integration — 29 October 2026

The follow-up [level-objective binding](LEVEL_OBJECTIVE_BINDING.md) now enforces stage-specific challenge pools, preserves each stage's lesson heading and defines explicit Week 9 source levels. Its curriculum version supersedes the initial weekly-only binding described below.

This release implements the user's nine-week lesson sequence in the current Canvas package architecture. It supersedes the earlier arithmetic-circuit Week 2, neutral Week 4, register-instruction Week 7 and nested-block-only Week 8 implementations. The opening region still has its two approved stages. The canonical 2,700 identities remain, with 2,460 playable records and the 240 historical Week 1 Stage 3–10 records unavailable.

## Weekly learning and gameplay

| Week | Lesson | Implemented learning activity |
| --- | --- | --- |
| 1 | Orientation | Existing welcome video, controls and guided drag/drop interface practice. This warm-up does not replace Week 2. |
| 2 | Flowcharting | Real terminator/process/input-output/decision symbols, labeled branches, loop-back arrows and execution against input/output cases. Uses the existing flowchart controller rather than arithmetic circuit verification. |
| 3 | Algorithms | Specify input/output, order register instructions, trace intermediate state and repair a finite procedure. The small register language is explicitly identified as algorithm practice, not C syntax. |
| 4 | C introduction, history, characteristics and classification | Researched C archive activities: Ritchie, Bell Labs, B/Unix, the early 1970s, general-purpose/procedural/imperative classification, compilation and portability. The informal term “middle-level” is not presented as an ISO classification. |
| 5 | Components, reserved words, preprocessing and organization | Construct a source file from code blocks; classify keywords, identifiers and directives; verify actual output. The existing branching factory must also satisfy its per-branch production contracts. These are separate checks; the factory is an analogy, not a native C compiler. |
| 6 | Simple programs and C structure | Use a complete `int main(void)` example with declarations, assignments and `printf`, then navigate an actual collision map using documented game helpers. Output and world goals must both pass. |
| 7 | Basic C parts and variable declarations | One C program station per mission. Practice `int`, `float`, `double` and `char`, initialization, assignment, expression order and matching output formats. The required variable's real type and final value are checked across several input streams. |
| 8 | Local/global sample programs | Actual file-scope declarations before `main`, main-local and nested locals, zero-initialized globals, shadowing, sibling scopes and assignment to visible state. Checks include printed values, final global state and map goals. |
| 9 | Examination of Weeks 2–8 | Ten stages revisit the corresponding earlier controllers. These game exercises are labeled examination practice. The existing server-graded formal midterm and pretest/posttest instruments are preserved and are not silently replaced or re-scored. |

Each game includes an expandable lesson with key points, a source example and primary references. The map consumes the same curriculum JSON. Game metadata freezes the curriculum version and reports the source week for each activity. An examination stage reports only its actual source-week coverage; the separate examination blueprint lists coverage of all seven weeks.

## Week 9 blueprint

| Stage | Source lesson | Activity |
| --- | --- | --- |
| 1 | Week 2 | Flowchart construction and execution |
| 2 | Week 3 | Algorithm instruction sequence |
| 3 | Week 4 | C history, characteristics and classification |
| 4 | Week 5 | C source components and factory contracts |
| 5 | Week 6 | Simple C program and navigation |
| 6 | Week 7 | Typed declarations and output |
| 7 | Week 8 | File/global and local scope |
| 8 | Week 2 | Further flowchart application |
| 9 | Week 5 | Further source-organization application |
| 10 | Week 8 | Local/global program synthesis |

This is topic coverage, not a claim that every individual stage assesses every earlier concept. Formal examination validity, item selection and score policy remain controlled through the existing published assessment instrument.

## Runtime, content and files

- `data/curriculum.json` is the shared syllabus, stage guide, source list and examination blueprint.
- `scripts/rebuild_cp1_curriculum.py` explicitly rebuilds that researched syllabus; it is not an automatic server-start overwrite.
- `scripts/cp1_lessons.py` supplies per-stage lessons, C source assemblies and typed-variable exercises.
- `scripts/programming_missions.py` generates the weekly executable missions and delegates examination stages to their actual source week.
- `scripts/factory_missions.py` retains the splitter/router/merger networks.
- `scripts/build_canvas_games.py --write` updates canonical descriptions and mirrored definitions. Filenames, folder/difficulty organization and IDs are preserved.
- `games/runtime/c-runtime.js` parses and executes the bounded C practice subset. `logicade.h` documents the simulated game-port and movement interface.
- `games/runtime/lesson-guide.js` renders lesson text, examples and source links using text nodes.
- The existing flowchart, workbench and package controllers integrate those modules. Package validation now requires both new JavaScript files.

The final mode distribution is 30 welcome videos, 270 opening-region flowcharts (including unavailable historical stages), 360 circuit-presented flowcharts, 660 terminal activities, 330 C archive activities, 360 factories and 690 adventures. There are 1,710 executable programming missions plus 360 Week 2/examination flowcharts, 30 playable orientation flowcharts, 330 archive records and 30 welcome records: 2,460 playable choices total. These are parameterized challenges sharing controllers, not 2,700 independent engines.

## C-subset boundaries

The runtime parses source into bounded syntax trees. It never evaluates JavaScript, runs a shell, invokes a native compiler or reads arbitrary files. Supported teaching constructs include the documented two headers, integer object-like macros, a single `int main(void)`, basic typed declarations, initialization/assignment, arithmetic/comparison expressions, nested blocks, simple `printf` formats and allowed game helpers. Integer division truncates toward zero; floating division remains floating. File-scope uninitialized objects are zero-initialized; uninitialized automatic reads fail. Game helper names are identifiers and are not ISO C keywords.

It is not a full C implementation. Arrays, pointers, arbitrary functions, general C loops, general preprocessing/linking and complete library behavior are outside this release. Character exercises use ASCII 0–127 and numeric values are bounded. The entry point/helper names cannot be redefined in this teaching subset. Portability claims and the factory analogy must not be interpreted as native compiler conformance.

## Research sources

Original, short teaching summaries and examples were authored for LogiCade; reference text and screenshots were not copied into the asset pool.

- [Dennis Ritchie's history paper](https://cm-bell-labs.github.io/who/dmr/chist.html): C's origins, B, Bell Labs and Unix.
- [OpenStax on algorithms and programs](https://openstax.org/books/introduction-computer-science/pages/3-1-introduction-to-data-structures-and-algorithms): precise procedures and implementation in a programming language.
- [Victoria's official flowchart teaching resource](https://www.education.vic.gov.au/school/teachers/teachingresources/discipline/english/literacy/Pages/using-flow-charts-to-design-algorithms.aspx): chart notation and algorithm design. Its indexed primary text was available; direct retrieval timed out during this session.
- [GCC header inclusion](https://gcc.gnu.org/onlinedocs/cpp/Include-Syntax.html) and [object-like macros](https://gcc.gnu.org/onlinedocs/cpp/Object-like-Macros.html): preprocessing and token replacement.
- [GNU C variables](https://www.gnu.org/software/c-intro-and-ref/manual/html_node/Variables.html) and [manual](https://www.gnu.org/software/c-intro-and-ref/manual/c-intro-and-ref.html): declarations and scope. Indexed primary text was available; direct retrieval timed out during this session.
- [Harvard CS50 C notes](https://cs50.harvard.edu/x/notes/1/): program structure, declarations, types and output formatting. CS50-specific `string` and input helpers were not presented as standard C types/functions in LogiCade.

## Validation and rollout

The frontend suite passed 107 tests. Every one of the 1,710 executable references and 360 Week 2/examination flowcharts passes its actual model checks. Tests reject wrong output, broken routes, incorrect C types, bad source order, incorrect keyword categories, uninitialized reads and scope leakage. The package/selection suite passed 37 tests, including topic coverage, required dependencies, canonical identities, private extraction leases and objective rotation. The production frontend build passed with its existing chunk-size advisory.

Browser QA used temporary copies and the real package compiler/extractor without study writes. It verified a missing-global error followed by a corrected Week 8 completion, Week 7 floating-point output, the Week 5 source-building prerequisite plus factory completion, and a dragged/verified Week 9 flowchart. Screenshots are in `artifacts/cp1-curriculum/2026-10-29/`.

Restart FastAPI after rebuilding the pool, refresh the app and reopen a stage to prepare a current package. Existing extracted games retain their embedded configuration. The initial 20 coins, 6-coin hint cost, first-clear authority, 60% adaptation rule, account information and existing formal assessment data were not changed.
