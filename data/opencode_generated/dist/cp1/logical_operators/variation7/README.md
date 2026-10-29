# Logical Operators — Lab 07: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Logical Operators** (`cp1_35_logical_operators`)
- Week / unit: **Week 9 — Operators**
- Lab: **7 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **combine conditions with and, or, and not**
- Challenge bank: `data/cp1/challenges/logical_operators.json`, entry 7
- Page: `cp1/logical_operators/variation7/index.html`

## Task

Put the steps of logical operators in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Evaluate the left condition → Apply short-circuit rules for && or || → Evaluate the right condition only when needed → Produce the combined truth value

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/logical_operators/variation7/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
