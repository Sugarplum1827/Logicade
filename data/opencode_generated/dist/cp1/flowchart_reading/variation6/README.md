# Reading Flowcharts — Lab 06: Repair the program

- Track: **Computer Programming 1**
- Concept: **Reading Flowcharts** (`cp1_05_flowchart_reading`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **6 of 10**
- Mechanic: **Repair** (`repair`)
- Learning target: **follow a multi-branch flowchart**
- Challenge bank: `data/cp1/challenges/flowchart_reading.json`, entry 6
- Page: `cp1/flowchart_reading/variation6/index.html`

## Task

Repair the nested grade decision.

Tap a token, then a blank. Decoy tokens are mixed into the bank.

## Answer and explanation

Each ELSE IF adds another test; the final ELSE catches everything below 80.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_reading/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
