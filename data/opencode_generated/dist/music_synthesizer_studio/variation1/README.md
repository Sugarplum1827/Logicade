# Music Synthesizer Studio — Variation 01: Forked Routes

- Concept: **Music Synthesizer Studio** (`49_music_synthesizer_studio`)
- Variation: **1 of 10**
- Track: **Classic concepts**
- Presentation: **Beat matcher** (`rhythm`)
- Learning target: **frequency, wave forms, and pattern matching**
- Theme / skin: `music`
- Art theme: **Space** (`themes.space.*`, curated CC0 theme pack)
- Map: `forest_path_01`
- Layout: `fork`
- Seed: `653984464`
- Activities: 6 adaptive tasks drawn from `../../data/questions/music_synthesizer_studio.json` (6 prompts in the bank)
- Page: `music_synthesizer_studio/variation1/index.html`

## What this build changes

- Route art: Two branches that rejoin at the goal.
- Features: standard route.
- Pacing metadata: 3 lives · untimed · 7 obstacles.
- Mechanics: six adaptive interactive task types rotate across the run. Each prompt is transformed into ordering, assembly, repair, classification, or typed recall.
- Asset set: `themes.space.bg_black` background, `themes.space.tile_blue` route tile, `themes.space.player_blue` player, `themes.space.enemy_blue` enemy, `themes.space.coin_blue` collectible, `themes.space.goal_blue` goal, and four themed obstacle sprites.
- Answer keys: the local question bank supplies the correct answer and explanation; the runtime adapts the answer into the active mechanic.

## Interactive runtime

This variation is a complete, playable configuration of the shared LogiCade DOM runtime. It uses the **Beat matcher** presentation theme and rotates six adaptive task mechanics through the local question bank. The route metadata, feature flags, asset set, seed, and question order above make this build distinct.

Platformer Quest — Variation 01: Forked Routes is the one exception: it is the original hand-built vertical slice and keeps its own Phaser scenes.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/music_synthesizer_studio/variation1/
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
