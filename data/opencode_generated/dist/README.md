# LogiCade — programming inside the gameplay loop

**Current status:** Little Loop Farm and Three Lanes, One Kingdom are playable farming and tower-defense prototypes with ten and six CP1 missions. The existing 50-themed-world / 500-lab collection remains a programming-puzzle reference library; the other genres and their ten route variations still need to be implemented.

## Play

Requires Node.js 18 or newer. No package installation is needed.

```powershell
npm run dev
```

Open `/field-lab/` for farming or `/kingdom-lab/` for the three-lane defense prototype.

Walk, plant, water, harvest, gather, craft, buy seeds, sell crops and deliver produce. Program a helper using variables, loops, conditions and arrays. The helper walks through the same map and consumes the same supplies as the player. Programs operate on live farm state; they are not compared with a fixed answer string. Earlier actions remain when a later command fails.

The farm saves locally on this device. Crops grow while watered, sprinklers keep irrigating after the program ends, and scarecrows protect nearby crops. Sleeping restores energy and starts a new day. Hidden tabs and the Pause button freeze simulation time. Active programs do not resume after reload.

See [FIELD-LAB.md](FIELD-LAB.md) for farm controls and missions, and [KINGDOM-LAB.md](KINGDOM-LAB.md) for the defense rules, live policy and objectives. These 16 missions adapt CP1 skills to two genres; the existing 500 authored labs have not all been converted.

## Existing curriculum

The main page still links to all 50 themed puzzle prototypes. The earlier independent activity library remains at `library.html`. [WORLD-CURRICULUM.md](WORLD-CURRICULUM.md) records the existing 50-to-50 theme/topic mapping. Existing curriculum data and progress keys are preserved.

## Source

- `engine/kingdom-state.js`: three-lane combat, tower targeting, waves, economy, ammo and checkpoints.
- `engine/kingdom-play.js`, `engine/kingdom-render.js`, `engine/kingdom.css`: defense controls and battlefield.
- `engine/field-state.js`: shared farm state, paths, resources, crafting, growth, trading and persistence.
- `engine/automation-language.js`: bounded C-style parser and interpreter; never evaluates source as JavaScript.
- `engine/field-program.js`: runs commands over time against the farm, with live sensor readings.
- `engine/field-missions.js`: ten objectives based on successful operations and language use.
- `engine/field-play.js`, `engine/field-render.js`, `engine/field.css`: controls, original canvas artwork and layout.
- `engine/learning-play.js`, `engine/challenges.js`: earlier puzzle runtime.
- `data/cp1/challenges/`: original 500 authored CP1 labs.

## Verify and build

```powershell
npm run generate
npm run check
npm run build
npm run preview
```

`npm run check:field` checks farming. `npm run check:kingdom` checks live defense decisions, enemy effects, resource limits and a five-wave victory using a second valid policy. `npm run check` includes both prototypes and the existing curriculum checks.

Both playable prototypes use original code-drawn scenery and characters. The remaining assets are local with their existing licensing files. Serve over HTTP; direct `file://` loading is unsupported.
