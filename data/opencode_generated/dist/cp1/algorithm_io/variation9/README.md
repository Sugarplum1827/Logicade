# Input, Process, Output — Lab 09: Step the machine

- Track: **Computer Programming 1**
- Concept: **Input, Process, Output** (`cp1_08_algorithm_io`)
- Week / unit: **Week 3 — Algorithms**
- Lab: **9 of 10**
- Mechanic: **Simulate** (`simulate`)
- Learning target: **separate input, processing, and output**
- Challenge bank: `data/cp1/challenges/algorithm_io.json`, entry 9
- Page: `cp1/algorithm_io/variation9/index.html`

## Task

Step through the input-process-output program.

Use Step to advance the machine. Type the final values, then commit.

## Answer and explanation

After reading 7, the program stores 14 in result.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/algorithm_io/variation9/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
