# Logical Operators — Lab 02: Split the scopes

- Track: **Computer Programming 1**
- Concept: **Logical Operators** (`cp1_35_logical_operators`)
- Week / unit: **Week 9 — Operators**
- Lab: **2 of 10**
- Mechanic: **Scope** (`scope`)
- Learning target: **combine conditions with and, or, and not**
- Challenge bank: `data/cp1/challenges/logical_operators.json`, entry 2
- Page: `cp1/logical_operators/variation2/index.html`

## Task

Place each item in main or the condition.

Tap a declaration or line, then the frame that contains it.

## Answer and explanation

age and member persist in main; each comparison is a temporary condition.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/logical_operators/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
