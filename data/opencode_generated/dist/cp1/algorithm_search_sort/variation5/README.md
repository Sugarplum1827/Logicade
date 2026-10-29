# Search and Sort Steps — Lab 05: Program the robot

- Track: **Computer Programming 1**
- Concept: **Search and Sort Steps** (`cp1_10_algorithm_search_sort`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **5 of 10**
- Mechanic: **Robot** (`robot`)
- Learning target: **trace linear search and bubble sort**
- Challenge bank: `data/cp1/challenges/algorithm_search_sort.json`, entry 5
- Page: `cp1/algorithm_search_sort/variation5/index.html`

## Task

Program the robot to search the route for the goal.

Append commands to the tape. The robot runs the commands in order.

## Answer and explanation

The robot checks positions one move at a time, like a linear search.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_search_sort/variation5/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
