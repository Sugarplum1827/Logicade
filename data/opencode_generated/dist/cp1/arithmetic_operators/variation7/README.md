# Arithmetic Operators — Lab 07: Repair the program

- Track: **Computer Programming 1**
- Concept: **Arithmetic Operators** (`cp1_32_arithmetic_operators`)
- Week / unit: **Week 9 — Operators**
- Lab: **7 of 10**
- Mechanic: **Repair** (`repair`)
- Learning target: **apply precedence and the modulus operator**
- Challenge bank: `data/cp1/challenges/arithmetic_operators.json`, entry 7
- Page: `cp1/arithmetic_operators/variation7/index.html`

## Task

Repair the precedence expression.

Tap a token, then a blank. Decoy tokens are mixed into the bank.

## Answer and explanation

2 + 3 * 4 is 2 + 12 = 14 because multiplication runs first.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/arithmetic_operators/variation7/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
