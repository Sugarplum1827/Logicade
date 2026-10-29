# LogiCade — 100 concepts, 1,000 interactive activities

A local, data-driven catalog of **100 programming-learning concepts** and **1,000 playable activities**, split into two tracks:

- **Computer Programming 1 (CP1):** 50 concepts, 500 authored labs, and 12 purpose-built interactive mechanics. Covers syllabus weeks 2–8 plus a labelled finals extension for weeks 9–14.
- **Classics:** the original 50 concepts and 500 adaptive six-task runs, retrofitted away from four-button multiple choice. The hand-built Platformer Quest v1 keeps its own Phaser build.

Every activity runs from local files. There are no remote scripts, fonts, services, or CDNs. CP1 and the 499 shared classic variations use one dependency-free DOM runtime; Platformer Quest v1 remains the one bespoke Phaser game.

- **Catalog:** [`index.html`](index.html) — 100 concept cards, 1,000 variation chips, track filters, classic mode filters, search, URL sync, and a random-activity button.
- **CP1 wing:** [`cp1/index.html`](cp1/index.html) — 50 concepts across 13 units, with ten labs per concept.
- **Classics:** 50 folders such as [`farm_management_script/`](farm_management_script/), each with a landing page and `variation1/` … `variation10/`.
- **Bespoke build:** [`platformer_quest/variation1/`](platformer_quest/variation1/) is the preserved original vertical slice and keeps its own 31-asset pack.
- **Classic content:** 300 shared prompts (six per concept) plus an eight-question bespoke gate bank — **308 total**.
- **Art:** 182 local CC0 assets — 31 original starter-pack assets and 151 curated theme assets. Theme art drives catalog covers and classic concept pages; the bespoke build keeps its own pack.

## Quick start

Requires **Node.js 18 or newer**. There are no npm dependencies to install.

```powershell
npm run dev        # http://127.0.0.1:5173/
```

Open the printed URL. The root catalog links to both tracks; every concept and activity is reachable from there.

To build and preview the static output:

```powershell
npm run build      # writes dist/
npm run preview    # http://127.0.0.1:4173/
```

If port 4173 is busy, pass another port: `node server.mjs --root dist --port 4174`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Serve the source tree on port 5173 with a dependency-free static server. |
| `npm run build` | Copy both tracks, the DOM runtime, assets, and vendored Phaser into `dist/`; write `dist/build-manifest.json` with SHA-256 checksums. |
| `npm run preview` | Serve `dist/` on port 4173. |
| `npm run check` | Validate syntax, both data contracts, all 1,000 activity folders/configs/pages, CP1 payloads, classic question banks, links, assets, local-only policy, and the bespoke level geometry. |
| `npm run questions` | Rebuild `data/questions/` and `data/questions.json` from `data/questions.source.json`, balancing correct-answer positions. |
| `npm run cp1:compile` | Rebuild the 50 CP1 challenge banks and `data/cp1-catalog.json` from the authored packs. |
| `npm run cp1` | Run `cp1:compile`, then regenerate every CP1 page and the combined catalog. |
| `npm run generate` | Regenerate classic pages, CP1 pages from the compiled catalog, the combined root catalog, and `data/catalog-ui.json`. |
| `npm run catalog` | Run `questions`, `cp1:compile`, and `generate` together. |
| `npm run import-kit` | Re-import the 50 × 10 classic registry from the starter kit. Optional; the generated catalog is self-contained. |
| `npm run theme-assets` | Re-import the curated subset of the supplied Kenney theme packs and regenerate the 34 custom theme images. Requires an extracted starter pack (see below). |
| `npm run theme-enrich` | Reassign the curated theme assets to the 499 shared classic variations in `data/catalog.json`. |
| `npm run theme-sync` | Run `theme-assets`, `theme-enrich`, and `generate` together. Maintainer workflow; not needed for a normal build. |

## Two tracks at a glance

| Track | Concepts | Activities | Runtime | Content model |
| --- | ---: | ---: | --- | --- |
| **CP1** | 50 | 500 labs | Shared DOM runtime, 12 mechanics | One authored challenge per lab |
| **Classics** | 50 | 500 runs | Shared DOM runtime (499) + Phaser v1 | Six adaptive tasks per run, drawn from a six-prompt bank |
| **Total** | **100** | **1,000** | 999 DOM + 1 Phaser | 500 authored labs + 500 adaptive runs |

