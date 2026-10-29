# Reading Flowcharts — Lab 08: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Reading Flowcharts** (`cp1_05_flowchart_reading`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **8 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **follow a multi-branch flowchart**
- Challenge bank: `data/cp1/challenges/flowchart_reading.json`, entry 8
- Page: `cp1/flowchart_reading/variation8/index.html`

## Task

Build the second condition in an A/B/C grade flowchart.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

After the first condition fails, ELSE IF tests the next range.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_reading/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
