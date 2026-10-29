# Array Traversal — Lab 01: Fill the variable vault

- Track: **Computer Programming 1**
- Concept: **Array Traversal** (`cp1_43_array_traversal`)
- Week / unit: **Week 12 — Arrays**
- Lab: **1 of 10**
- Mechanic: **Vault** (`vars`)
- Learning target: **visit every array element with a loop**
- Challenge bank: `data/cp1/challenges/array_traversal.json`, entry 1
- Page: `cp1/array_traversal/variation1/index.html`

## Task

Assign the last index visited and the accumulated total.

Tap a value, then a variable. Use the program to work out each final value.

## Answer and explanation

The final pass uses index 3, and the four values add to 20.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/array_traversal/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
