# Variable Names — Lab 07: Repair the program

- Track: **Computer Programming 1**
- Concept: **Variable Names** (`cp1_22_variable_names`)
- Week / unit: **Week 7 — Variables**
- Lab: **7 of 10**
- Mechanic: **Repair** (`repair`)
- Learning target: **choose valid and meaningful variable names**
- Challenge bank: `data/cp1/challenges/variable_names.json`, entry 7
- Page: `cp1/variable_names/variation7/index.html`

## Task

Repair the invalid variable name.

Tap a token, then a blank. Decoy tokens are mixed into the bank.

## Answer and explanation

Moving the digit after a letter makes the name legal.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/variable_names/variation7/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
