# Flowchart Loops — Lab 02: Trace the output

- Track: **Computer Programming 1**
- Concept: **Flowchart Loops** (`cp1_04_flowchart_loops`)
- Week / unit: **Week 2 — Flowcharting**
- Lab: **2 of 10**
- Mechanic: **Trace** (`trace`)
- Learning target: **read a loop condition and its back edge**
- Challenge bank: `data/cp1/challenges/flowchart_loops.json`, entry 2
- Page: `cp1/flowchart_loops/variation2/index.html`

## Task

What is printed by this loop?

Type the exact output or final value. Spaces and letter case are ignored.

## Answer and explanation

The loop prints 1, 2, and 3, then count becomes 4 and the condition fails.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/flowchart_loops/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
