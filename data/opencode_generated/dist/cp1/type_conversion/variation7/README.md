# Type Conversion — Lab 07: Sort into bins

- Track: **Computer Programming 1**
- Concept: **Type Conversion** (`cp1_28_type_conversion`)
- Week / unit: **Week 7 — Variables**
- Lab: **7 of 10**
- Mechanic: **Sort** (`sort`)
- Learning target: **predict integer division and use an explicit cast**
- Challenge bank: `data/cp1/challenges/type_conversion.json`, entry 7
- Page: `cp1/type_conversion/variation7/index.html`

## Task

Sort each expression by the type of result it produces.

Tap an item, then the bin where it belongs.

## Answer and explanation

Integer operands use integer division; a float operand or cast keeps the fraction.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/type_conversion/variation7/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
