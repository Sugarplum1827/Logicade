# LogiCade

The current weekly syllabus, game integration, examination coverage and C-runtime limits are documented in [CP1 curriculum integration](docs/CP1_CURRICULUM_INTEGRATION.md).

LogiCade is a data-driven programming-learning game. React manages the player journey, FastAPI serves learner and research APIs, and Supabase stores synchronized progress and aggregate analytics. The active game system uses one shared HTML5 Canvas engine with seven presentation modes, per-level JSON definitions, and shared Kenney assets. The old `game-platform/` directory is not required.

## Project layout

- `client-react/` — React 19, Vite learner interface and legacy Phaser-compatible frontend.
- `games/runtime/` — shared Canvas controllers for orientation, executable flowcharts, algorithm/register practice, C history activities, source-building factories, typed C exercises and local/global-variable adventures.
- `games/week_*/level*/*/` — one Canvas definition mirrored for each canonical fallback JSON, with the same filename and difficulty folder.
- `games/assets/manifest.json` — shared Kenney CC0 references and one shared copy of the LogiCade prologue video; game assets are not duplicated per level.
- `server/` — FastAPI API, game catalogue, LLM generator, verifier, and pool fallback.
- `data/fallback_pool/` — 2,710 existing game JSONs. The canonical manifest lists 2,700; 10 unlisted historical JSONs are preserved but are not mirrored or served.
- `data/fallback_templates/` — 270 playable fallback templates with their own richer runtime schema.
- `data/manifest.json` — index of game files and runtime mission metadata.
- `data/registry.json` — sprite and tilemap registry. This is separate from the game manifest.
- `supabase/migrations/` — database schema, immutable attempt rollups, access rules, and analytics views.
- `admin/` — private research and operations panel at `/admin/` with participant, catalogue, LLM, analytics, gameplay, export, audit, and settings views.

`scripts/build_canvas_games.py --write` creates the 2,700 canonical Canvas definitions and adds a `canvas_runtime` pointer to each fallback record. The playable catalog contains 2,460 records: Week 1 exposes only Stage 1 (prologue video) and Stage 2 (flowchart Tetris); Week 1 Stages 3–10 are retained as source definitions but blocked by both the UI and `/serve`. Week 4 remains unchanged with its neutral challenge and undecided theme. `/serve` selects a real fallback record for the assigned week, level and difficulty and returns its matching Canvas game. Mission preparation compiles a small ZIP with the game definition and description; shared engine and Kenney art remain served by FastAPI.

## Local development

1. Install the Python dependencies from `requirements.txt` and the frontend dependencies in `client-react/`.
2. Start the local Supabase stack with `supabase start` and copy its local API URL, anon key, and service-role key into `.env`. The service-role key stays on the server; browser writes go through FastAPI.
3. Apply pending migrations to the existing local database with `supabase migration up --local`. This applies migrations without resetting local data.
4. In one terminal, run FastAPI from the repository root with `uvicorn server.main:app --reload --port 8000`.
5. In a second terminal, run `npm run dev -- --host 127.0.0.1 --port 5173` from `client-react/`, then open `http://127.0.0.1:5173/`. Vite forwards `/api`, `/serve`, `/canvas-runtime`, `/vendor`, data/assets, and extracted `/game-builds` to FastAPI on port 8000. Native Canvas is the default for selections in all nine study weeks. A private ZIP lease contains the selected game launcher and description; code and Kenney assets are shared. A static preview server such as `python -m http.server` cannot handle account or gameplay POST requests; do not use it to serve the React learner app.
6. For a single-server production-style preview instead, run `npm run build` from `client-react/`, start FastAPI, and open `http://127.0.0.1:8000/app/`.
7. For the desktop window, run `python run_desktop.py`.

The admin panel accepts the configured administrator email (default `kohnqui@gmail.com`) and `LOGICADE_ADMIN_KEY` as its password; the key is exchanged server-side for a short-lived signed session and is not stored in the browser. Set `LOGICADE_ADMIN_EMAIL` to override the configured email and set a dedicated `LOGICADE_SESSION_SECRET` to sign sessions independently of the admin password. Participant accounts are stored in the private `app_accounts` table with PBKDF2 password hashes, case-insensitively unique usernames and student numbers, and a separate pseudonymous gameplay `student_id`. Email is retained for legacy accounts but is not required for new registrations. Apply migrations through `016_cross_device_stage_records.sql`. Registration creates the participant, 20-coin ledger entry and account in one database transaction. The server requires signed participant sessions for gameplay sync, game serving, and generation/replacement actions.

