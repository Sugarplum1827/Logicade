# Reading Flowcharts — Lab 03: Find the bug

- Track: **Computer Programming 1**
- Concept: **Reading Flowcharts** (`cp1_05_flowchart_reading`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **3 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **follow a multi-branch flowchart**
- Challenge bank: `data/cp1/challenges/flowchart_reading.json`, entry 3
- Page: `cp1/flowchart_reading/variation3/index.html`

## Task

One condition makes grade A impossible. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

Checking 80 before 90 sends every score of 80 or more to A. Test the highest range first.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_reading/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
