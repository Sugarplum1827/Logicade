# First C Program — Lab 09: Assemble the line

- Track: **Computer Programming 1**
- Concept: **First C Program** (`cp1_14_c_first_program`)
- Week / unit: **Week 4 — C Introduction**
- Lab: **9 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **write and trace a first printf program**
- Challenge bank: `data/cp1/challenges/c_first_program.json`, entry 9
- Page: `cp1/c_first_program/variation9/index.html`

## Task

Build the printf statement that prints Hello followed by a newline.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

printf takes a format string, and \n adds the newline.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_first_program/variation9/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
