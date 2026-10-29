# Do-While Loops — Lab 03: Fill the variable vault

- Track: **Computer Programming 1**
- Concept: **Do-While Loops** (`cp1_41_do_while_loops`)
- Week / unit: **Week 11 — Loops**
- Lab: **3 of 10**
- Mechanic: **Vault** (`vars`)
- Learning target: **distinguish test-first and test-last loops**
- Challenge bank: `data/cp1/challenges/do_while_loops.json`, entry 3
- Page: `cp1/do_while_loops/variation3/index.html`

## Task

Assign the final n and the number of passes.

Tap a value, then a variable. Use the program to work out each final value.

## Answer and explanation

The body runs three times, bringing n from 0 to 3.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/do_while_loops/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
