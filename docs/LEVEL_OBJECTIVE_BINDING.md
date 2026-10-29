# Level-specific learning objectives

Implemented 29 October 2026. Curriculum version: `cp1-stage-objectives-v1-2026-10-29`.

The level now determines the learning focus. A variation changes inputs, constants, fixtures, maps, tray order, conveyor topology or question combinations within that focus. Difficulty retains the existing support scaffolding, decoys, lives and complexity settings. The 60% adaptation rule and all assessment/reward records are unchanged.

## Binding and selection

`data/curriculum.json` retains the published stage sequence. `scripts/cp1_lessons.py` resolves the stage, its `objective_id`, and the examination source level. Both each fallback description and its mirrored Canvas definition carry the learning-objective identity. Lesson headings keep the stage focus instead of being replaced with a randomly selected exercise title.

The existing selector continues rotating among the ten matching week/level/difficulty records. The catalog excludes stale or mismatched objective bindings. The ZIP compiler verifies the same binding and the fallback's week, level and difficulty before packaging. It does not silently substitute another level's lesson.

## Content changes

- Week 1 retains its welcome video and guided interface practice. Historical stages 3–10 remain unavailable.
- Week 2 levels 1–3 use sequences, input/output or expressions; levels 4–5 use decisions and boundary cases; levels 6–8 use counting, accumulation or loop tracing; level 9 compares branches; level 10 combines earlier flowchart skills. Inputs and parameters vary. Alternate graph placements preserve executable arrows and Yes/No branches.
- Week 3 selects the procedure by level. Order-comparison, repair and bounded countdown exercises belong to their assigned stages. Input streams and operands vary within each stage.
- Week 4 uses separate stage question banks. Five questions per introductory subtopic yield ten distinct three-question combinations. Level 10 reviews the wider archive. No stage borrows another subtopic's bank accidentally.
- Week 5 keeps complete source assembly and keyword classification in context, with the assigned component named explicitly. Preprocessor/header/macro stages use a symbolic constant in the source. Factory maps, split/merge paths, controllers and targets continue varying independently of the C focus.
- Week 6 fixes the C task by stage, including a genuinely faulty starter for repair practice. Values, maze layouts and navigation requirements vary.
- Week 7 fixes types by stage: `int` for levels 1–6 and 10, `float` for 7, `double` for 8 and `char` for 9. Equality versus assignment and integer division have their own exercises. All streams check the required declaration and final value.
- Week 8 fixes global/local/initialization/shadowing/nesting/visibility exercises by stage, with varying C controller values and signal-board layouts. Required wiring, reference output, block scopes and final global state are executed and checked. See `WEEK8_SCOPE_CIRCUITS.md`.

Contextual prerequisites remain visible: a header lesson can still contain `main` and a print statement. Restricting the focus does not remove the surrounding syntax needed for a runnable program.

## Week 9 source-level blueprint

These are game-based examination-practice activities; formal assessments retain their existing instruments and scoring.

| Examination stage | Source week | Source level / focus |
| --- | --- | --- |
| 1 | 2 | 10 — Flowchart synthesis |
| 2 | 3 | 10 — Algorithm synthesis |
| 3 | 4 | 10 — History/classification review |
| 4 | 5 | 10 — Build and verify a source file |
| 5 | 6 | 10 — Program synthesis |
| 6 | 7 | 10 — Integer division with typed declaration and output |
| 7 | 8 | 9 — Compare local and global |
| 8 | 2 | 10 — Further flowchart synthesis |
| 9 | 5 | 9 — Source organization |
| 10 | 8 | 10 — Scope trace synthesis |

`exam_blueprint` identifies source weeks; `exam_level_blueprint` identifies source stages. Each review stage has a stable learning focus while its ten problems vary. This blueprint does not claim that the declaration review alone assesses every C type or every earlier stage.

## Validation and rollout

- All 2,700 canonical definitions are rebuilt; 2,460 remain playable.
- Boundary tests inspect the actual generated code, flowchart structure, question banks and ten-variation diversity across all difficulty buckets.
- Existing browser-model tests execute every generated programming reference and Week 2/9 flowchart, including negative solutions, unsafe source and broken routes.
- Package tests reject stale/misfiled objective identities and a description from another learning objective.
- Disposable browser QA verifies float declarations in two variations/difficulties and rejects `double` even when its numeric output matches.
- Verification result: 107 frontend tests and 54 affected backend tests pass. All 2,700 mirrors are current. The production build passes with the existing bundle-size advisory.
- Browser QA also completed Week 2 Level 2, Advanced variation 8, by dragging Start → Read value → Write value → End and checking all four input cases. Screenshots are in `artifacts/stage-objectives/`.

Restart FastAPI after rebuilding, refresh the client and open a fresh mission. Already extracted or running games retain their embedded configuration. No participant progress or formal study results are rewritten. The C runtime remains the documented bounded teaching subset.

Rebuild with `python scripts/rebuild_cp1_curriculum.py`, then `python scripts/build_canvas_games.py --write`. Verify with `python scripts/build_canvas_games.py --check`, the backend stage/package tests and the frontend test suite.
