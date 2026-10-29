# Do-While Loops — Lab 01: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Do-While Loops** (`cp1_41_do_while_loops`)
- Week / unit: **Week 11 — Loops**
- Lab: **1 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **distinguish test-first and test-last loops**
- Challenge bank: `data/cp1/challenges/do_while_loops.json`, entry 1
- Page: `cp1/do_while_loops/variation1/index.html`

## Task

Put the steps of do-while loops in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Run the body once → Evaluate the condition at the bottom → Repeat while the condition is true → Exit when it becomes false

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/do_while_loops/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
