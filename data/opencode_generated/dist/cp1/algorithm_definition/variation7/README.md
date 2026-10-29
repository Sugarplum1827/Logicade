# Algorithm Definition — Lab 07: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Algorithm Definition** (`cp1_06_algorithm_definition`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **7 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **identify the properties of an algorithm**
- Challenge bank: `data/cp1/challenges/algorithm_definition.json`, entry 7
- Page: `cp1/algorithm_definition/variation7/index.html`

## Task

Build the key definition of an algorithm.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

Finite and ordered are essential: an algorithm must stop and must be unambiguous.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_definition/variation7/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
