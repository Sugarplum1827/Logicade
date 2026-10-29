# Reading Flowcharts — Lab 07: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Reading Flowcharts** (`cp1_05_flowchart_reading`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **7 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **follow a multi-branch flowchart**
- Challenge bank: `data/cp1/challenges/flowchart_reading.json`, entry 7
- Page: `cp1/flowchart_reading/variation7/index.html`

## Task

Put the steps of reading flowcharts in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Start the flowchart → Read the score → Check whether the score is at least 90 → If not, check whether it is at least 80 → Print the matching grade → End the flowchart

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_reading/variation7/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
