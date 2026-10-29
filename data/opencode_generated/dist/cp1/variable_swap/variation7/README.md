# Swapping Values — Lab 07: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Swapping Values** (`cp1_26_variable_swap`)
- Week / unit: **Week 7 — Variables**
- Lab: **7 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **swap two variables with a temporary**
- Challenge bank: `data/cp1/challenges/variable_swap.json`, entry 7
- Page: `cp1/variable_swap/variation7/index.html`

## Task

Build the first step of a safe swap using temp.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

Saving a in temp preserves it before a is overwritten.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/variable_swap/variation7/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
