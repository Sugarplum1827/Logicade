# Deep Sea Abyssal Dive — Variation 04: Escort Route

- Concept: **Deep Sea Abyssal Dive** (`31_deep_sea_abyssal_dive`)
- Variation: **4 of 10**
- Track: **Classic concepts**
- Presentation: **Sequence solver** (`sequence`)
- Learning target: **error handling and recovery**
- Theme / skin: `deep_sea`
- Art theme: **Underwater** (`themes.underwater.*`, curated CC0 theme pack)
- Map: `forest_path_01`
- Layout: `linear`
- Seed: `2360980920`
- Activities: 6 adaptive tasks drawn from `../../data/questions/deep_sea_abyssal_dive.json` (6 prompts in the bank)
- Page: `deep_sea_abyssal_dive/variation4/index.html`

## What this build changes

- Route art: A straight route with one decision at each platform.
- Features: escort follower.
- Pacing metadata: 4 lives · untimed · 7 obstacles.
- Mechanics: six adaptive interactive task types rotate across the run. Each prompt is transformed into ordering, assembly, repair, classification, or typed recall.
- Asset set: `themes.underwater.bg_reef_1` background, `themes.underwater.tile_dirt` route tile, `themes.underwater.player_pink` player, `themes.underwater.enemy_brown` enemy, `themes.underwater.coin_bubble_a` collectible, `themes.underwater.goal_chest_pearl` goal, and four themed obstacle sprites.
- Answer keys: the local question bank supplies the correct answer and explanation; the runtime adapts the answer into the active mechanic.

## Interactive runtime

This variation is a complete, playable configuration of the shared LogiCade DOM runtime. It uses the **Sequence solver** presentation theme and rotates six adaptive task mechanics through the local question bank. The route metadata, feature flags, asset set, seed, and question order above make this build distinct.

Platformer Quest — Variation 01: Forked Routes is the one exception: it is the original hand-built vertical slice and keeps its own Phaser scenes.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/deep_sea_abyssal_dive/variation4/
```

Or build and preview the static output:

```bash
npm run build
npm run preview
```

## Verification

`npm run check` validates this folder, its `variation.json`, the question bank, the asset IDs, and the generated page links. `npm run build` copies the folder into `dist/` and writes a checksum manifest.

## Limitations

- The 500 classic variations share six presentation modes and one adaptive DOM runtime. They are not 500 bespoke game engines.
- Classic prompts are adapted from multiple-choice source banks into interactive mechanics; the original options remain the answer key, not on-screen buttons.
- Shared variations draw from seven curated CC0 art themes (151 theme assets) plus 31 original starter-pack assets. The hand-built v1 keeps the original 31-asset pack only.
- Theme art is composited around one shared renderer; it is not ten bespoke art pipelines. Some theme sprites are still frames rather than full animation sets.
- The route generator is deterministic from the seed; the same seed always produces the same path and obstacle layout.
