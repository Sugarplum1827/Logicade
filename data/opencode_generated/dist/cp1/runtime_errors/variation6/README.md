# Runtime Errors — Lab 06: Find the bug

- Track: **Computer Programming 1**
- Concept: **Runtime Errors** (`cp1_50_runtime_errors`)
- Week / unit: **Week 14 — Debugging**
- Lab: **6 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **guard against division by zero and invalid access**
- Challenge bank: `data/cp1/challenges/runtime_errors.json`, entry 6
- Page: `cp1/runtime_errors/variation6/index.html`

## Task

One line breaks the program or the procedure. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

Dividing by zero is undefined behavior and usually terminates the program.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/runtime_errors/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
