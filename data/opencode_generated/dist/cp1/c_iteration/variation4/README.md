# C Iteration — Lab 04: Fill the variable vault

- Track: **Computer Programming 1**
- Concept: **C Iteration** (`cp1_20_c_iteration`)
- Week / unit: **Week 6 — C Structure**
- Lab: **4 of 10**
- Mechanic: **Vault** (`vars`)
- Learning target: **trace a for loop**
- Challenge bank: `data/cp1/challenges/c_iteration.json`, entry 4
- Page: `cp1/c_iteration/variation4/index.html`

## Task

Assign the last counter value and the final total.

Tap a value, then a variable. Use the program to work out each final value.

## Answer and explanation

The loop adds 1, 2, and 3; after the last pass i is 3 and total is 6.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_iteration/variation4/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
