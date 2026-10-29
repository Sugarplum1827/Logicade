# Flowchart Decisions — Lab 04: Step the machine

- Track: **Computer Programming 1**
- Concept: **Flowchart Decisions** (`cp1_03_flowchart_decision`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **4 of 10**
- Mechanic: **Simulate** (`simulate`)
- Learning target: **trace and wire a two-way decision**
- Challenge bank: `data/cp1/challenges/flowchart_decision.json`, entry 4
- Page: `cp1/flowchart_decision/variation4/index.html`

## Task

Step through the pass/fail decision.

Use Step to advance the machine. Type the final values, then commit.

## Answer and explanation

The condition is true, so only the true branch runs.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_decision/variation4/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
