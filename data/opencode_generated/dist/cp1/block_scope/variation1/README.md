# Block Scope — Lab 01: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Block Scope** (`cp1_31_block_scope`)
- Week / unit: **Week 8 — Scope**
- Lab: **1 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **trace names inside nested braces**
- Challenge bank: `data/cp1/challenges/block_scope.json`, entry 1
- Page: `cp1/block_scope/variation1/index.html`

## Task

Put the steps of block scope in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Enter the outer block → Declare an outer variable → Enter an inner block and declare another → Use the inner name only inside that block → Leave the inner block and keep the outer name

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/block_scope/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
