# Input, Process, Output — Lab 03: Repair the program

- Track: **Computer Programming 1**
- Concept: **Input, Process, Output** (`cp1_08_algorithm_io`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **3 of 10**
- Mechanic: **Repair** (`repair`)
- Learning target: **separate input, processing, and output**
- Challenge bank: `data/cp1/challenges/algorithm_io.json`, entry 3
- Page: `cp1/algorithm_io/variation3/index.html`

## Task

Repair the input-process-output program.

Tap a token, then a blank. Decoy tokens are mixed into the bank.

## Answer and explanation

Read n, multiply by 2, and print the result.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_io/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
