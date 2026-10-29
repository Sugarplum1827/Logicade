# Array Basics — Lab 09: Step the machine

- Track: **Computer Programming 1**
- Concept: **Array Basics** (`cp1_42_array_basics`)
- Week / unit: **Week 12 — Arrays**
- Lab: **9 of 10**
- Mechanic: **Simulate** (`simulate`)
- Learning target: **declare, initialize, and index an array**
- Challenge bank: `data/cp1/challenges/array_basics.json`, entry 9
- Page: `cp1/array_basics/variation9/index.html`

## Task

Step through the program and commit the final variable values.

Use Step to advance the machine. Type the final values, then commit.

## Answer and explanation

The final state is scores[0] = 10, scores[1] = 20, scores[2] = 30, chosen = 20.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/array_basics/variation9/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
