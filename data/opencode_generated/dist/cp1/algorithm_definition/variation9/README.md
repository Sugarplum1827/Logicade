# Algorithm Definition — Lab 09: Program the robot

- Track: **Computer Programming 1**
- Concept: **Algorithm Definition** (`cp1_06_algorithm_definition`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **9 of 10**
- Mechanic: **Robot** (`robot`)
- Learning target: **identify the properties of an algorithm**
- Challenge bank: `data/cp1/challenges/algorithm_definition.json`, entry 9
- Page: `cp1/algorithm_definition/variation9/index.html`

## Task

Program the robot to follow a finite sequence to the goal.

Append commands to the tape. The robot runs the commands in order.

## Answer and explanation

Finite means the command tape ends; the robot stops when it reaches the goal.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_definition/variation9/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
