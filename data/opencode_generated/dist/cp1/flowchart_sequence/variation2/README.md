# Flowchart Sequence — Lab 02: Wire the flowchart

- Track: **Computer Programming 1**
- Concept: **Flowchart Sequence** (`cp1_02_flowchart_sequence`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **2 of 10**
- Mechanic: **Wire** (`flow`)
- Learning target: **order a straight-line flowchart**
- Challenge bank: `data/cp1/challenges/flowchart_sequence.json`, entry 2
- Page: `cp1/flowchart_sequence/variation2/index.html`

## Task

Wire the straight-line area flowchart.

Tap a source node, then a destination. Click a connection to remove it.

## Answer and explanation

A sequence has one path: start, read, calculate, print, end.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_sequence/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
