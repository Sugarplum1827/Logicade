# For Loops — Lab 01: Step the machine

- Track: **Computer Programming 1**
- Concept: **For Loops** (`cp1_40_for_loops`)
- Week / unit: **Week 11 — Loops**
- Lab: **1 of 10**
- Mechanic: **Simulate** (`simulate`)
- Learning target: **read all three parts of a for header**
- Challenge bank: `data/cp1/challenges/for_loops.json`, entry 1
- Page: `cp1/for_loops/variation1/index.html`

## Task

Step through the program and commit the final variable values.

Use Step to advance the machine. Type the final values, then commit.

## Answer and explanation

The final state is i = 3, total = 14.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/for_loops/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
