# Assignment — Lab 08: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Assignment** (`cp1_24_variable_assignment`)
- Week / unit: **Week 7 — Variables**
- Lab: **8 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **use = to store a value and == to compare**
- Challenge bank: `data/cp1/challenges/variable_assignment.json`, entry 8
- Page: `cp1/variable_assignment/variation8/index.html`

## Task

Put the steps of assignment in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Evaluate the expression on the right → Store the result in the variable on the left → Replace the old value → Use == only when comparing

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/variable_assignment/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
