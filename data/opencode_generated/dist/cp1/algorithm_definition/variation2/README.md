# Algorithm Definition — Lab 02: Find the bug

- Track: **Computer Programming 1**
- Concept: **Algorithm Definition** (`cp1_06_algorithm_definition`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **2 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **identify the properties of an algorithm**
- Challenge bank: `data/cp1/challenges/algorithm_definition.json`, entry 2
- Page: `cp1/algorithm_definition/variation2/index.html`

## Task

One line breaks the algorithm definition. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

An algorithm must terminate. A loop with no exit condition violates finiteness.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_definition/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
