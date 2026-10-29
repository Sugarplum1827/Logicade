# Compiling C — Lab 10: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Compiling C** (`cp1_12_c_compilation`)
- Week / unit: **Week 4 — C Introduction**
- Lab: **10 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **follow source code through compilation to an executable**
- Challenge bank: `data/cp1/challenges/c_compilation.json`, entry 10
- Page: `cp1/c_compilation/variation10/index.html`

## Task

Put the steps of compiling c in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Write the C source file → Run the compiler on the source → Fix any reported syntax errors → Link the program into an executable → Run the executable

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_compilation/variation10/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
