# Returning Values — Lab 06: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Returning Values** (`cp1_47_function_return`)
- Week / unit: **Week 13 — Functions**
- Lab: **6 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **trace which value a function returns**
- Challenge bank: `data/cp1/challenges/function_return.json`, entry 6
- Page: `cp1/function_return/variation6/index.html`

## Task

Build a return statement that sends back the larger value.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

The conditional expression chooses a when a > b, otherwise b.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/function_return/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
