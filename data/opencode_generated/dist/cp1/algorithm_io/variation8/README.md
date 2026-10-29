# Input, Process, Output — Lab 08: Trace the output

- Track: **Computer Programming 1**
- Concept: **Input, Process, Output** (`cp1_08_algorithm_io`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **8 of 10**
- Mechanic: **Trace** (`trace`)
- Learning target: **separate input, processing, and output**
- Challenge bank: `data/cp1/challenges/algorithm_io.json`, entry 8
- Page: `cp1/algorithm_io/variation8/index.html`

## Task

What is printed when the input is 7?

Type the exact output or final value. Spaces and letter case are ignored.

## Answer and explanation

The input 7 is doubled to 14 and printed.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_io/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
