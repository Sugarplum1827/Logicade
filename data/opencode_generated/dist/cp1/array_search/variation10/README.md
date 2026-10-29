# Array Search — Lab 10: Fill the variable vault

- Track: **Computer Programming 1**
- Concept: **Array Search** (`cp1_44_array_search`)
- Week / unit: **Week 12 — Arrays**
- Lab: **10 of 10**
- Mechanic: **Vault** (`vars`)
- Learning target: **trace a linear search through an array**
- Challenge bank: `data/cp1/challenges/array_search.json`, entry 10
- Page: `cp1/array_search/variation10/index.html`

## Task

Assign the matching index and the saved found value.

Tap a value, then a variable. Use the program to work out each final value.

## Answer and explanation

The loop breaks at index 2 and stores that index in found.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/array_search/variation10/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
