# Week 8: C Scope Circuit Workshop

Week 8 uses an original Shenzhen I/O–inspired signal network in the existing native Canvas runtime. Learners wire a sensor to a C scope controller, broadcast its signal across parallel C branches, merge every branch result with SUM, and feed the merged result back through the branches for a bounded number of passes before the output probe. Curved wires turn white when active; the board displays the current pass, active node, globals, locals, and target/actual output traces. Program node selects each C editor; Follow executing node switches editors and highlights the executing line during Run or Step.

Controllers use the same safe C interpreter as the other C lessons. `readInput()` and `writeOutput()` are LogiCade helpers declared by `logicade.h`; they are not standard C library functions. Each node invocation starts a fresh program. File-scope objects persist across blocks during that program, and initialize again when a new invocation starts. Different controllers do not share C variables; wires carry numeric signals. This is not a complete C compiler or electronic circuit simulator.

## Branches, merging and loops

- Authored variations use two, three or four branches and two or three complete passes. The bounded interpreter supports 2–6 branch controllers and 1–6 passes, within each mission's component and execution limits.
- SPLIT broadcasts a copy of its signal to every branch. Each branch has its own editable C program and arithmetic task, shown beside Program node.
- SUM waits for exactly one result from each incoming branch in the same pass. It combines all values; a missing branch cannot silently disappear or be replaced by another branch's result.
- LOOP sends the merged signal back to split until its pass count is reached, then sends it once to output. Both wires must be connected. Feedback passes is editable but must match the mission.
- Multiple incoming and outgoing wires are retained. Connect pins adds an edge; Remove selected wire removes only the selected edge. The checklist shows every required connection.
- Run animates the verified execution and Step advances one trace frame. Fast runs the same checks and displays the final state immediately; it logs the number of trace frames skipped and does not skip correctness checks.
- A bounded signal queue executes the graph iteratively. Limits on C execution, overall execution, queue size, trace length and feedback passes prevent infinite execution. Duplicate edges, unintended bypasses, missing merger inputs, wrong branch calculations and excessive pass counts fail verification.

The primary scope controller still performs the stage's assigned local/global lesson and prints its required scope trace before forwarding its original sensor input. Branch operations and feedback operate on that signal. The final required output combines the scope trace with the final network result. The curriculum lesson IDs and adaptive thresholds do not change.

## Lessons and pool

| Stage | C scope lesson |
| --- | --- |
| 1 | File-scope declarations |
| 2 | Main-local and global variables |
| 3 | Implicit zero initialization of globals |
| 4 | Reading globals in local expressions |
| 5 | Block shadowing without changing the global |
| 6 | Nested local scopes |
| 7 | Updating a global using a local value |
| 8 | Separate sibling block lifetimes |
| 9 | Comparing local and global values |
| 10 | Restoring global visibility after a local block |

All 300 Week 8 slots retain their original lesson IDs, difficulty categories and ten variations. Week 9 stages 7 and 10 retain their assigned Week 8 review objectives and use the same circuit mechanic (60 additional slots). Other weeks keep their existing mechanics. The canonical 2,700-record inventory is retained, including the previously unavailable historical Week 1 records.

`scripts/scope_circuits.py` creates the authored missions. `scripts/programming_missions.py` routes Week 8 and its examination reviews to that builder. The LLM contract derives its `circuit` family from the canonical mirrored record and can propose bounded values and layout seeds. It cannot replace the lesson, supply executable browser code, or bypass independent runtime verification.

## Files and preparation

Sources remain under `data/fallback_pool/week_8/level<level>/<difficulty>/`, mirrored definitions under `games/week_8/...`. Existing names, ZIP preparation, description JSON, manifest JSON, package release, and consume/replacement flow remain in use. Shared Canvas code and existing shared asset/audio paths avoid duplicating assets inside each ZIP. No commercial reference-game artwork or code was added.

`python -m scripts.migrate_week8_circuits --write` verifies and publishes the 360 affected slots while holding the same exclusive lock as the live generator. Stop FastAPI before running it. Publication journals preserve recoverable previous files; existing extracted leases are not rewritten. Re-running skips slots with `signal_network.version == 2`. The migration updates the Week 8 curriculum genre and registry mode counts and writes `artifacts/week8-network-migration.json`. The original linear-circuit migration report remains at `artifacts/week8-circuit-migration.json`.

Verification checks actual C execution, required declarations and block scopes, implicit zero initialization, final globals, one incoming signal read per controller invocation, branch transformations, merge sums, exact pass counts, exact outputs, required wiring, and bounded source/execution limits. These gameplay checks remain separate from formal assessment scores. The runtime retains support for already extracted version 1 linear circuits.
