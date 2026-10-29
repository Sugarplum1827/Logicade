# Variables and Constants — Lab 03: Repair the program

- Track: **Computer Programming 1**
- Concept: **Variables and Constants** (`cp1_16_c_variables_constants`)
- Week / unit: **Week 5 — C Components**
- Lab: **3 of 10**
- Mechanic: **Repair** (`repair`)
- Learning target: **distinguish variables from constants**
- Challenge bank: `data/cp1/challenges/c_variables_constants.json`, entry 3
- Page: `cp1/c_variables_constants/variation3/index.html`

## Task

Repair the score program and its constant.

Tap a token, then a blank. Decoy tokens are mixed into the bank.

## Answer and explanation

Add 5 to score, and declare PASS with const.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_variables_constants/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
