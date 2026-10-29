# C Data Types — Lab 01: Find the bug

- Track: **Computer Programming 1**
- Concept: **C Data Types** (`cp1_15_c_data_types`)
- Week / unit: **Week 5 — C Components**
- Lab: **1 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **choose int, float, or char for a value**
- Challenge bank: `data/cp1/challenges/c_data_types.json`, entry 1
- Page: `cp1/c_data_types/variation1/index.html`

## Task

One line breaks the program or the procedure. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

A float literal uses digits without quotes; double quotes make it a string.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_data_types/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
