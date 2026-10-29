# Flowchart Symbols — Lab 04: Program the robot

- Track: **Computer Programming 1**
- Concept: **Flowchart Symbols** (`cp1_01_flowchart_symbols`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **4 of 10**
- Mechanic: **Robot** (`robot`)
- Learning target: **match flowchart symbols to their roles**
- Challenge bank: `data/cp1/challenges/flowchart_symbols.json`, entry 4
- Page: `cp1/flowchart_symbols/variation4/index.html`

## Task

Program the robot to follow a short sequence to the goal.

Append commands to the tape. The robot runs the commands in order.

## Answer and explanation

Commands run in order, just like steps in a sequence flowchart.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_symbols/variation4/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
