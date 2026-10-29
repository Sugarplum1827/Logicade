# Arithmetic Operators — Lab 02: Fill the variable vault

- Track: **Computer Programming 1**
- Concept: **Arithmetic Operators** (`cp1_32_arithmetic_operators`)
- Week / unit: **Week 9 — Operators**
- Lab: **2 of 10**
- Mechanic: **Vault** (`vars`)
- Learning target: **apply precedence and the modulus operator**
- Challenge bank: `data/cp1/challenges/arithmetic_operators.json`, entry 2
- Page: `cp1/arithmetic_operators/variation2/index.html`

## Task

Assign the operands and the evaluated result.

Tap a value, then a variable. Use the program to work out each final value.

## Answer and explanation

Multiplication happens first, so result is 7 + 6 = 13.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/arithmetic_operators/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
