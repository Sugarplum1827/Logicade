# Desk Checking — Lab 06: Program the robot

- Track: **Computer Programming 1**
- Concept: **Desk Checking** (`cp1_09_algorithm_trace`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **6 of 10**
- Mechanic: **Robot** (`robot`)
- Learning target: **trace an algorithm with a table of values**
- Challenge bank: `data/cp1/challenges/algorithm_trace.json`, entry 6
- Page: `cp1/algorithm_trace/variation6/index.html`

## Task

Program the robot and trace each move before running it.

Append commands to the tape. The robot runs the commands in order.

## Answer and explanation

Tracing the moves in order is the same skill as desk checking an algorithm.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_trace/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