### Computer Programming 1

CP1 is a complete syllabus wing. Each concept page lists ten labs, and each lab uses a different mechanic from the twelve-engine set.

| Week | Unit | Concepts | Labs |
| --- | --- | ---: | ---: |
| 2 | Flowcharting | 5 | 50 |
| 3 | Algorithms | 5 | 50 |
| 4 | C Introduction | 4 | 40 |
| 5 | C Components | 3 | 30 |
| 6 | C Structure | 4 | 40 |
| 7 | Variables | 7 | 70 |
| 8 | Scope | 3 | 30 |
| 9 | Operators | 4 | 40 |
| 10 | Conditionals | 3 | 30 |
| 11 | Loops | 3 | 30 |
| 12 | Arrays | 3 | 30 |
| 13 | Functions | 3 | 30 |
| 14 | Debugging | 3 | 30 |

Weeks 2–8 follow the supplied syllabus. Weeks 9–14 are an explicitly labelled **finals extension**; every CP1 hub, concept page, and lab carries that context.

| Mechanic | Label | What the learner does |
| --- | --- | --- |
| `order` | Order | Tap pieces into the correct sequence |
| `assemble` | Assemble | Build a statement from tokens, with decoys |
| `flow` | Wire | Connect flowchart nodes by their ports |
| `vars` | Vault | Assign values so program state is consistent |
| `sort` | Sort | Classify items into labelled bins |
| `bug` | Bug hunt | Pick the faulty line and explain the fix |
| `scope` | Scope | Place declarations and references in the right scope |
| `robot` | Robot | Program a short command run to reach a target |
| `match` | Match | Pair terms, symbols, or values |
| `repair` | Repair | Fill the missing token or value |
| `trace` | Trace | Step through values and predict the result |
| `simulate` | Simulate | Run a small state machine or program forward |

The 500-lab distribution is `order` 50, `assemble` 50, `flow` 10, `robot` 10, `trace` 50, `simulate` 50, `bug` 50, `match` 50, `sort` 50, `repair` 50, `vars` 40, and `scope` 40. Every concept has ten distinct mechanics; the ten flow concepts use the flowchart/robot set, and the forty code concepts use the variables/scope set.

CP1 source of truth lives in `scripts/cp1/`:

- `packs-foundations.mjs` — flowcharts and algorithms
- `packs-c.mjs` — C introductions, components, and structure
- `packs-vars.mjs` — variables and scope
- `packs-control.mjs` — operators, conditionals, and loops
- `packs-data.mjs` — arrays, functions, and debugging
- `packs.mjs` — the ordered 50-concept list
- `compile.mjs` — validates every payload and writes the 50 banks plus `data/cp1-catalog.json`
- `generate-pages.mjs` — writes the CP1 hub, concept pages, lab configs, lab pages, and READMEs

`npm run cp1` rebuilds the compiled banks and all CP1 pages.

### Classics

The classic track keeps the original 50 concepts, 500 variation configs, seven art themes, and six presentation-mode labels. The interaction layer is now adaptive: each of the six prompts in a run is transformed into an ordering, assembly, repair, classification, or typed-recall task. The original four options remain the answer key, never on-screen multiple-choice buttons.

The adapter cycles through ten variants — `order`, `assemble`, `repair`, `sort`, `match`, `trace`, `speed`, `tokens`, `blanks`, and `memory` — which resolve to five interaction primitives:

1. **Order** — words, steps, or letters in the right sequence.
2. **Assemble** — build the answer from tokens, with decoys.
3. **Repair** — fill blanks in a partly hidden answer.
4. **Sort** — classify every candidate as fitting or not fitting.
5. **Trace / recall** — type the answer, with optional timed or memory variants.

The six presentation modes remain catalog metadata and art direction, not six separate game engines:

| Mode | Catalog label | Concepts | Variations |
| --- | --- | ---: | ---: |
| `runner` | Route runner | 4 | 40 |
| `lane_defense` | Lane defense | 7 | 70 |
| `grid_route` | Grid route | 15 | 150 |
| `meter_sim` | System builder | 11 | 110 |
| `sequence` | Sequence solver | 11 | 110 |
| `rhythm` | Beat matcher | 2 | 20 |
| **Total** | | **50** | **500** |

