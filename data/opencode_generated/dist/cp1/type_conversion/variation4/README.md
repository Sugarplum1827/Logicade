# Type Conversion — Lab 04: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Type Conversion** (`cp1_28_type_conversion`)
- Week / unit: **Week 7 — Variables**
- Lab: **4 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **predict integer division and use an explicit cast**
- Challenge bank: `data/cp1/challenges/type_conversion.json`, entry 4
- Page: `cp1/type_conversion/variation4/index.html`

## Task

Put the steps of type conversion in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Identify the types of both operands → Apply the usual conversions → Use a cast when a specific type is needed → Check whether integer division truncates

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/type_conversion/variation4/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
