# C Iteration — Lab 07: Split the scopes

- Track: **Computer Programming 1**
- Concept: **C Iteration** (`cp1_20_c_iteration`)
- Week / unit: **Week 6 — C Structure**
- Lab: **7 of 10**
- Mechanic: **Scope** (`scope`)
- Learning target: **trace a for loop**
- Challenge bank: `data/cp1/challenges/c_iteration.json`, entry 7
- Page: `cp1/c_iteration/variation7/index.html`

## Task

Place each name in main or in the for-loop block.

Tap a declaration or line, then the frame that contains it.

## Answer and explanation

total lives in main; i is scoped to the for loop.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_iteration/variation7/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
