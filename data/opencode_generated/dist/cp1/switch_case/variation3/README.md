# Switch Statements — Lab 03: Step the machine

- Track: **Computer Programming 1**
- Concept: **Switch Statements** (`cp1_38_switch_case`)
- Week / unit: **Week 10 — Conditionals**
- Lab: **3 of 10**
- Mechanic: **Simulate** (`simulate`)
- Learning target: **trace switch cases and break statements**
- Challenge bank: `data/cp1/challenges/switch_case.json`, entry 3
- Page: `cp1/switch_case/variation3/index.html`

## Task

Step through the program and commit the final variable values.

Use Step to advance the machine. Type the final values, then commit.

## Answer and explanation

The final state is choice = 2, label = Two.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/switch_case/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
