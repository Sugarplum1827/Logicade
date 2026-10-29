# Block Scope — Lab 08: Repair the program

- Track: **Computer Programming 1**
- Concept: **Block Scope** (`cp1_31_block_scope`)
- Week / unit: **Week 8 — Scope**
- Lab: **8 of 10**
- Mechanic: **Repair** (`repair`)
- Learning target: **trace names inside nested braces**
- Challenge bank: `data/cp1/challenges/block_scope.json`, entry 8
- Page: `cp1/block_scope/variation8/index.html`

## Task

Repair the nested block.

Tap a token, then a blank. Decoy tokens are mixed into the bank.

## Answer and explanation

The braces define the inner block, so inner is visible only inside it.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/block_scope/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
