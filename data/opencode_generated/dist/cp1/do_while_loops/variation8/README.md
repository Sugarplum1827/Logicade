# Do-While Loops — Lab 08: Repair the program

- Track: **Computer Programming 1**
- Concept: **Do-While Loops** (`cp1_41_do_while_loops`)
- Week / unit: **Week 11 — Loops**
- Lab: **8 of 10**
- Mechanic: **Repair** (`repair`)
- Learning target: **distinguish test-first and test-last loops**
- Challenge bank: `data/cp1/challenges/do_while_loops.json`, entry 8
- Page: `cp1/do_while_loops/variation8/index.html`

## Task

Repair the do-while loop.

Tap a token, then a blank. Decoy tokens are mixed into the bank.

## Answer and explanation

do starts the body and the while condition needs a trailing semicolon.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/do_while_loops/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
