# Pseudocode — Lab 06: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Pseudocode** (`cp1_07_algorithm_pseudocode`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **6 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **read and repair pseudocode**
- Challenge bank: `data/cp1/challenges/algorithm_pseudocode.json`, entry 6
- Page: `cp1/algorithm_pseudocode/variation6/index.html`

## Task

Build the pseudocode assignment that adds a number to a running total.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

The assignment reads the old total, adds number, and stores the result back in total.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_pseudocode/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
