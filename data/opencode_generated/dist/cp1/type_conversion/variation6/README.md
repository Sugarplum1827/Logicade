# Type Conversion — Lab 06: Fill the variable vault

- Track: **Computer Programming 1**
- Concept: **Type Conversion** (`cp1_28_type_conversion`)
- Week / unit: **Week 7 — Variables**
- Lab: **6 of 10**
- Mechanic: **Vault** (`vars`)
- Learning target: **predict integer division and use an explicit cast**
- Challenge bank: `data/cp1/challenges/type_conversion.json`, entry 6
- Page: `cp1/type_conversion/variation6/index.html`

## Task

Assign the truncated quotient and the decimal result.

Tap a value, then a variable. Use the program to work out each final value.

## Answer and explanation

int division gives 3; casting total to float gives 3.5.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/type_conversion/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
