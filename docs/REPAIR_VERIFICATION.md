# Repair verification — 2026-10-28

> **Later catalog cleanup (2026-10-28):** The seven-genre Canvas catalog and related checks described in the historical entries below were superseded. Relay Works is now the only active owned Canvas game, with ten layouts and three difficulty profiles each. Its old `platformer` slug and variation IDs remain for compatibility. Retired games were removed from registry and runtime selection, and their exclusive device runtime/tests were removed. Their OneDrive-backed source folders remain because Windows safety review could not verify the cloud-directory targets for deletion. Fallback definitions, shared assets, user records, and database contents were retained. See [the current game-platform guide](../game-platform/README.md).

## Verified external state

The configured Supabase target is local. `supabase migration list --local` reports matching applied versions 001 through 016. Zero-row PostgREST reads confirmed the required account, attempt metadata, coin, difficulty, device-sync, audit and study-metric columns. Migrations 015 and 016 were applied with `supabase migration up --local`; no hosted database was targeted. They change schema, database functions and a view, but do not rewrite participant or account rows.

A subsequent read-only comparison checked eight admin attempt metrics against the five stored attempt rows: started, completed, failed, incomplete, hints, restarts, question retries and completed full-level replays. All eight agreed. The check selected only statuses and numeric gameplay fields; it did not print participant identities or modify records.

## Implemented repairs

- The browser outbox selects only records owned by the signed-in participant and captures the token for each drain. Switching accounts stops the old drain and schedules the new participant's queue.
- Dependencies are checked after parent-table responses. Backed-off parents hold their children locally; a failed coin purchase no longer blocks unrelated difficulty records.
- Known dead schema/FK jobs receive one recovery pass per participant for this client revision. Recovered retry counters and dates are used by the actual upload payload.
- Legacy global wallets/progression are no longer copied into each account. Wallet writes wait until that account's stored values are loaded. Difficulty assignments are restored on reload as well as region selection.
- A level is saved before a next-level decision references it. Its original assignment is preserved across replays; each attempt stores its actual OpenCode variation.
- Each game run has a stable attempt ID. Duplicate completion callbacks cannot add another attempt for that run. Telemetry is captured before asynchronous persistence, preserving event timestamps and offline origin.
- Delayed result and hint responses are scoped to the participant and game run. Old results cannot grant progress to a different login.
- Privileged sync checks existing record ownership, parent ownership and event/attempt level consistency. Immutable gameplay inserts ignore duplicate IDs. Difficulty updates filter by the authenticated owner.
- Participant coin uploads cannot request a starting balance or arbitrary amount/reason. Online hints use the existing atomic six-coin ledger RPC. Registration alone initializes the starting balance.
- Registration uses a service-only database function, so participant creation, the 20-coin opening transaction and account creation either all commit or all roll back. Existing account rows are not rewritten.
- First-clear rewards are available on the first successful completion, even if earlier attempts failed. Transaction IDs and the participant/level uniqueness rule prevent duplicate credits.
- Level sync stores an explicit stage number, refuses stage reassignment, and fills only a missing stage on a legacy row. Authenticated progress reads restore completed and active stages from synchronized records.
- The uniqueness rule on the client-local level ordering index was removed so separate devices can sync level rows without index collisions. The admin progression summary now prefers the explicit stage number, and the level-history table displays it separately from the local index.
- Admin full-level replay totals count completed replays; replay entries that are abandoned remain separate. Unavailable numbers display a dash.
- Expired extraction cleanup runs on application startup rather than Python module import.

## Regression checks

From `client-react`, `npm test` runs the browser persistence/outbox checks in an asynchronous in-memory database. From the project root, run the mock-backed server suite and then the rollback-only local SQL check:

```powershell
.\.venv\Scripts\python.exe -m pytest -m "not ollama and not integration" -ra
supabase db query --local --file tests/sql/test_015_atomic_rewards_stage.sql
supabase db query --local --file tests/sql/test_016_cross_device_stage_records.sql
```

The Python checks use a fake PostgREST transport and in-memory ASGI HTTP. Package-flow checks compile a copied source description into temporary folders, then validate serving, pop, release and eight simultaneous private previews. They leave the real fallback pool and study database untouched. On restricted Windows execution, asyncio's internal socket pair requires local socket permission even for these isolated checks.

Production checks: `npm run build` from `client-react` and Python compilation of the changed server modules. These establish buildability and HTTP resource availability; they do not establish manual playthrough of every game or authenticated end-to-end gameplay sync with a live learner session.

Current follow-up results are summarized in the 2026-10-28 section below.

## Remaining requirements

