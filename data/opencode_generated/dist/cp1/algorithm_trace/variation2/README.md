# Desk Checking — Lab 02: Repair the program

- Track: **Computer Programming 1**
- Concept: **Desk Checking** (`cp1_09_algorithm_trace`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **2 of 10**
- Mechanic: **Repair** (`repair`)
- Learning target: **trace an algorithm with a table of values**
- Challenge bank: `data/cp1/challenges/algorithm_trace.json`, entry 2
- Page: `cp1/algorithm_trace/variation2/index.html`

## Task

Repair the desk-check trace.

Tap a token, then a blank. Decoy tokens are mixed into the bank.

## Answer and explanation

4 × 2 = 8; 3 + 8 = 11, so both the trace row and expected output are 11.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_trace/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
