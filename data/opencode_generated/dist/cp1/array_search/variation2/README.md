# Array Search — Lab 02: Find the bug

- Track: **Computer Programming 1**
- Concept: **Array Search** (`cp1_44_array_search`)
- Week / unit: **Week 12 — Arrays**
- Lab: **2 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **trace a linear search through an array**
- Challenge bank: `data/cp1/challenges/array_search.json`, entry 2
- Page: `cp1/array_search/variation2/index.html`

## Task

One line breaks the program or the procedure. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

Increasing i by 2 skips every other element, so odd indexes like 2 may be missed.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/array_search/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
