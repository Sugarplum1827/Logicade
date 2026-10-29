# Array Search — Lab 01: Sort into bins

- Track: **Computer Programming 1**
- Concept: **Array Search** (`cp1_44_array_search`)
- Week / unit: **Week 12 — Arrays**
- Lab: **1 of 10**
- Mechanic: **Sort** (`sort`)
- Learning target: **trace a linear search through an array**
- Challenge bank: `data/cp1/challenges/array_search.json`, entry 1
- Page: `cp1/array_search/variation1/index.html`

## Task

Sort each value as a match or no match for target = 9.

Tap an item, then the bin where it belongs.

## Answer and explanation

Only the element equal to 9 stops the search with a match.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/array_search/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
