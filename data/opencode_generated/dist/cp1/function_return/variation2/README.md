# Returning Values — Lab 02: Repair the program

- Track: **Computer Programming 1**
- Concept: **Returning Values** (`cp1_47_function_return`)
- Week / unit: **Week 13 — Functions**
- Lab: **2 of 10**
- Mechanic: **Repair** (`repair`)
- Learning target: **trace which value a function returns**
- Challenge bank: `data/cp1/challenges/function_return.json`, entry 2
- Page: `cp1/function_return/variation2/index.html`

## Task

Repair the max function.

Tap a token, then a blank. Decoy tokens are mixed into the bank.

## Answer and explanation

When a is larger return a; otherwise return b.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/function_return/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
