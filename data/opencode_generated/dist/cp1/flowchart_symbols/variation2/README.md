# Flowchart Symbols — Lab 02: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Flowchart Symbols** (`cp1_01_flowchart_symbols`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **2 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **match flowchart symbols to their roles**
- Challenge bank: `data/cp1/challenges/flowchart_symbols.json`, entry 2
- Page: `cp1/flowchart_symbols/variation2/index.html`

## Task

Build the pseudocode for a decision that checks whether a number is positive.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

A decision is written as a condition followed by THEN. The diamond in a flowchart represents this test.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_symbols/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
