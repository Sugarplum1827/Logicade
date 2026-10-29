# Assignment Operators — Lab 10: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Assignment Operators** (`cp1_33_assignment_operators`)
- Week / unit: **Week 9 — Operators**
- Lab: **10 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **read compound assignment operators**
- Challenge bank: `data/cp1/challenges/assignment_operators.json`, entry 10
- Page: `cp1/assignment_operators/variation10/index.html`

## Task

Build the compound assignment that adds 5 to score.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

+= adds the right side to the variable and stores the result.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/assignment_operators/variation10/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
