# Assignment — Lab 10: Fill the variable vault

- Track: **Computer Programming 1**
- Concept: **Assignment** (`cp1_24_variable_assignment`)
- Week / unit: **Week 7 — Variables**
- Lab: **10 of 10**
- Mechanic: **Vault** (`vars`)
- Learning target: **use = to store a value and == to compare**
- Challenge bank: `data/cp1/challenges/variable_assignment.json`, entry 10
- Page: `cp1/variable_assignment/variation10/index.html`

## Task

Assign the new score and the value it replaced.

Tap a value, then a variable. Use the program to work out each final value.

## Answer and explanation

The old value was 10; assignment replaces it with 15.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/variable_assignment/variation10/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
