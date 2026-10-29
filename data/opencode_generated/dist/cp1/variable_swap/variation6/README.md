# Swapping Values — Lab 06: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Swapping Values** (`cp1_26_variable_swap`)
- Week / unit: **Week 7 — Variables**
- Lab: **6 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **swap two variables with a temporary**
- Challenge bank: `data/cp1/challenges/variable_swap.json`, entry 6
- Page: `cp1/variable_swap/variation6/index.html`

## Task

Put the steps of swapping values in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Copy the first value into a temporary → Copy the second value into the first variable → Copy the temporary into the second variable → Print both values to confirm the swap

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/variable_swap/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