## Data integrity and verification

Run `python scripts/validate_game_data.py` to parse and validate every indexed game and fallback template without rewriting source JSON.

Use `python scripts/build_canvas_games.py --check` to verify that the game mirror covers each fallback record. In `client-react/`, `npm run build` checks the production frontend bundle.

## Database and analytics

Attempt and event data is written to IndexedDB first. A retrying outbox syncs only the signed-in participant's students, levels, attempts, telemetry, and coin transactions through `POST /api/sync/batch`. Parents are confirmed before their children, and server-side ownership checks validate all level and attempt links. Rows with differing optional field sets are split into compatible PostgREST batches. SQL triggers derive per-level, per-week, and per-student summaries while preserving first-attempt scores. Migrations 015–016 store explicit stage numbers, allow separate devices to sync level rows sharing a local ordering index, and add an authenticated `/api/progress/stages?week=N` read so learners can restore synchronized stage progress on another device. The configured local database is applied through migration 016; this does not imply any hosted database has been migrated. The admin API requires a signed admin session or the configured `LOGICADE_ADMIN_KEY`.

Admin views are based on synchronized server records. New participants start with 20 coins and each hint costs 6. Online hint charges are validated atomically by the server coin ledger; offline charges remain provisional until synchronization. First-clear rewards are idempotent and are issued on the first successful completion, even if an earlier attempt failed. Device outbox counts and the last successful upload are reported to the sync dashboard. Generation attempts are logged best-effort if database configuration is active. CSV, XLSX, PDF, and DOCX dataset exports are available, but the full filtered report builder remains limited. The admin page calls out the current 60% rule against the conflicting 50% narrative, and the approved 90-activity total against the described 80 plus Final Core Challenge breakdown; it does not change the rule or enforce a content count.

When applying migrations to a linked hosted database, review the pending migration list first. `supabase db push` applies pending migrations to the linked remote database; it does not reset the database.

## Game library and compatibility

Weeks 2, 3 and 5–9 use executable programming workbenches: connected circuits, editable stream nodes, routed factory production and code-controlled adventures. JSON defines inputs, outputs, maps, quotas, limits and world goals. See [executable weekly mechanics](docs/EXECUTABLE_WEEKLY_MECHANICS.md) for the active mapping, research sources, verification and supported language subset. Week 4 retains its original neutral challenge under the `pending` mode; its theme remains undecided.

The Canvas modes share the same event and package interface, while their maps, presentation, and interactions vary by week and stable fallback identity. Week 1 Stage 2 is a drag-and-drop flowchart builder: learners arrange real symbols in numbered positions, follow supplied connectors, and check the assembled algorithm against example inputs and expected outputs. Its ten scenarios include even numbers through 100 and positive odd numbers below an input, with sum and count. Construction is untimed; unsuccessful complete checks spend a life. The internal mode identifier remains `tetris` for package compatibility. See [the flowchart builder guide](docs/FLOWCHART_BUILDER.md). Dungeon layouts use a shared Kenney character sprite and generated routes; factory, terminal, and circuit scenes are parameterized from the source record. Other game modes preserve configured lives and time limits; the prologue has no game timer. Packages compile without an external game generator or LLM.

The nine-week course is loaded from `data/curriculum.json` and embedded by Vite for the world map. Historic fallback topic labels remain in the canonical source JSON; the Canvas game uses the versioned curriculum for its station questions and displayed learning objective. Review the mapping before treating legacy fallback topics as current curriculum evidence. Formal assessments remain separate from gameplay scores. See [the curriculum guide](docs/CP1_CURRICULUM_IMPLEMENTATION.md) and [the game package flow](docs/GAME_PACKAGE_FLOW.md).
# Optional static game package workflow

The native learner runtime uses the owned Canvas modules. Separately authored static HTML5 games can be validated and packaged beside their canonical game descriptions with `scripts/package_game_build.py`; no external coding-agent application is part of LogiCade.

## Programming-first industrial games

Relay Works uses the existing native Canvas/package/learner flow. See [AUTOMATION_REDESIGN.md](docs/AUTOMATION_REDESIGN.md) for the active catalog, machinery, controller syntax, preview commands, and preserved data boundaries.
