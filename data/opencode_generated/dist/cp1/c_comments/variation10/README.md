# C Comments — Lab 10: Assemble the line

- Track: **Computer Programming 1**
- Concept: **C Comments** (`cp1_13_c_comments`)
- Week / unit: **Week 4 — C Introduction**
- Lab: **10 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **write and recognize C comments**
- Challenge bank: `data/cp1/challenges/c_comments.json`, entry 10
- Page: `cp1/c_comments/variation10/index.html`

## Task

Build a single-line comment that explains a total calculation.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

// comments run to the end of the line and are ignored by the compiler.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_comments/variation10/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
