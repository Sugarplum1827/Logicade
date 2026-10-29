# Comparison Operators — Lab 03: Split the scopes

- Track: **Computer Programming 1**
- Concept: **Comparison Operators** (`cp1_34_comparison_operators`)
- Week / unit: **Week 9 — Operators**
- Lab: **3 of 10**
- Mechanic: **Scope** (`scope`)
- Learning target: **evaluate relational and equality tests**
- Challenge bank: `data/cp1/challenges/comparison_operators.json`, entry 3
- Page: `cp1/comparison_operators/variation3/index.html`

## Task

Place each item in main or the condition.

Tap a declaration or line, then the frame that contains it.

## Answer and explanation

The comparison is evaluated in the if condition; the variables live in main.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/comparison_operators/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
