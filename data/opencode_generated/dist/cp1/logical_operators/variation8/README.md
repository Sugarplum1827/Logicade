# Logical Operators — Lab 08: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Logical Operators** (`cp1_35_logical_operators`)
- Week / unit: **Week 9 — Operators**
- Lab: **8 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **combine conditions with and, or, and not**
- Challenge bank: `data/cp1/challenges/logical_operators.json`, entry 8
- Page: `cp1/logical_operators/variation8/index.html`

## Task

Build a test for an adult member: age at least 18 and member true.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

Both requirements must hold, so the conditions are joined with &&.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/logical_operators/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
