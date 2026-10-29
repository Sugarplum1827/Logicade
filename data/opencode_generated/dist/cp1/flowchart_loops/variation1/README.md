# Flowchart Loops — Lab 01: Program the robot

- Track: **Computer Programming 1**
- Concept: **Flowchart Loops** (`cp1_04_flowchart_loops`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **1 of 10**
- Mechanic: **Robot** (`robot`)
- Learning target: **read a loop condition and its back edge**
- Challenge bank: `data/cp1/challenges/flowchart_loops.json`, entry 1
- Page: `cp1/flowchart_loops/variation1/index.html`

## Task

Program the robot to reach the goal with a repeated forward-and-turn pattern.

Append commands to the tape. The robot runs the commands in order.

## Answer and explanation

Repeated commands are a loop in action: forward, turn, forward, turn.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_loops/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