Offline coin charges remain provisional. Browser crashes can leave a start without a terminal event; full incremental attempt checkpoints need schema/rollup support to avoid freezing an unfinished score as the immutable first-attempt score. Older progress rows without a stage number cannot be safely backfilled because `level_index` is a local ordering value rather than a stage number; those rows remain unchanged until the learner next opens the level on an updated client. The wallet has an authenticated server balance read and displays an unverified marker while pending/offline; balances are not reconciled while this participant has queued coin transactions. The legacy optional Phaser template directory remains absent.


## Initial native Canvas prototype (superseded by the expansion below)

The owned `game-platform/` now implements the platformer concept with 10 authored route variations and three distinct profiles per route (Needs Support, Standard, Advanced). It reads shared images and sound effects directly from `vendor/kenney/organized/` instead of copying them into each package. FastAPI compiles the selected variation into the existing private package lease, serves the shared runtime and Kenney assets with the CORS headers needed by the opaque-origin game iframe, and removes the popped per-level ZIP on the normal exit flow. The original fallback JSON remains the stable level identity/description source. Week 1 uses this Canvas runtime by default; weeks 2–9 and the six other proposed genres have not been migrated.

The native test suite passed 8 checks covering actual platform movement/collisions, a complete first-stage traversal on Standard and Advanced profiles, ordered switch interactions, blocks/checkpoints/hints, damage/loss, reachable authored routes, Kenney asset/curriculum references, and pause/cleanup. Package tests passed for 10-variation selection, compile/prepare/pop/release, opaque-origin asset access and keeping package leases isolated. A browser preview confirmed the built game loads Kenney assets, emits `game_ready` and `game_started`, accepts host pause/resume and Oracle hint messages, and retains the same scene through those interactions. This is a focused smoke test; it is not an end-to-end authenticated Supabase gameplay test and it does not establish full manual traversal of every profile.

The current frontend regression suite passed 40 checks, lint passed with no warnings, and the production build passed. Vite still reports the legacy Phaser chunk above its default size warning. The mock-backed Python suite passed 141 checks, with 5 Ollama/Supabase integration checks deselected. The native Canvas simulation suite passed 8 checks. SQL smoke checks for both migrations passed using synthetic rows inside rollback-only subtransactions. The Python ASGI tests used Windows loopback permission for in-memory requests; no participant rows were queried or changed by the tests. Migrations 015–016 were separately applied to the local Supabase database.

The current platform uses CP1 week identifiers found in `data/weeks.json`. That source contains weeks 1–8; week 9 curriculum is not defined. It does not make formal assessment claims, and it does not add institutional VMGO statements.

## Seven-game expansion — 2026-10-28

The native platform now contains seven separate gameplay/render modules, 70 authored variations and 210 difficulty configurations. The six added modules implement top-down exploration, creature battles, action RPG combat, side-scrolling action, tactical drone rescue and kingdom strategy. They use the existing shared Kenney collection, movement/effect sounds and the native fixed-step Canvas engine. No new external game-generation service or package dependency was introduced.

Native selection now covers all nine study-week slots and prefers a different genre when available. A participant sees all 70 variations before a new selection cycle; immediate variation reuse is avoided. Selected difficulty aliases map to the correct profile. The normal description, same-stem ZIP, private extraction, pop and release workflow remains in use. Native mode does not depend on the optional generated-game library and fails visibly if its owned library is unavailable. No database migration or participant-data modification was performed for this expansion.

Verification found and corrected three enemies embedded in terrain, body navigation cutting wall corners, excess starting energy in a constrained battle, battle tournament balance, and extraction permitting scouts to be left behind. Movement now uses actual walk frames where available. Oracle/mission messages avoid overlapping the directional touch controls, and the game canvas preserves its proportions on tablet screens.

Current results:

- **24 native test cases pass.** Catalog tests load all 210 configurations, validate referenced assets and layout differences, and check reachable objectives. Full input-driven simulations win all 180 difficulty configurations in the six new genres using actual movement, attacks, resource costs, encounters and wave logic. Existing platformer tests check its 30 route profiles and full Standard/Advanced first-route traversal. These are simulation checks, not 210 manual browser playthroughs.
- **23 automated Chrome cases pass:** seven genres at first/Standard, tenth/Advanced and tablet/Needs Support settings, an actual prepared ZIP in the opaque-origin iframe with start/pause/resume/hint, and the seven-card library. No page errors or failed asset requests occurred. Battle input advances a turn, strategy input spends the correct construction cost, and paused canvases remain unchanged. The seven captured game screens and library were visually inspected. Results/screenshots are in `artifacts/canvas-browser/`.
- **152 mock-backed Python checks pass; 5 external integration checks are deselected.** These include native package context and aliases across all genres, the 70-selection cycle, private lease safety, weeks 1/9 selection/prepare/pop/release, private selection-history migration and blocking encoded/normalized public download paths. Temporary packages and fake database transports keep study records unchanged.
- **40 frontend checks pass; frontend lint and production build pass.** The existing legacy Phaser chunk still exceeds Vite's size warning threshold; native game modules load separately.

