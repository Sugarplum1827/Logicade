# Comparison Operators — Lab 08: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Comparison Operators** (`cp1_34_comparison_operators`)
- Week / unit: **Week 9 — Operators**
- Lab: **8 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **evaluate relational and equality tests**
- Challenge bank: `data/cp1/challenges/comparison_operators.json`, entry 8
- Page: `cp1/comparison_operators/variation8/index.html`

## Task

Put the steps of comparison operators in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Evaluate the left operand → Evaluate the right operand → Apply the comparison → Use the 1 or 0 result in the condition

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/comparison_operators/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
