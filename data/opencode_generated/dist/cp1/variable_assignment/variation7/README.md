# Assignment — Lab 07: Step the machine

- Track: **Computer Programming 1**
- Concept: **Assignment** (`cp1_24_variable_assignment`)
- Week / unit: **Week 7 — Variables**
- Lab: **7 of 10**
- Mechanic: **Simulate** (`simulate`)
- Learning target: **use = to store a value and == to compare**
- Challenge bank: `data/cp1/challenges/variable_assignment.json`, entry 7
- Page: `cp1/variable_assignment/variation7/index.html`

## Task

Step through the program and commit the final variable values.

Use Step to advance the machine. Type the final values, then commit.

## Answer and explanation

The final state is score = 15, previous = 10.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/variable_assignment/variation7/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
