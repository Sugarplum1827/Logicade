# For Loops — Lab 03: Assemble the line

- Track: **Computer Programming 1**
- Concept: **For Loops** (`cp1_40_for_loops`)
- Week / unit: **Week 11 — Loops**
- Lab: **3 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **read all three parts of a for header**
- Challenge bank: `data/cp1/challenges/for_loops.json`, entry 3
- Page: `cp1/for_loops/variation3/index.html`

## Task

Build a for loop that visits 1, 2, and 3.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

The header initializes i, tests i <= 3, and increments after each pass.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/for_loops/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
