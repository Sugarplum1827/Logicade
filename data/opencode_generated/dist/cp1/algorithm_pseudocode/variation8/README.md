# Pseudocode — Lab 08: Program the robot

- Track: **Computer Programming 1**
- Concept: **Pseudocode** (`cp1_07_algorithm_pseudocode`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **8 of 10**
- Mechanic: **Robot** (`robot`)
- Learning target: **read and repair pseudocode**
- Challenge bank: `data/cp1/challenges/algorithm_pseudocode.json`, entry 8
- Page: `cp1/algorithm_pseudocode/variation8/index.html`

## Task

Program the robot to follow a repeated forward-and-turn algorithm.

Append commands to the tape. The robot runs the commands in order.

## Answer and explanation

The command tape is pseudocode made concrete: each command runs in order.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_pseudocode/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
