# Flowchart Symbols — Lab 03: Wire the flowchart

- Track: **Computer Programming 1**
- Concept: **Flowchart Symbols** (`cp1_01_flowchart_symbols`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **3 of 10**
- Mechanic: **Wire** (`flow`)
- Learning target: **match flowchart symbols to their roles**
- Challenge bank: `data/cp1/challenges/flowchart_symbols.json`, entry 3
- Page: `cp1/flowchart_symbols/variation3/index.html`

## Task

Wire the flowchart for a positive-number test.

Tap a source node, then a destination. Click a connection to remove it.

## Answer and explanation

The decision has two outgoing paths; both branches finish at End.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_symbols/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
