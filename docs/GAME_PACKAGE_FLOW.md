# LogiCade Canvas game package flow

The active learner flow uses shared HTML5 Canvas controllers in `games/runtime/`. It does not require `game-platform/`, OhMyGame, OpenCode, or an LLM at play time. Weeks 2, 3 and 5–9 dispatch their versioned `programming` objects to the executable workbench; [EXECUTABLE_WEEKLY_MECHANICS.md](EXECUTABLE_WEEKLY_MECHANICS.md) defines the current rules and limitations. Week 4 retains its original neutral challenge under the `pending` mode.

1. A learner opens a stage. Existing progression rules resolve the week, level and assigned difficulty.
2. The learner selects the stage. `/serve` chooses an existing fallback JSON from its week/level/difficulty folder. The `file_id` matches a Canvas definition in the parallel `games/` folder, so each fallback slot selects a stable, prebuilt game identity.
3. The Canvas definition selects the configured week presentation: Week 1 Stage 1 is the LogiCade prologue video, Week 1 Stage 2 is the drag-and-drop flowchart builder, Week 2 is the circuit workshop, Week 3 is the register terminal, Week 4 is the unchanged neutral challenge with its theme undecided, Week 5 is the resource-routing factory, Week 6 is a code-guided adventure, Week 7 is the register terminal, and Weeks 8–9 are code-guided adventures. Seeded layouts vary by fallback record. Kenney art and sound are referenced from the shared `vendor/kenney/` library.
4. **CHALLENGE** compiles a small same-stem ZIP, description and manifest, then extracts a private lease. The ZIP contains only the launcher and selected game data; the Canvas engine and shared assets are served separately.
5. **Start** launches the prepared game in the existing sandboxed frame. The runner emits the normal gameplay events, and the host controls participant identity, coin rewards and persistence.
6. Finish, exit or replay releases the extracted lease and pops that build's ZIP/sidecars. The canonical fallback JSON and mirrored Canvas source remain available; the next stage selection can choose another existing record and compile it.

Native selection reserves objectives per learner, week, stage and assigned difficulty in private `.state/canvas_usage.json`. Selecting a node again, repeating, or reopening after Exit advances that learner's cycle, independently of other learners. Selection also avoids the learner's last objective across stages when alternatives exist. The ten records per pool currently provide nine or ten distinct objective texts; duplicate texts are compared as the same objective. Once the available choices are exhausted, rotation reuses the pool without immediately repeating the last objective. History survives a server restart; an unsuccessful history write returns a retryable error instead of silently losing the reservation. The orientation video retains its single objective. Repeat's package-pop deduplication is per run, so a reused source can be consumed again in a later cycle. This workflow compiles existing authored challenges; it does not claim unlimited new LLM-generated objectives.

## Mirrored files

```text
data/fallback_pool/week_1/level1/standard/
  game_week1_level1_difficulty(Standard)_1.json

games/week_1/level1/standard/
  game_week1_level1_difficulty(Standard)_1.json

games/runtime/
  index.html
  engine.js
  flowchart.js
  flowchart-model.js
  styles.css

games/assets/manifest.json
games/assets/logicade_prologue.mp4
```

The fallback JSON remains the canonical identity and receives a `canvas_runtime` pointer. The game definition beside it contains the playable tasks, mode, layout and shared asset URLs. Package ZIPs are compiled on demand beside the selected fallback JSON. Existing source identities are never deleted by the builder.

Run `python scripts/build_canvas_games.py --write` to create or refresh the canonical mirror. Run it with `--check` to report missing definitions. The source folder has 2,710 JSON files, while `data/manifest.json` lists 2,700 canonical records; the ten unlisted historical records are retained but not mirrored. The generated registry records 2,460 playable entries because Week 1 Stages 3–10 are unavailable. Both the React level selector and `/serve` enforce this rule.

## Learning-data boundary

The Canvas runner emits gameplay accuracy and question/retry events through `GamePackageFrame`. These are gameplay measures, not pretest/posttest results or formal assessment grades. The game includes answer keys in its package because it is a local self-contained practice activity; formal assessment answers remain server-side.

Flowchart checks execute structured, bounded operations against authored input/output cases. Their accuracy basis is `flowchart_execution_cases`, including unsuccessful checks; this is separate from the prologue's unscored `orientation_completion`. A successful chart can use a semantically equivalent order where its outputs remain correct. Connectors are supplied and blocks are draggable; this is a guided chart builder. See [FLOWCHART_BUILDER.md](FLOWCHART_BUILDER.md) for scenarios, data fields, controls and limitations.

Week 1 Stages 1–2 fallback descriptions are aligned to the prologue and flowchart puzzle. Other fallback records retain their CP1 identities and learning content while their `genre`, loop, control, and `canvas_runtime` fields point to the requested weekly presentation. Week 4 remains unchanged as requested by the user. Formal assessments remain separate from gameplay scores.
