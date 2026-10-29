# Desk Checking — Lab 01: Sort into bins

- Track: **Computer Programming 1**
- Concept: **Desk Checking** (`cp1_09_algorithm_trace`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **1 of 10**
- Mechanic: **Sort** (`sort`)
- Learning target: **trace an algorithm with a table of values**
- Challenge bank: `data/cp1/challenges/algorithm_trace.json`, entry 1
- Page: `cp1/algorithm_trace/variation1/index.html`

## Task

Sort each item into before the trace, during the trace, or after the trace.

Tap an item, then the bin where it belongs.

## Answer and explanation

Desk checking has preparation, step-by-step recording, and a final comparison.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_trace/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
