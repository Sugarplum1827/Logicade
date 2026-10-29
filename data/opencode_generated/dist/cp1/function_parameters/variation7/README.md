# Function Parameters — Lab 07: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Function Parameters** (`cp1_46_function_parameters`)
- Week / unit: **Week 13 — Functions**
- Lab: **7 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **distinguish parameters from arguments**
- Challenge bank: `data/cp1/challenges/function_parameters.json`, entry 7
- Page: `cp1/function_parameters/variation7/index.html`

## Task

Build a function header with one integer parameter named times.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

The parameter declares the type and name that the body will use.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/function_parameters/variation7/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
