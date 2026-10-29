# Block Scope — Lab 02: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Block Scope** (`cp1_31_block_scope`)
- Week / unit: **Week 8 — Scope**
- Lab: **2 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **trace names inside nested braces**
- Challenge bank: `data/cp1/challenges/block_scope.json`, entry 2
- Page: `cp1/block_scope/variation2/index.html`

## Task

Build an inner block that declares temp.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

Braces create a block; temp exists only between them.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/block_scope/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
