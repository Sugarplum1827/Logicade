# Flowchart Loops — Lab 03: Step the machine

- Track: **Computer Programming 1**
- Concept: **Flowchart Loops** (`cp1_04_flowchart_loops`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **3 of 10**
- Mechanic: **Simulate** (`simulate`)
- Learning target: **read a loop condition and its back edge**
- Challenge bank: `data/cp1/challenges/flowchart_loops.json`, entry 3
- Page: `cp1/flowchart_loops/variation3/index.html`

## Task

Step through the loop and commit the final count.

Use Step to advance the machine. Type the final values, then commit.

## Answer and explanation

After printing 3, count becomes 4 and the loop condition is false.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_loops/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
