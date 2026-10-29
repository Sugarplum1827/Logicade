# Constants and Literals — Lab 02: Repair the program

- Track: **Computer Programming 1**
- Concept: **Constants and Literals** (`cp1_27_constants_literals`)
- Week / unit: **Week 7 — Variables**
- Lab: **2 of 10**
- Mechanic: **Repair** (`repair`)
- Learning target: **use literals and named constants safely**
- Challenge bank: `data/cp1/challenges/constants_literals.json`, entry 2
- Page: `cp1/constants_literals/variation2/index.html`

## Task

Repair the constant declaration.

Tap a token, then a blank. Decoy tokens are mixed into the bank.

## Answer and explanation

const protects LIMIT; adding 1 gives 6.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/constants_literals/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
