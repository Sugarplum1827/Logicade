# For Loops — Lab 06: Find the bug

- Track: **Computer Programming 1**
- Concept: **For Loops** (`cp1_40_for_loops`)
- Week / unit: **Week 11 — Loops**
- Lab: **6 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **read all three parts of a for header**
- Challenge bank: `data/cp1/challenges/for_loops.json`, entry 6
- Page: `cp1/for_loops/variation6/index.html`

## Task

One line breaks the program or the procedure. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

i-- moves away from the exit condition, so the loop runs forever.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/for_loops/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
