# While Loops — Lab 08: Split the scopes

- Track: **Computer Programming 1**
- Concept: **While Loops** (`cp1_39_while_loops`)
- Week / unit: **Week 11 — Loops**
- Lab: **8 of 10**
- Mechanic: **Scope** (`scope`)
- Learning target: **trace a while loop and its update**
- Challenge bank: `data/cp1/challenges/while_loops.json`, entry 8
- Page: `cp1/while_loops/variation8/index.html`

## Task

Place each name in main or the loop body.

Tap a declaration or line, then the frame that contains it.

## Answer and explanation

step is recreated on every pass and disappears when the loop ends.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/while_loops/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
