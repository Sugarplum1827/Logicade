# If/Else Chains — Lab 09: Find the bug

- Track: **Computer Programming 1**
- Concept: **If/Else Chains** (`cp1_37_if_else_chains`)
- Week / unit: **Week 10 — Conditionals**
- Lab: **9 of 10**
- Mechanic: **Bug hunt** (`bug`)
- Learning target: **order ranges in an else-if chain**
- Challenge bank: `data/cp1/challenges/if_else_chains.json`, entry 9
- Page: `cp1/if_else_chains/variation9/index.html`

## Task

One line breaks the program or the procedure. Tap it.

Read every line. A bug prevents the program from compiling or from doing what is intended.

## Answer and explanation

Testing 80 before 90 sends every score of 80 or more to A, so B is unreachable.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/if_else_chains/variation9/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
