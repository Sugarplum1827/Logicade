# Arithmetic Operators — Lab 05: Split the scopes

- Track: **Computer Programming 1**
- Concept: **Arithmetic Operators** (`cp1_32_arithmetic_operators`)
- Week / unit: **Week 9 — Operators**
- Lab: **5 of 10**
- Mechanic: **Scope** (`scope`)
- Learning target: **apply precedence and the modulus operator**
- Challenge bank: `data/cp1/challenges/arithmetic_operators.json`, entry 5
- Page: `cp1/arithmetic_operators/variation5/index.html`

## Task

Place each item in main or the expression.

Tap a declaration or line, then the frame that contains it.

## Answer and explanation

b * 3 is a temporary expression value; the named variables belong to main.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/arithmetic_operators/variation5/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
