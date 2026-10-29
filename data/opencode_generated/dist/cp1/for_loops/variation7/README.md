# For Loops — Lab 07: Split the scopes

- Track: **Computer Programming 1**
- Concept: **For Loops** (`cp1_40_for_loops`)
- Week / unit: **Week 11 — Loops**
- Lab: **7 of 10**
- Mechanic: **Scope** (`scope`)
- Learning target: **read all three parts of a for header**
- Challenge bank: `data/cp1/challenges/for_loops.json`, entry 7
- Page: `cp1/for_loops/variation7/index.html`

## Task

Place each name in main or the for header scope.

Tap a declaration or line, then the frame that contains it.

## Answer and explanation

i is scoped to the for statement; total remains available afterward.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/for_loops/variation7/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
