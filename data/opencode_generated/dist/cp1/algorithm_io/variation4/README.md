# Input, Process, Output — Lab 04: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Input, Process, Output** (`cp1_08_algorithm_io`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **4 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **separate input, processing, and output**
- Challenge bank: `data/cp1/challenges/algorithm_io.json`, entry 4
- Page: `cp1/algorithm_io/variation4/index.html`

## Task

Put the steps of input, process, output in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Prompt the user for a number → Read the number into a variable → Multiply the number by two → Display the doubled value → End the program

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_io/variation4/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
