# C Input and Output — Lab 09: Find the bug

- Track: **Computer Programming 1**
- Concept: **C Input and Output** (`cp1_17_c_input_output`)
- Week / unit: **Week 5 — C Components**
- Lab: **9 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **read input with scanf and print with printf**
- Challenge bank: `data/cp1/challenges/c_input_output.json`, entry 9
- Page: `cp1/c_input_output/variation9/index.html`

## Task

One line breaks the program or the procedure. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

scanf needs the address of age, so it must be &age.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_input_output/variation9/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
