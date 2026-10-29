# Function Parameters — Lab 08: Fill the variable vault

- Track: **Computer Programming 1**
- Concept: **Function Parameters** (`cp1_46_function_parameters`)
- Week / unit: **Week 13 — Functions**
- Lab: **8 of 10**
- Mechanic: **Vault** (`vars`)
- Learning target: **distinguish parameters from arguments**
- Challenge bank: `data/cp1/challenges/function_parameters.json`, entry 8
- Page: `cp1/function_parameters/variation8/index.html`

## Task

Assign the received parameter and the number of lines printed.

Tap a value, then a variable. Use the program to work out each final value.

## Answer and explanation

The argument 2 is copied into times, so the body prints twice.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/function_parameters/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