Each classic variation has its own seed, adapter offset, title, mode label, and theme context. The ten variations of a concept deliberately reuse the concept's six-prompt bank; they are ten different adaptive runs, not ten separate authored banks.

The hand-built Platformer Quest v1 is the exception. It keeps its own Phaser scenes, level geometry, gate logic, touch controls, scoring, and animations at [`platformer_quest/variation1/`](platformer_quest/variation1/). The other nine Platformer Quest variations use the adaptive classic runtime.

## Questions and rounds

- The 50 classic banks hold **six questions each** (300 prompts). A classic run asks all six, transformed into six adaptive tasks.
- Correct answers are balanced deterministically across the four source option positions: **75 questions per position** overall.
- The adapter offset is derived from the variation index, and piece shuffles use the variation seed. A variation is reproducible, while its siblings present different task types and shuffled pieces.
- The bespoke Platformer Quest v1 has an **eight-question gate bank**. A run selects **three**: one for the chosen branch gate and one for the final gate. The unchosen branch question is reported but never shown.
- CP1 stores **ten authored challenges per concept** (500 total). A lab page loads exactly one bank entry through `challenge_index`.
- Both runtimes use three lives. Hints reduce the score; after repeated misses, the activity exposes a **Show solution** action for review.

## Catalog structure

```
index.html                     combined 100-concept / 1,000-activity catalog
catalog.css / catalog.js       track filters, mode filters, search, URL sync, random link
cp1/
  index.html                   50-concept CP1 hub
  README.md                    CP1 authoring and verification notes
  <slug>/index.html            concept landing page
  <slug>/variation1/ … variation10/
    index.html                 one authored lab
    variation.json             runtime config with challenge_index
    README.md                  answer, explanation, and build notes
engine/
  core.js                      pure layout, validation, mode, and round helpers
  challenges.js                12 CP1 renderers and the classic adaptive adapters
  play.js                      shared DOM runtime and page metadata
  bridge.js                    postMessage host bridge
  scene.js                     legacy Phaser scene helpers, not used by DOM pages
  styles.css                   shared activity-page shell
vendor/phaser.esm.min.js       vendored Phaser 3.90 for the bespoke v1
data/
  catalog.json                 classic 50 concepts × 10 variations
  cp1-catalog.json             CP1 50 concepts × 10 labs × 12 mechanics
  cp1-ui.json                  generated CP1 UI index
  catalog-ui.json              combined track index for the root catalog
  concept-meta.json            classic display names, slugs, modes, skins, accents
  theme-map.json               classic concept → art theme mapping
  questions.source.json        300 authored classic questions (answer at index 0)
  questions.json               generated shared banks
  questions/<slug>.json        one generated six-question bank per classic concept
  cp1/challenges/<slug>.json   ten authored CP1 challenges per concept
public/
  assets/                      31 original CC0 art/audio assets
  assets/themes/<theme>/       151 curated CC0 theme images in seven sets
  data/                        manifest, maps, description, starter-pack license
  licenses/kenney/             theme-pack licenses and attribution notes
  favicon.svg
<slug>/
  index.html                   classic concept landing page
  variation1/ … variation10/
    index.html                 adaptive run page
    variation.json             classic variation config
    README.md                  what this build changes and its limits
platformer_quest/variation1/
  src/                         preserved hand-built Phaser scenes
  public/                      local bespoke assets and description
  vendor/                      local Phaser build for the bespoke page
scripts/
  cp1/                         CP1 packs, compiler, page generator
  theme-data.mjs               curated theme looks, source paths, generated names
  import-theme-assets.mjs      PNG encoder, generated art, pack copy, manifest update
  enrich-themes.mjs            assigns theme assets to the 499 shared classic variations
  import, question, generate, check, build, and host-harness scripts
server.mjs                     dependency-free static server
dist/                          static build output (generated)
```

The root `src/` directory is the legacy single-game source. It is not used by the catalog runtime and is **not** copied into `dist/`; the preserved build lives in `platformer_quest/variation1/src/`.

## Seven curated art themes

The classic track assigns every shared variation a theme through `data/theme-map.json`. Theme art drives catalog covers and classic concept heroes, while each variation config keeps its theme metadata and asset assignments for reference. Platformer Quest v1 deliberately stays on the original 31-asset pack.

