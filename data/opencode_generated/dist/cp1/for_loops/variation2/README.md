# For Loops — Lab 02: Order the procedure

- Track: **Computer Programming 1**
- Concept: **For Loops** (`cp1_40_for_loops`)
- Week / unit: **Week 11 — Loops**
- Lab: **2 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **read all three parts of a for header**
- Challenge bank: `data/cp1/challenges/for_loops.json`, entry 2
- Page: `cp1/for_loops/variation2/index.html`

## Task

Put the steps of for loops in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Run the initialization once → Test the condition before each pass → Run the body → Apply the update and test again

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/for_loops/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
