# Logic Errors — Lab 05: Fill the variable vault

- Track: **Computer Programming 1**
- Concept: **Logic Errors** (`cp1_49_logic_errors`)
- Week / unit: **Week 14 — Debugging**
- Lab: **5 of 10**
- Mechanic: **Vault** (`vars`)
- Learning target: **find code that compiles but computes the wrong result**
- Challenge bank: `data/cp1/challenges/logic_errors.json`, entry 5
- Page: `cp1/logic_errors/variation5/index.html`

## Task

Assign the inputs and the actual (unintended) average.

Tap a value, then a variable. Use the program to work out each final value.

## Answer and explanation

The code runs, but integer division stores 3 instead of 3.5.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/logic_errors/variation5/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