| Theme | Label | Concepts | Variations | Theme assets | Main source |
| --- | --- | ---: | ---: | ---: | --- |
| `space` | Space | 11 | 110 | 28 | Space Shooter Remastered |
| `underwater` | Underwater | 2 | 20 | 23 | Fish Pack 2 |
| `pirate` | Pirate | 1 | 10 | 21 | Pirate Pack |
| `farm` | Farm | 9 | 90 | 20 | Pixel Platformer Farm Expansion |
| `food` | Kitchen | 3 | 30 | 19 | Pixel Platformer Food Expansion |
| `urban` | City | 14 | 140 | 21 | RPG Urban Pack |
| `tower_defense` | Defense | 10 | 100 | 19 | Tower Defense Top Down |
| **Total** | | **50** | **500** | **151** | |

The 151 theme assets comprise 117 images copied from the supplied Kenney packs and 34 generated images. Generated art covers gaps the packs do not supply: space route tiles; underwater reef backgrounds and chest goals; pirate sea backgrounds, plank/sand tiles, doubloon, and flag; farm and kitchen backgrounds; city backgrounds, grass/sidewalk/asphalt tiles, and token; and defense backgrounds, grid tile, and ammo crate.

Theme counts are deliberately uneven because the source packs supply different amounts of usable art. Themes are a visual layer, not separate mechanics. CP1 pages use their own accent colours and mechanic glyphs rather than the seven classic art themes.

## Interactive runtime

The shared DOM runtime in `engine/play.js` handles both tracks:

