# Variables and Constants — Lab 07: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Variables and Constants** (`cp1_16_c_variables_constants`)
- Week / unit: **Week 5 — C Components**
- Lab: **7 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **distinguish variables from constants**
- Challenge bank: `data/cp1/challenges/c_variables_constants.json`, entry 7
- Page: `cp1/c_variables_constants/variation7/index.html`

## Task

Build a constant named PASS with the value 50.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

const marks the value as read-only; any later assignment is a compile error.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_variables_constants/variation7/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
