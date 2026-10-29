# If/Else Chains — Lab 05: Order the procedure

- Track: **Computer Programming 1**
- Concept: **If/Else Chains** (`cp1_37_if_else_chains`)
- Week / unit: **Week 10 — Conditionals**
- Lab: **5 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **order ranges in an else-if chain**
- Challenge bank: `data/cp1/challenges/if_else_chains.json`, entry 5
- Page: `cp1/if_else_chains/variation5/index.html`

## Task

Put the steps of if/else chains in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Test the highest or most specific range first → Continue with else if when the test fails → Use else for everything that remains → Run only the first matching branch

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/if_else_chains/variation5/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
