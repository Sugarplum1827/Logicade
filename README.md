# LogiCade

LogiCade is a data-driven programming-learning game. React manages the player journey, Phaser runs reusable gameplay modules, FastAPI indexes and serves game definitions, and Supabase stores synced progress and aggregate analytics.

## Project layout

- `client-react/` — React 19, Vite, Phaser 4 frontend.
- `server/` — FastAPI API, game catalogue, LLM generator, verifier, and pool fallback.
- `data/fallback_pool/` — 2,700 preserved game definitions (9 weeks × 10 levels × 3 difficulties × 10 variations).
- `data/fallback_templates/` — 270 playable fallback templates with their own richer runtime schema.
- `data/manifest.json` — index of game files and runtime mission metadata.
- `data/registry.json` — sprite and tilemap registry. This is separate from the game manifest.
- `supabase/migrations/` — database schema, immutable attempt rollups, access rules, and analytics views.
- `admin/` — private research and operations panel at `/admin/` with participant, catalogue, LLM, analytics, gameplay, export, audit, and settings views.

The game catalogue API supports paging and filtering with `GET /api/games`, mechanic discovery with `GET /api/games/mechanics`, and full definitions with `GET /api/games/{game_id}`. `POST /serve` remains the play-session endpoint. The server normalizes catalogue metadata into the runtime response so the Phaser boot scene can select the matching mission module.

## Local development

1. Install the Python dependencies from `requirements.txt` and the frontend dependencies in `client-react/`.
2. Start the local Supabase stack with `supabase start` and copy its local API URL, anon key, and service-role key into `.env`. The service-role key stays on the server; browser writes go through FastAPI.
3. Apply pending migrations to the existing local database with `supabase migration up --local`. This applies migrations without resetting local data.
4. Run FastAPI with `uvicorn server.main:app --reload --port 8000`.
5. For Vite development, run `npm run dev` from `client-react/`; the Vite proxy forwards API and data requests to FastAPI.
6. For the desktop window, run `python run_desktop.py`.

The local `.env` includes `LOGICADE_ADMIN_KEY`. The admin page prompts for that key and keeps it in tab session storage. The server uses the Supabase service-role key only on the backend. The participant view shows the `student_id` currently present in the database; the app still uses local username identifiers and has not completed account-to-pseudonym separation. Do not treat this as a privacy-safe research identity until Supabase Auth and a restricted participant mapping are implemented.

## Data integrity and verification

Run `python scripts/validate_game_data.py` to parse and validate every indexed game and fallback template without rewriting source JSON.

Run `pytest` for the Python test suite. In `client-react/`, run `npm run lint` and `npm run build` for frontend checks.

## Database and analytics

Attempt and event data is written to IndexedDB first. A retrying outbox syncs students, levels, attempts, telemetry, and newly recorded coin transactions through `POST /api/sync/batch`. Rows with differing optional field sets are split into compatible PostgREST batches. SQL triggers derive per-level, per-week, and per-student summaries while preserving first-attempt scores. Apply migration `008_admin_research_operations.sql` after `007_dynamic_catalog_analytics.sql` to enable participant detail, coin, difficulty, generation, session, assessment, and audit views. The admin API requires `LOGICADE_ADMIN_KEY`.

Admin views are based on synchronized server records. Local outbox state is not currently reported by devices, so the admin UI explicitly shows synchronization counts as unavailable. Coin ledger entries cover hint spends and first-level completion rewards from this change; the existing opening wallet balance, all coin mutations, admin adjustments, and server-side anti-tampering validation are not yet unified, so ledger totals are recorded transactions rather than authoritative balances. Generation attempts are logged best-effort if the migration and server database configuration are active. CSV data exports are implemented; use the browser print dialog to save a visible page as PDF. XLSX and DOCX exports and role-based admin accounts are not enabled.

When applying migrations to a linked hosted database, review the pending migration list first. `supabase db push` applies pending migrations to the linked remote database; it does not reset the database.
