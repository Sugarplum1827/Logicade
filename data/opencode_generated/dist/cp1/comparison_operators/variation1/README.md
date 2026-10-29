# Comparison Operators — Lab 01: Sort into bins

- Track: **Computer Programming 1**
- Concept: **Comparison Operators** (`cp1_34_comparison_operators`)
- Week / unit: **Week 9 — Operators**
- Lab: **1 of 10**
- Mechanic: **Sort** (`sort`)
- Learning target: **evaluate relational and equality tests**
- Challenge bank: `data/cp1/challenges/comparison_operators.json`, entry 1
- Page: `cp1/comparison_operators/variation1/index.html`

## Task

With a = 5 and b = 8, sort each test as true or false.

Tap an item, then the bin where it belongs.

## Answer and explanation

5 is less than 8, equal to neither 8 nor greater, and different from 8.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/comparison_operators/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
