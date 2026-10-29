# If/Else Chains — Lab 06: Assemble the line

- Track: **Computer Programming 1**
- Concept: **If/Else Chains** (`cp1_37_if_else_chains`)
- Week / unit: **Week 10 — Conditionals**
- Lab: **6 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **order ranges in an else-if chain**
- Challenge bank: `data/cp1/challenges/if_else_chains.json`, entry 6
- Page: `cp1/if_else_chains/variation6/index.html`

## Task

Build the second test in an A/B/C grade chain.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

else if adds another test after the first condition fails.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/if_else_chains/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
