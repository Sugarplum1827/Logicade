# Search and Sort Steps — Lab 02: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Search and Sort Steps** (`cp1_10_algorithm_search_sort`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **2 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **trace linear search and bubble sort**
- Challenge bank: `data/cp1/challenges/algorithm_search_sort.json`, entry 2
- Page: `cp1/algorithm_search_sort/variation2/index.html`

## Task

Put the steps of search and sort steps in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Start at the first item in the list → Compare the item with the target → Stop when the target matches → Otherwise move to the next item → If the list ends, report not found

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_search_sort/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
