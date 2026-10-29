# Logic Errors — Lab 04: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Logic Errors** (`cp1_49_logic_errors`)
- Week / unit: **Week 14 — Debugging**
- Lab: **4 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **find code that compiles but computes the wrong result**
- Challenge bank: `data/cp1/challenges/logic_errors.json`, entry 4
- Page: `cp1/logic_errors/variation4/index.html`

## Task

Build a floating-point average that keeps the decimal part.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

The cast makes the division floating-point instead of integer division.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/logic_errors/variation4/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
