# Array Traversal — Lab 10: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Array Traversal** (`cp1_43_array_traversal`)
- Week / unit: **Week 12 — Arrays**
- Lab: **10 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **visit every array element with a loop**
- Challenge bank: `data/cp1/challenges/array_traversal.json`, entry 10
- Page: `cp1/array_traversal/variation10/index.html`

## Task

Build the loop header that visits every element of a size-4 array.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

Indexes 0 through 3 are visited by i < 4.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/array_traversal/variation10/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
