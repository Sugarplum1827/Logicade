# Pseudocode — Lab 04: Repair the program

- Track: **Computer Programming 1**
- Concept: **Pseudocode** (`cp1_07_algorithm_pseudocode`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **4 of 10**
- Mechanic: **Repair** (`repair`)
- Learning target: **read and repair pseudocode**
- Challenge bank: `data/cp1/challenges/algorithm_pseudocode.json`, entry 4
- Page: `cp1/algorithm_pseudocode/variation4/index.html`

## Task

Repair the running-total pseudocode.

Tap a token, then a blank. Decoy tokens are mixed into the bank.

## Answer and explanation

Start at 0, add each number, and close the loop with ENDFOR.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_pseudocode/variation4/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
