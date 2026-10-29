# Pseudocode — Lab 10: Step the machine

- Track: **Computer Programming 1**
- Concept: **Pseudocode** (`cp1_07_algorithm_pseudocode`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **10 of 10**
- Mechanic: **Simulate** (`simulate`)
- Learning target: **read and repair pseudocode**
- Challenge bank: `data/cp1/challenges/algorithm_pseudocode.json`, entry 10
- Page: `cp1/algorithm_pseudocode/variation10/index.html`

## Task

Step the running total and commit the final values.

Use Step to advance the machine. Type the final values, then commit.

## Answer and explanation

The loop accumulates 2, then 5, then 9 as it reads each number.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_pseudocode/variation10/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
