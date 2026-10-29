# Flowchart Sequence — Lab 10: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Flowchart Sequence** (`cp1_02_flowchart_sequence`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **10 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **order a straight-line flowchart**
- Challenge bank: `data/cp1/challenges/flowchart_sequence.json`, entry 10
- Page: `cp1/flowchart_sequence/variation10/index.html`

## Task

Put the steps of flowchart sequence in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Start the flowchart → Read the width → Read the height → Multiply width by height → Display the area → End the flowchart

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_sequence/variation10/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
