# C Sequence — Lab 08: Find the bug

- Track: **Computer Programming 1**
- Concept: **C Sequence** (`cp1_18_c_sequence`)
- Week / unit: **Week 6 — C Structure**
- Lab: **8 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **predict the result of sequential statements**
- Challenge bank: `data/cp1/challenges/c_sequence.json`, entry 8
- Page: `cp1/c_sequence/variation8/index.html`

## Task

One line breaks the program or the procedure. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

sum is used before it is declared, and a and b do not exist yet.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_sequence/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
