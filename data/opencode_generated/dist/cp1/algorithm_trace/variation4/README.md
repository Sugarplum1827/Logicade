# Desk Checking — Lab 04: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Desk Checking** (`cp1_09_algorithm_trace`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **4 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **trace an algorithm with a table of values**
- Challenge bank: `data/cp1/challenges/algorithm_trace.json`, entry 4
- Page: `cp1/algorithm_trace/variation4/index.html`

## Task

Build the arithmetic expression that computes a + b × 2.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

Multiplication happens before addition, so b × 2 is computed first.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_trace/variation4/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