Interactive Windows verification was replaced by isolated automated Chrome checks because the existing browser window repeatedly minimized. This did not require logging in or changing browser security settings. Device-specific audio playback and hands-on touch experience still need user acceptance. Authenticated end-to-end learner/reward synchronization has not been re-established by these mock/preview tests. Week 9 curriculum and instructor-approved C/institutional lesson content remain unavailable; gameplay analogies are explicitly marked as non-assessment. Standalone previews save completion/best scores but restart a live run after reload. The 2,700 preserved fallback identities are not 2,700 newly authored native games, and replacement selects from authored variations rather than asking an LLM to invent new game code.

Native participant selection history now lives under `.state/canvas_usage.json`, outside the public mounts and version control. On first startup, the old `data/canvas_usage.json` is atomically copied into private storage before its old file is removed. The public data mount rejects requests for that filename even if an old file remains. Restart FastAPI to load the expanded catalog and this protection.

## Syllabus and assessment follow-up — 2026-10-28

The later supplied nine-week specification supersedes the initial curriculum gap above. Native course content is now versioned in `game-platform/curriculum.json`: weeks 6/7/8 teach simple program structure/declarations/scope respectively; week 9 is midterm review/assessment. Legacy DSL content and historical study rows were not relabeled. Native template metadata is version 2.1.0. Eligible game variations cycle separately per week; syllabus-based selection replaces the unrestricted genre choice for lesson delivery.

Implemented learning interactions include scout procedure execution with flowchart symbols and branch preconditions; discoverable C records; a bounded AST-based instructional C interpreter with real declaration, assignment, arithmetic, output and lexical-scope behavior; typed game-state inspection; and a separately scored untimed review. Lesson-mode victory requires its learning task. Standalone games now restore compatible saved runs, while learner-frame progression retains the existing host/outbox system. Retry observations are versioned separately from game accuracy; they are not formal assessments or a claim of full topic mastery.

Formal midterms use an administrator-published private question bank, signed participant-bound attempts, server-side answer grading and the existing `assessments` table with phase `other`. The trusted React host handles the assessment; its token never enters the game frame. Repeated submissions return the original saved grade. Versioned private bank archives and assessment-row audit metadata preserve the grading context. Private state is also denied through Vite's filesystem routes, including case variants on Windows. No bank was approved or real assessment row created during development.

Final checks: **158 mock-backed Python tests passed, 5 external integration checks deselected; 40 frontend tests passed; 35 native tests passed; frontend lint and production build passed.** Vite's existing legacy Phaser chunk-size warning remains. Browser acceptance passed **12 lesson scenarios** (all nine weeks plus three alternate genre lessons) and **23 collection/package/library scenarios**. A separate, clearly labelled mocked assessment UI test passed storage-error recovery, answer restoration, identical retry tokens, server-result display and exit. That test also verified private-state downloads are blocked by the dev server. Screenshots were visually inspected; a teaching-overlay clearing bug and unreadable flowchart label were corrected and checked again.

The 35 native cases include 120 C task profiles, 30 scout profiles, valid alternative expressions, reserved/uninitialized/scope diagnostics, malformed-save rejection, live-run restoration, evidence retention and gameplay gating. These do not claim manual traversal of every game/lesson combination or a real learner's authenticated examination. Actual VMGO/PILOs/CILOs and an instructor-approved private examination bank/marking policy remain content inputs. See `docs/CP1_CURRICULUM_IMPLEMENTATION.md` for configuration and current limits. No new database migration was required.

## Industrial programming redesign — 2026-10-28

See [AUTOMATION_REDESIGN.md](AUTOMATION_REDESIGN.md). Relay Works is the active first genre with ten factory layouts and 30 production profiles. The other six genres now require actual device instructions for machine operations. All 210 gameplay profiles complete in input-driven simulations; the 55 native cases also cover blocking, power, source/trace behavior, controller preconditions, persistence and licenses. Nine factory week flows and six device interfaces plus an opaque package bridge passed browser checks. Python (158) and frontend (40) regressions, lint and build passed; no real learner writes were used. This extends the earlier collection and curriculum work rather than claiming manual acceptance of every combination.
