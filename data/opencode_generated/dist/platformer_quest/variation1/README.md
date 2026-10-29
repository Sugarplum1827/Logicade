# Platformer Quest — Variation 01: Forked Routes

- Concept: **Platformer Quest** (`01_platformer_quest`)
- Variation: **1 of 10**
- Track: **Classic concepts**
- Presentation: **Route runner** (`runner`)
- Learning target: **valid variable names**
- Theme / skin: `platformer`
- Art theme: original 31-asset starter pack (hand-built; no theme overlay)
- Map: `forest_path_01`
- Layout: `fork`
- Seed: `3319100064`
- Activities: 3 gate questions from the bespoke 8-question bank (`public/data/description.json`)
- Page: `platformer_quest/variation1/index.html`

## What this build changes

- Route art: Two branches that rejoin at the goal.
- Features: standard route.
- Pacing metadata: 3 lives · untimed · 4 obstacles.
- Mechanics: six adaptive interactive task types rotate across the run. Each prompt is transformed into ordering, assembly, repair, classification, or typed recall.
- Asset set: `backgrounds.forest`, `tiles.grass`, `green` player, `slime` enemy, `tiles.coin` collectible, `tiles.flag` goal.
- Answer keys: the local question bank supplies the correct answer and explanation; the runtime adapts the answer into the active mechanic.

## This build

This is the original hand-built Platformer Quest vertical slice. It keeps its own Phaser scenes (`src/game/scenes/`), reviewed level layout, gate logic, question selection, touch controls, and animation set. It is preserved from the first build; the only changes are relative asset paths and catalog navigation.

The other 499 classic variations use the shared DOM runtime. This is the only bespoke engine in the catalog.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/platformer_quest/variation1/
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
