# Array Traversal — Lab 09: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Array Traversal** (`cp1_43_array_traversal`)
- Week / unit: **Week 12 — Arrays**
- Lab: **9 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **visit every array element with a loop**
- Challenge bank: `data/cp1/challenges/array_traversal.json`, entry 9
- Page: `cp1/array_traversal/variation9/index.html`

## Task

Put the steps of array traversal in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Initialize an accumulator if needed → Start the index at 0 → Visit each element while the index is below the size → Increment the index after each visit

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/array_traversal/variation9/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
