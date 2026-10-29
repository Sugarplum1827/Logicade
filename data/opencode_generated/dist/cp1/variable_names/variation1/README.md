# Variable Names — Lab 01: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Variable Names** (`cp1_22_variable_names`)
- Week / unit: **Week 7 — Variables**
- Lab: **1 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **choose valid and meaningful variable names**
- Challenge bank: `data/cp1/challenges/variable_names.json`, entry 1
- Page: `cp1/variable_names/variation1/index.html`

## Task

Build a valid declaration for a player score.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

player_score starts with a letter and uses only letters and an underscore.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/variable_names/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
