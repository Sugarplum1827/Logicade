# Arithmetic Operators — Lab 10: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Arithmetic Operators** (`cp1_32_arithmetic_operators`)
- Week / unit: **Week 9 — Operators**
- Lab: **10 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **apply precedence and the modulus operator**
- Challenge bank: `data/cp1/challenges/arithmetic_operators.json`, entry 10
- Page: `cp1/arithmetic_operators/variation10/index.html`

## Task

Put the steps of arithmetic operators in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Evaluate parentheses first → Evaluate multiplication, division, and modulus → Evaluate addition and subtraction → Store the final result

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/arithmetic_operators/variation10/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
