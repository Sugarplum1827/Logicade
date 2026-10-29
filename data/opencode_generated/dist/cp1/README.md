# Computer Programming 1

The CP1 wing of LogiCade: **50 concepts, 500 authored interactive labs, 12 hands-on mechanics**.

Every concept owns ten labs, and every lab in a concept uses a different mechanic.
No CP1 lab is a four-button multiple-choice quiz. The content, runtime, styles, and
art are all local; there are no remote scripts, fonts, services, or network calls.

Open the wing at `cp1/index.html`, or use the combined catalog at `../index.html`
and filter by **CP1**.

## What is here

| Path | Purpose |
| --- | --- |
| `cp1/index.html` | The CP1 hub: 13 units, 50 concepts, 500 labs |
| `cp1/<slug>/index.html` | One concept page with its ten-lab set |
| `cp1/<slug>/variationN/index.html` | One authored lab |
| `cp1/<slug>/variationN/variation.json` | Runtime configuration for that lab |
| `cp1/<slug>/variationN/README.md` | Lab-specific answer, explanation, and notes |
| `../data/cp1-catalog.json` | Compiled 50-concept / 500-lab registry |
| `../data/cp1-ui.json` | Generated UI index for the CP1 wing |
| `../data/cp1/challenges/<slug>.json` | Ten authored challenges for one concept |
| `../engine/challenges.js` | The 12 DOM challenge renderers |
| `../engine/play.js` | Shared DOM runtime, scoring, hints, reveal, and results |

## Syllabus coverage

Weeks 2–8 follow the attached Computer Programming 1 syllabus. Weeks 9–14 are
an explicitly labelled finals extension for the remaining standard topics.

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

## The 12 mechanics

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

Each concept's ten labs draw from one of two mechanic sets:

- **Flow concepts** (flowcharting and algorithms, 10 concepts) use `order`,
  `assemble`, `flow`, `robot`, `trace`, `simulate`, `bug`, `match`, `sort`, and
  `repair`.
- **Code concepts** (40 concepts) use `order`, `assemble`, `vars`, `sort`, `bug`,
  `scope`, `match`, `repair`, `trace`, and `simulate`. Every set resolves to ten
  distinct mechanics.

## Authoring pipeline

The source of truth is the concept-pack modules in `../scripts/cp1/`:

- `packs-foundations.mjs` — flowcharts and algorithms
- `packs-c.mjs` — C introductions, components, and structure
- `packs-vars.mjs` — variables and scope
- `packs-control.mjs` — operators, conditionals, and loops
- `packs-data.mjs` — arrays, functions, and debugging
- `packs.mjs` — the ordered 50-concept list

Regenerate the compiled data and every CP1 page from the repository root:

```bash
node scripts/cp1/compile.mjs
node scripts/generate.mjs
```

`compile.mjs` validates every payload before writing:

- concept slugs and mechanics are unique per concept;
- answers cover every ordered piece;
- assembly banks include at least one decoy;
- flowchart edges are valid and reachable;
- robot programs are solvable;
- fill, match, sort, trace, bug, scope, and simulate payloads are complete.

`generate.mjs` calls the CP1 page generator and also refreshes the classic pages,
the combined root catalog, and `data/catalog-ui.json`.

## Verification

```bash
npm run check
```

The static suite verifies the 50/500 contract, the 12-mechanic distribution,
ten distinct mechanics per concept, all 500 challenge payloads, all 500 lab
configs, pages, READMEs, relative links, and the combined 100-concept /
1,000-variation catalog. Browser testing is still required for interaction
quality; the suite does not simulate pointer or keyboard play.

For a quick local run:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/
```

## Limits

- The 500 labs are authored challenges, not 500 bespoke game engines. They share
  one DOM runtime and twelve renderers.
- The CP1 wing is an educational supplement, not an autograder. Scores and hints
  are local to the browser session.
- Weeks 9–14 extend the supplied week-8 syllabus and are labelled as finals
  material throughout the wing.
