# Flowchart Symbols — Lab 10: Repair the program

- Track: **Computer Programming 1**
- Concept: **Flowchart Symbols** (`cp1_01_flowchart_symbols`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **10 of 10**
- Mechanic: **Repair** (`repair`)
- Learning target: **match flowchart symbols to their roles**
- Challenge bank: `data/cp1/challenges/flowchart_symbols.json`, entry 10
- Page: `cp1/flowchart_symbols/variation10/index.html`

## Task

Repair the decision pseudocode.

Tap a token, then a blank. Decoy tokens are mixed into the bank.

## Answer and explanation

The same value n is read and tested; ELSE introduces the false branch.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_symbols/variation10/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
