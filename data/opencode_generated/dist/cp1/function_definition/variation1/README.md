# Function Definitions — Lab 01: Find the bug

- Track: **Computer Programming 1**
- Concept: **Function Definitions** (`cp1_45_function_definition`)
- Week / unit: **Week 13 — Functions**
- Lab: **1 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **read a function return type, name, and body**
- Challenge bank: `data/cp1/challenges/function_definition.json`, entry 1
- Page: `cp1/function_definition/variation1/index.html`

## Task

One line breaks the program or the procedure. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

square promises an int but never returns one; result is only a local variable.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/function_definition/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
