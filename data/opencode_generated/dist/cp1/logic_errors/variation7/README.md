# Logic Errors — Lab 07: Find the bug

- Track: **Computer Programming 1**
- Concept: **Logic Errors** (`cp1_49_logic_errors`)
- Week / unit: **Week 14 — Debugging**
- Lab: **7 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **find code that compiles but computes the wrong result**
- Challenge bank: `data/cp1/challenges/logic_errors.json`, entry 7
- Page: `cp1/logic_errors/variation7/index.html`

## Task

One line breaks the program or the procedure. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

Both operands are int, so the division truncates before the value reaches the float.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/logic_errors/variation7/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
