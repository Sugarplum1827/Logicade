# Flowchart Decisions — Lab 09: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Flowchart Decisions** (`cp1_03_flowchart_decision`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **9 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **trace and wire a two-way decision**
- Challenge bank: `data/cp1/challenges/flowchart_decision.json`, entry 9
- Page: `cp1/flowchart_decision/variation9/index.html`

## Task

Put the steps of flowchart decisions in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Start the flowchart → Read the score → Ask whether the score is at least 75 → Follow the true branch when it is → Follow the false branch when it is not → End the flowchart

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_decision/variation9/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
