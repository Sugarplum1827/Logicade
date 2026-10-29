# C Comments — Lab 03: Find the bug

- Track: **Computer Programming 1**
- Concept: **C Comments** (`cp1_13_c_comments`)
- Week / unit: **Week 4 — C Introduction**
- Lab: **3 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **write and recognize C comments**
- Challenge bank: `data/cp1/challenges/c_comments.json`, entry 3
- Page: `cp1/c_comments/variation3/index.html`

## Task

One line breaks the program or the procedure. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

The block comment is never closed with */, so the compiler reports an error.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_comments/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
