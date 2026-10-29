# Reading Flowcharts — Lab 01: Trace the output

- Track: **Computer Programming 1**
- Concept: **Reading Flowcharts** (`cp1_05_flowchart_reading`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **1 of 10**
- Mechanic: **Trace** (`trace`)
- Learning target: **follow a multi-branch flowchart**
- Challenge bank: `data/cp1/challenges/flowchart_reading.json`, entry 1
- Page: `cp1/flowchart_reading/variation1/index.html`

## Task

What grade is printed when score = 85?

Type the exact output or final value. Spaces and letter case are ignored.

## Answer and explanation

85 is not at least 90, but it is at least 80, so grade becomes B.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_reading/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
