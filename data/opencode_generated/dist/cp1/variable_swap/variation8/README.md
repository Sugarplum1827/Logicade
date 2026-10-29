# Swapping Values — Lab 08: Fill the variable vault

- Track: **Computer Programming 1**
- Concept: **Swapping Values** (`cp1_26_variable_swap`)
- Week / unit: **Week 7 — Variables**
- Lab: **8 of 10**
- Mechanic: **Vault** (`vars`)
- Learning target: **swap two variables with a temporary**
- Challenge bank: `data/cp1/challenges/variable_swap.json`, entry 8
- Page: `cp1/variable_swap/variation8/index.html`

## Task

Assign the values after the swap completes.

Tap a value, then a variable. Use the program to work out each final value.

## Answer and explanation

The swap exchanges a and b; temp still holds the old a.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/variable_swap/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