- loads `variation.json` and the relevant local bank;
- builds 6 adaptive challenges for a classic run or one authored challenge for a CP1 lab;
- mounts the matching renderer from `engine/challenges.js`;
- tracks lives, score, streak, hints, attempts, and progress;
- runs check, hint, reset, reveal, next, pause/resume, and restart;
- emits accessible DOM events and host-bridge messages;
- provides keyboard controls: **Enter** to start/check/next, **H** for a hint, **R** to restart, **Esc** to pause, and **/** to focus catalog search on the root page.

No CP1 renderer is a multiple-choice quiz, and no classic prompt is shown as four option buttons.

The runtime exposes `window.__logicade`:

```js
window.__logicade = {
  variation,
  state,
  challenges,
  bridge,
  view,
  start,
  restart,
  check,
  hint,
  next,
  reveal,
  setPaused,
};
```

Platformer Quest v1 keeps its own API: `window.__logicadeGame`.

## Host protocol

Every activity can run standalone or inside an iframe. In an iframe, it speaks version 1 of the LogiCade `postMessage` contract.

The dev harness at [`scripts/host-harness.html`](scripts/host-harness.html) exercises both the DOM runtime and the bespoke Phaser build. Serve the repository with `npm run dev`, then open `http://127.0.0.1:5173/scripts/host-harness.html`.

### Host → game

Send messages to the iframe's `contentWindow`. Messages must come from `window.parent`, carry `channel: "logicade-host"` and `version: 1`.

```js
frame.contentWindow.postMessage(
  {
    channel: 'logicade-host',
    version: 1,
    type: 'initialize',
    seed: 12345,
    description: {
      // Classic host override: a questions array.
      // Each item: { id, prompt, options: [4], answer, explanation }
      questions: [],
    },
  },
  '*',
);
```

| Type | Effect |
| --- | --- |
| `initialize` | Reboots a DOM activity with host questions and/or a seed. On classic pages this replaces the local bank; CP1 labs are designed to load their authored challenge bank, and the dev harness skips initialize for them. The bespoke build validates a full description and falls back to its local description if invalid. |
| `pause` | Pauses the current run. |
| `resume` | Resumes a paused run. |
| `hint` | Reveals a hint for the current task. |

The bridge keeps one handler per inbound type. A host should send one command stream rather than registering multiple independent listeners in the page.

### Game → host

Listen on `window`, check `event.source === frame.contentWindow`, then check `channel === "logicade-game"` and `version === 1`.

```json
{
  "channel": "logicade-game",
  "version": 1,
  "type": "game_started",
  "event_id": "uuid",
  "ts": 1730000000000,
  "concept_id": "cp1_01_flowchart_symbols",
  "variation_id": "cp1_01_flowchart_symbols_v01",
  "template_version": "2.0.0",
  "mode": "cp1_lab",
  "track": "cp1",
  "total": 1,
  "first_mechanic": "order"
}
```

| Type | Extra fields |
| --- | --- |
| `game_started` | `total`, `first_mechanic` |
| `question_answered` | `question_id`, `question_index`, `total`, `mechanic`, `correct`, `revealed`, `explanation`, `lives`, `score`, and `streak` when correct |
| `hint_used` | `question_id`, `question_index`, `hint`, `hints` |
| `activity_completed` | `activity_id`, `index`, `total`, `mechanic`, `score` |
| `game_over` | `won`, `score`, `correct`, `answered`, `total`, `accuracy`, `hints`, `track` |

Both runtimes deduplicate `game_over`. Revealing a solution emits `question_answered` with `revealed: true` and does not count as a correct answer.

Standalone pages log events to the console and keep them in `window.__logicadeEvents`. The DOM runtime also exposes `window.__logicade` and `window.__logicadeBridge`.

### DOM events (shared runtime)

The shared page emits accessible, same-document events for a surrounding UI:

- `logicade:ready` — `concept`, `total`
- `logicade:question` — `index`, `total`, `prompt`, `instruction`, `mechanic`, `options` (always empty)
- `logicade:feedback` — `correct`, `explanation`, `lives`, `score`, plus `streak` or `hint` where relevant
- `logicade:results` — `won`, `score`, `correct`, `answered`, `total`, `accuracy`, `hints`, `track`

## Assets, themes, and licensing

- **Kenney New Platformer Pack 1.1** — CC0. The original 31 characters, tiles, enemies, decorations, and audio. License: `public/data/LICENSE-Kenney-New-Platformer-Pack.txt`.
- **Seven Kenney theme packs** — CC0. Space Shooter Remastered, Fish Pack 2, Pirate Pack, Pixel Platformer Farm Expansion, Pixel Platformer Food Expansion, RPG Urban Pack, and Tower Defense Top Down. The curated subset is 151 images. Licenses and attribution notes: `public/licenses/kenney/README.md`.
- **Generated theme art** — 34 images produced by `scripts/import-theme-assets.mjs` with a dependency-free PNG encoder: 448×288 backgrounds, 64×64 tiles, and 64×64 icons. These are original output generated for this catalog and distributed under the same CC0-1.0 asset release.
- **Phaser 3.90** — MIT. Vendored at `vendor/phaser.esm.min.js` and in the bespoke folder; license at `vendor/PHASER-LICENSE.txt`. The DOM runtime does not import Phaser.
- The root `public/data/asset_manifest.json` describes **182 assets** (31 original + 151 theme). The bespoke folder keeps its own **31-asset** manifest because it must continue to run without the shared theme files.
- Character frames are normalized to 96×112 with the feet at the bottom; original frames are retained under `vendor/kenney_raw/characters/`.
- Derived parallax backgrounds (`forest_alpha.png`, `hills_alpha.png`) are produced by `scripts/derive_backgrounds.ps1`.
- The build rejects remote URLs and bare imports in shipped browser code. Vendored Phaser is excluded from the source scan because its minified comments can contain incidental URLs.

### Re-importing the theme art

The supplied theme pack is not vendored in the repository. To rebuild the curated sets, extract the starter pack and pass its `logicade_starter_pack` folder:

```powershell
npm run theme-assets -- --source "C:\path\to\phaser_template_assets\assets\logicade_starter_pack"
npm run theme-enrich
npm run generate
```

`theme-assets` copies only the 121 curated source images, regenerates the 34 custom images, refreshes the seven theme licenses, and rewrites the root manifest. It never touches the bespoke 31-asset pack. `theme-enrich` then assigns the themed assets to the 499 shared classic variations.

## Verification

Run the static checks and build from the repository root:

```powershell
npm run check
npm run build
```

The checks protect:

- syntax of every shipped JavaScript module;
- the classic 50-concept / 500-variation registry and every `variation.json` against its catalog record;
- the CP1 50-concept / 500-lab registry, ten distinct mechanics per concept, all 500 challenge payloads, and every lab config;
- 1,000 activity folders, 1,000 configs, 1,000 READMEs, 100 concept pages, and the combined root catalog;
- 300 shared classic questions with four unique options, explanations, and balanced answer positions; the eight-question bespoke bank and its gate references;
- 182 root-manifest assets (31 original + 151 themed), the bespoke folder's separate 31-asset manifest, seven theme license files, all seven theme looks, plus map bounds and normalized character frames;
- 50 classic themed concept covers, 500 classic variation thumbnails, 50 CP1 covers, and every referenced image;
- all local HTML/CSS links and asset URLs, plus the absence of remote URLs;
- bespoke gate walls, door alignment, checkpoint surfaces, spawn/goal placement, and pit sizes.

Current verification results:

- `npm run check` — 40 modules parsed; 100 concepts / 1,000 activities (50 CP1 concepts + 500 CP1 labs, 50 classic concepts + 500 classic runs); 12 CP1 mechanics with ten distinct mechanics per concept; 308 classic questions; 1,102 HTML pages and 15,911 local links/assets; no remote URLs.
- `npm run build` — 3,495 files, about 19.6 MB; 1,000 activity pages; 50 classic question banks + 50 CP1 challenge banks; deterministic `dist/build-manifest.json`.
- Browser verification (Chromium, served from the source tree): all 500 CP1 challenges render, reveal, and pass `check()` across the 12 mechanics; the root catalog exposes 100 cards and 1,000 chips with working track/mode filters and search; a real CP1 order lab checks correctly through pointer clicks; a classic adaptive run completes all six tasks.
- Host-harness verification: classic DOM run emits `game_started` → six `question_answered` + six `activity_completed` → one `game_over`; a CP1 lab emits its single completion; `initialize` is skipped for CP1 and accepted for classic.
- Mobile layout check (390×844 iframe viewport): root catalog, CP1 hub, CP1 concept, CP1 lab, classic concept, and classic lab all report `scrollWidth = 375` with no horizontal overflow; CP1 and classic interactions remain usable.

## Limitations (honest notes)

- **Not 1,000 bespoke engines.** 999 activities share one DOM runtime and its renderers; only Platformer Quest v1 is a separate Phaser game. The CP1 track has 12 purpose-built mechanics; the classic track has five interaction primitives with ten adapter variants.
- **Classic variations reuse a six-prompt bank.** The ten variations of a classic concept change adapter offset, seed, title, mode label, and theme context, but they do not add ten separate banks of questions.
- **Classic mode labels are metadata.** The six legacy presentation modes remain useful for catalog filtering and art direction; they no longer describe six different Phaser gameplay loops.
- **Themes are a visual layer.** The seven art themes change catalog and page artwork for the classic track. They do not add seven new mechanics, and CP1 pages do not use them.
- **CP1 content is authored, not generated by AI at runtime.** The 500 labs are compiled from local concept packs. They are reviewed by the compiler for structural solvability, but they are not an autograder and do not model every possible learner answer.
- **Question breadth is deliberate.** Classic banks hold six prompts per concept (300 total); CP1 holds ten authored challenges per concept (500 total). Hosts can inject additional classic questions through the bridge.
- **The classic route generator is deterministic.** The same seed always produces the same prompt order, adapter selection, and shuffle.
- **Small screens are supported, not redesigned.** At 390 px the catalog, hubs, concepts, and activities reflow without horizontal overflow, but dense mechanics such as flowchart wiring still benefit from a tablet or desktop.
- **No persistence.** Scores, stars, and progress are not saved; there is no leaderboard or account system.
- **Audio depends on browser unlock.** Audio is local and optional; browsers may require a user gesture before playback.
- **Browser coverage.** Browser checks were run in Chromium. The DOM runtime uses ES modules and modern CSS; the static checks do not emulate other engines.
- **`file://` is not supported.** Pages fetch JSON and ES modules, so serve them over HTTP (`npm run dev` or any static server).
- **The bridge is intentionally small.** It supports one handler per inbound command type and does not implement retries, acknowledgements, or origin allow-listing beyond the parent-frame check.
- **The existing `Logicade` thesis repository is not modified.** This catalog is self-contained.

## Hosting notes

- `dist/` is fully static: HTML, CSS, ES modules, JSON, PNG, and OGG/WAV audio. Serve it from any static host; no server-side code is required.
- All catalog links are relative, so the build works at a site root or under a subpath. The preview server serves the build from its root.
- The development server sends `Cache-Control: no-store`; a production host can add long-lived caching for `assets/`, `vendor/`, `data/questions/`, and `data/cp1/challenges/`.
