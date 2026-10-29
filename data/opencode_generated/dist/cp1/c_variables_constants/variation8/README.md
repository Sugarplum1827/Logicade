# Variables and Constants — Lab 08: Fill the variable vault

- Track: **Computer Programming 1**
- Concept: **Variables and Constants** (`cp1_16_c_variables_constants`)
- Week / unit: **Week 5 — C Components**
- Lab: **8 of 10**
- Mechanic: **Vault** (`vars`)
- Learning target: **distinguish variables from constants**
- Challenge bank: `data/cp1/challenges/c_variables_constants.json`, entry 8
- Page: `cp1/c_variables_constants/variation8/index.html`

## Task

Assign the changing score and the fixed pass mark.

Tap a value, then a variable. Use the program to work out each final value.

## Answer and explanation

score changes from 10 to 15; PASS is fixed at 50.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_variables_constants/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
