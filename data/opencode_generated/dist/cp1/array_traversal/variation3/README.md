# Array Traversal — Lab 03: Find the bug

- Track: **Computer Programming 1**
- Concept: **Array Traversal** (`cp1_43_array_traversal`)
- Week / unit: **Week 12 — Arrays**
- Lab: **3 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **visit every array element with a loop**
- Challenge bank: `data/cp1/challenges/array_traversal.json`, entry 3
- Page: `cp1/array_traversal/variation3/index.html`

## Task

One line breaks the program or the procedure. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

i <= 4 visits index 4, which is outside the four-element array.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/array_traversal/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
