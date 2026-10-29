# Search and Sort Steps — Lab 06: Trace the output

- Track: **Computer Programming 1**
- Concept: **Search and Sort Steps** (`cp1_10_algorithm_search_sort`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **6 of 10**
- Mechanic: **Trace** (`trace`)
- Learning target: **trace linear search and bubble sort**
- Challenge bank: `data/cp1/challenges/algorithm_search_sort.json`, entry 6
- Page: `cp1/algorithm_search_sort/variation6/index.html`

## Task

At which index does linear search find 9 in [3, 7, 9]?

Type the exact output or final value. Spaces and letter case are ignored.

## Answer and explanation

Index 0 holds 3, index 1 holds 7, and index 2 holds 9.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_search_sort/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
