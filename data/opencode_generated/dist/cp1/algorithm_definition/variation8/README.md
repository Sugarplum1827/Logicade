# Algorithm Definition — Lab 08: Wire the flowchart

- Track: **Computer Programming 1**
- Concept: **Algorithm Definition** (`cp1_06_algorithm_definition`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **8 of 10**
- Mechanic: **Wire** (`flow`)
- Learning target: **identify the properties of an algorithm**
- Challenge bank: `data/cp1/challenges/algorithm_definition.json`, entry 8
- Page: `cp1/algorithm_definition/variation8/index.html`

## Task

Wire the algorithm for adding the numbers from 1 to n.

Tap a source node, then a destination. Click a connection to remove it.

## Answer and explanation

The loop keeps adding until i exceeds n, then prints the total and ends.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_definition/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
