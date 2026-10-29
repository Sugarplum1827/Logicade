# If/Else Chains — Lab 08: Sort into bins

- Track: **Computer Programming 1**
- Concept: **If/Else Chains** (`cp1_37_if_else_chains`)
- Week / unit: **Week 10 — Conditionals**
- Lab: **8 of 10**
- Mechanic: **Sort** (`sort`)
- Learning target: **order ranges in an else-if chain**
- Challenge bank: `data/cp1/challenges/if_else_chains.json`, entry 8
- Page: `cp1/if_else_chains/variation8/index.html`

## Task

Sort each score into the grade branch it reaches.

Tap an item, then the bin where it belongs.

## Answer and explanation

Only the first matching branch runs, so the ranges must not overlap out of order.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/if_else_chains/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
