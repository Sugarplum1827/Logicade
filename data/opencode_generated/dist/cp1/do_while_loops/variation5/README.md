# Do-While Loops — Lab 05: Find the bug

- Track: **Computer Programming 1**
- Concept: **Do-While Loops** (`cp1_41_do_while_loops`)
- Week / unit: **Week 11 — Loops**
- Lab: **5 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **distinguish test-first and test-last loops**
- Challenge bank: `data/cp1/challenges/do_while_loops.json`, entry 5
- Page: `cp1/do_while_loops/variation5/index.html`

## Task

One line breaks the program or the procedure. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

A do-while condition must end with a semicolon after the closing parenthesis.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/do_while_loops/variation5/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
