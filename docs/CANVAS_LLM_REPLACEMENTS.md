# Verified Canvas replacement pipeline

Implemented 29 October 2026. This completes the native background replacement integration that followed the level-objective and prompt-contract work.

## Player flow

1. Selecting a level resolves difficulty and serves an existing matching challenge immediately.
2. Preparing the mission compiles its matching ZIP and extracts a private lease. Its description and revision identify exactly what will run.
3. Completion, Exit or Repeat marks that played revision as consumed and queues a background replacement. Repeat selects a different existing challenge; it does not wait for model inference.
4. Qwen proposes bounded parameters for the exact same level objective, source lesson and difficulty. Renderer code and shared assets remain authored and reusable.
5. The server builds executable challenge data and a reference solution. It rejects stale bindings, unchanged learning problems, invalid archive choices and changes that cannot fit the original execution budgets.
6. The shipped browser models execute the reference, check outputs/world goals, and reject a deliberately invalid solution. Archive answers are checked against the curated topic bank.
7. Only a passing candidate replaces its source JSON, mirrored game JSON, ZIP, description JSON and manifest JSON. Canonical names and folder locations stay the same. The in-memory catalog is refreshed after commit.

The existing verified source remains usable until its replacement passes. “Pop” removes the consumed compiled sidecars, not the last playable source. Active extracted games are immutable and continue running during publication. The welcome video is not regenerated.

## Lesson constraints and new content

- Week/level, source-week/source-level, objective identity, difficulty, required C type, assets and study configuration remain fixed.
- New operands, input streams, reference output, bounded flowchart constants, selected authored scenarios and applicable maps are constructed from the proposal.
- C code is produced by bounded server templates, never accepted as executable text from the LLM. No arbitrary JS, HTML, shell command, URL or asset path is accepted.
- Learning-problem fingerprints exclude cosmetic seeds, titles and archive answer ordering. A new title or maze seed alone cannot establish a fresh C problem.
- The archive authoring bank includes one additional curated application question per subtopic. The worker offers combinations absent from the active bucket and retained history; it never fabricates history facts from model prose.
- The declaration and scope stages retain their assigned types and visibility constructs. Week 9 keeps its explicit source-level blueprint.

Generation provenance distinguishes `llm_verified_pool` content from `authored_fallback_pool`. A served replacement is still a previously verified pooled game, not a claim that every `/serve` request invoked the model.

## Queue, retries and records

`data/runtime/canvas_replacement_jobs.json` is an atomic local job store. Jobs are coalesced by canonical slot and consumed revision, so Finish followed by Exit does not launch two generations. A signed, automatically issued consumption token binds the revision to the authenticated learner. These tokens are never sent to the LLM. There is no additional login step.

States are queued, generating, verifying, publishing, retry, published and obsolete. One worker serializes model work. It makes up to three proposal/build attempts, then waits five minutes before retrying. Invalid JSON, wrong lesson/type, duplicate semantics, verification failure, unavailable Ollama or missing Node leave the last verified pool content in place.

Interrupted active jobs resume after restart. Already committed generations are reconciled rather than generated twice. The store retains eight published jobs per stage/difficulty bucket and up to 100 obsolete records; published counts are retained history, not all-time research totals. Admission is capped at 1,000 active jobs; a full queue preserves the current pool and reports the reason.

The AI admin page shows actual queue counts, latest retained jobs, retry times and diagnostic errors. Generation outcomes are also sent best-effort to the existing Supabase generation and audit tables when configured. Local queue records identify the system worker, target and outcome; they contain no student identifiers or credentials. All `data/runtime` files are denied by the public data mount.

## Publication and concurrency

Publication uses a per-file package lock and a write-ahead journal under `data/runtime/canvas_publications/`. A source revision/hash check prevents overwriting a changed source. If a write fails, the five artifacts are restored. Prepared transactions are recovered before loading the catalog on restart. A rollback that cannot complete quarantines the slot until recovery. Two recoverable snapshots per slot are retained.

Compact challenge definitions are retained by SHA-256 revision under `data/runtime/canvas_revisions/`, independently of the two rollback copies. Replacing a slot preserves both its previous and candidate definitions. A verified candidate can remain here even if publication later fails; its presence alone does not mean a learner received it. Attempts keep the selected revision locally, and a `challenge_revision` event preserves that revision, content origin, learning objective and source slot in the existing server event payload. This also works when the gameplay telemetry buffer is empty. Consumption tickets are excluded. No additional attempt-table columns or schema migration are needed.

One API process owns the publication lock, including when replacement generation is disabled. Start Uvicorn with its default single worker or `--workers 1`. Other API processes sharing this workspace are refused; this release is not a distributed publication service.

Application readers see committed catalog data; each ZIP contains a coherent revision. This is a journaled filesystem transaction, not a claim that unrelated external file readers get a multi-file database transaction.

The client saves its extracted lease for refresh restoration. An older valid lease can continue after another learner replaces its pool slot. Missing/expired leases are re-prepared when possible; a stale mission selection must be reselected rather than silently receiving another revision or falling back to the old renderer. Older clients without a revision/ticket can leave their game but do not trigger a replacement until refreshed.

## Configuration and rollout

- `LOGICADE_CANVAS_REPLACEMENTS=1` is the default for native Canvas mode; set it to `0` for existing-pool rotation without background inference.
- Keep the configured local Ollama model available. The real test used `qwen2.5:3b`.
- Node.js must be visible to the API process for execution verification. `LOGICADE_NODE_BINARY` can name its executable explicitly. Failure to find/run the verifier never bypasses verification.
- Restart FastAPI and refresh the client after this update. The production client build is updated. No Supabase migration is required.
- Desktop packaging includes the runtime verifier, shared Canvas files and only the Kenney files referenced by game definitions. It excludes operational queues, revision history, extracted leases and package backups from the shipped data. A complete desktop installer build was not part of this verification.

The 60% adaptation rule, initial 20 coins, 6-coin hints, first-clear rewards, progression history and formal assessment scoring are unchanged. Oracle hints remain the selected challenge's stored guidance; live conversational hint generation is a separate feature.

## Verification

The affected backend suite includes generated references for all 243 authorable stage/difficulty combinations, wrong proposals/answers, repeated semantics, durable restart, single-worker ownership, publication rollback, interrupted-journal recovery, old leases, nonblocking consumption, owner-bound tokens and stale revisions.

Final checks: 118 affected backend tests and 109 frontend tests passed. All 2,700 fallback definitions have matching reproducible Canvas definitions (zero missing or stale). The production client build and verifier/admin script syntax checks passed. The build retains its existing large JavaScript chunk warning. These checks used isolated pools and local test databases.

The real Qwen trial ran in an isolated copy at `artifacts/canvas-pipeline-live/20261029T122244-d2ab3f/`. Its first proposal failed schema checking; attempt 2 built, executed, and published a new float-stage ZIP. Browser play then passed all three streams. `report.json`, the matching package and `browser-verified.jpg` retain the result. The live pool and learner/study data were not changed by that trial.

Reproduce with `python -m scripts.test_canvas_replacement_live`. This creates a fresh isolated artifact workspace and runs the real pipeline without publishing into the live pool. `scripts.canvas_generation_preview` can serve the result using `LOGICADE_GENERATION_QA_ROOT` pointed at that workspace.
