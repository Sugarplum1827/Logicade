# Assignment Operators — Lab 06: Repair the program

- Track: **Computer Programming 1**
- Concept: **Assignment Operators** (`cp1_33_assignment_operators`)
- Week / unit: **Week 9 — Operators**
- Lab: **6 of 10**
- Mechanic: **Repair** (`repair`)
- Learning target: **read compound assignment operators**
- Challenge bank: `data/cp1/challenges/assignment_operators.json`, entry 6
- Page: `cp1/assignment_operators/variation6/index.html`

## Task

Repair the score updates.

Tap a token, then a blank. Decoy tokens are mixed into the bank.

## Answer and explanation

+= 5 makes 15, then *= 2 makes 30.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/assignment_operators/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
