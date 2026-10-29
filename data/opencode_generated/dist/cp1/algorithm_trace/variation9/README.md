# Desk Checking — Lab 09: Find the bug

- Track: **Computer Programming 1**
- Concept: **Desk Checking** (`cp1_09_algorithm_trace`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **9 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **trace an algorithm with a table of values**
- Challenge bank: `data/cp1/challenges/algorithm_trace.json`, entry 9
- Page: `cp1/algorithm_trace/variation9/index.html`

## Task

One line in the trace table is wrong. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

b * 2 = 8, then a + 8 = 11. The trace row should record 11, not 14.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_trace/variation9/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
