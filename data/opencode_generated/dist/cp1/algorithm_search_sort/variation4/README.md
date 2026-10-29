# Search and Sort Steps — Lab 04: Wire the flowchart

- Track: **Computer Programming 1**
- Concept: **Search and Sort Steps** (`cp1_10_algorithm_search_sort`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **4 of 10**
- Mechanic: **Wire** (`flow`)
- Learning target: **trace linear search and bubble sort**
- Challenge bank: `data/cp1/challenges/algorithm_search_sort.json`, entry 4
- Page: `cp1/algorithm_search_sort/variation4/index.html`

## Task

Wire the linear-search flowchart.

Tap a source node, then a destination. Click a connection to remove it.

## Answer and explanation

The search checks each index, advances when it does not match, and reports -1 at the end.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_search_sort/variation4/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
