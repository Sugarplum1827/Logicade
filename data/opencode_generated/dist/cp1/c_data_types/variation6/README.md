# C Data Types — Lab 06: Step the machine

- Track: **Computer Programming 1**
- Concept: **C Data Types** (`cp1_15_c_data_types`)
- Week / unit: **Week 5 — C Components**
- Lab: **6 of 10**
- Mechanic: **Simulate** (`simulate`)
- Learning target: **choose int, float, or char for a value**
- Challenge bank: `data/cp1/challenges/c_data_types.json`, entry 6
- Page: `cp1/c_data_types/variation6/index.html`

## Task

Step through the program and commit the final variable values.

Use Step to advance the machine. Type the final values, then commit.

## Answer and explanation

The final state is age = 20, price = 9.5, grade = A, next = 21.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_data_types/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
