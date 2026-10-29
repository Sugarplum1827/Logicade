# C Functions — Lab 05: Find the bug

- Track: **Computer Programming 1**
- Concept: **C Functions** (`cp1_21_c_functions_intro`)
- Week / unit: **Week 6 — C Structure**
- Lab: **5 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **read a function definition and call**
- Challenge bank: `data/cp1/challenges/c_functions_intro.json`, entry 5
- Page: `cp1/c_functions_intro/variation5/index.html`

## Task

One line breaks the program or the procedure. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

add promises to return an int but never uses return, so the value is undefined.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_functions_intro/variation5/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
