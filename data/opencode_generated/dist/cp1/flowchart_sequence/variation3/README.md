# Flowchart Sequence — Lab 03: Program the robot

- Track: **Computer Programming 1**
- Concept: **Flowchart Sequence** (`cp1_02_flowchart_sequence`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **3 of 10**
- Mechanic: **Robot** (`robot`)
- Learning target: **order a straight-line flowchart**
- Challenge bank: `data/cp1/challenges/flowchart_sequence.json`, entry 3
- Page: `cp1/flowchart_sequence/variation3/index.html`

## Task

Program the robot to walk the straight-line route.

Append commands to the tape. The robot runs the commands in order.

## Answer and explanation

The robot follows one ordered route, just like a sequence flowchart.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_sequence/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
