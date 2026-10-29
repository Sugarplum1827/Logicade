# C Comments — Lab 08: Step the machine

- Track: **Computer Programming 1**
- Concept: **C Comments** (`cp1_13_c_comments`)
- Week / unit: **Week 4 — C Introduction**
- Lab: **8 of 10**
- Mechanic: **Simulate** (`simulate`)
- Learning target: **write and recognize C comments**
- Challenge bank: `data/cp1/challenges/c_comments.json`, entry 8
- Page: `cp1/c_comments/variation8/index.html`

## Task

Step through the program and commit the final variable values.

Use Step to advance the machine. Type the final values, then commit.

## Answer and explanation

The final state is total = 7, printed = 7.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_comments/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
