# Array Search — Lab 09: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Array Search** (`cp1_44_array_search`)
- Week / unit: **Week 12 — Arrays**
- Lab: **9 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **trace a linear search through an array**
- Challenge bank: `data/cp1/challenges/array_search.json`, entry 9
- Page: `cp1/array_search/variation9/index.html`

## Task

Build the linear-search comparison.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

Each element is compared with the target using equality.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/array_search/variation9/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
