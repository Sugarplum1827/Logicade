# Array Basics — Lab 01: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Array Basics** (`cp1_42_array_basics`)
- Week / unit: **Week 12 — Arrays**
- Lab: **1 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **declare, initialize, and index an array**
- Challenge bank: `data/cp1/challenges/array_basics.json`, entry 1
- Page: `cp1/array_basics/variation1/index.html`

## Task

Build an integer array of three scores initialized to 10, 20, and 30.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

The size goes in square brackets and the initial values go in braces.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/array_basics/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
