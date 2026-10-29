# Assignment — Lab 03: Split the scopes

- Track: **Computer Programming 1**
- Concept: **Assignment** (`cp1_24_variable_assignment`)
- Week / unit: **Week 7 — Variables**
- Lab: **3 of 10**
- Mechanic: **Scope** (`scope`)
- Learning target: **use = to store a value and == to compare**
- Challenge bank: `data/cp1/challenges/variable_assignment.json`, entry 3
- Page: `cp1/variable_assignment/variation3/index.html`

## Task

Place each name in main or file scope.

Tap a declaration or line, then the frame that contains it.

## Answer and explanation

high_score is global; score and its update live in main.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/variable_assignment/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
