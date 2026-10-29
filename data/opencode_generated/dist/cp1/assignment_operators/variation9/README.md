# Assignment Operators — Lab 09: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Assignment Operators** (`cp1_33_assignment_operators`)
- Week / unit: **Week 9 — Operators**
- Lab: **9 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **read compound assignment operators**
- Challenge bank: `data/cp1/challenges/assignment_operators.json`, entry 9
- Page: `cp1/assignment_operators/variation9/index.html`

## Task

Put the steps of assignment operators in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Read the current value of the variable → Apply the operation on the right → Store the result back in the same variable → Continue with the updated value

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/assignment_operators/variation9/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
