# Flowchart Symbols — Lab 06: Step the machine

- Track: **Computer Programming 1**
- Concept: **Flowchart Symbols** (`cp1_01_flowchart_symbols`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **6 of 10**
- Mechanic: **Simulate** (`simulate`)
- Learning target: **match flowchart symbols to their roles**
- Challenge bank: `data/cp1/challenges/flowchart_symbols.json`, entry 6
- Page: `cp1/flowchart_symbols/variation6/index.html`

## Task

Step through the decision and commit the final values.

Use Step to advance the machine. Type the final values, then commit.

## Answer and explanation

The condition is true, so result becomes positive.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_symbols/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
