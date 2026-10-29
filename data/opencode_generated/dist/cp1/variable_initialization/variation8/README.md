# Initialization — Lab 08: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Initialization** (`cp1_25_variable_initialization`)
- Week / unit: **Week 7 — Variables**
- Lab: **8 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **initialize variables before using them**
- Challenge bank: `data/cp1/challenges/variable_initialization.json`, entry 8
- Page: `cp1/variable_initialization/variation8/index.html`

## Task

Build an initialized running total.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

Starting at 0 makes the first addition well-defined.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/variable_initialization/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
