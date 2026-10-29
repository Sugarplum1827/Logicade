# C Sequence — Lab 05: Assemble the line

- Track: **Computer Programming 1**
- Concept: **C Sequence** (`cp1_18_c_sequence`)
- Week / unit: **Week 6 — C Structure**
- Lab: **5 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **predict the result of sequential statements**
- Challenge bank: `data/cp1/challenges/c_sequence.json`, entry 5
- Page: `cp1/c_sequence/variation5/index.html`

## Task

Build the assignment that multiplies price by quantity.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

The expression on the right is evaluated first, then stored in total.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_sequence/variation5/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
