# Variable Names — Lab 05: Split the scopes

- Track: **Computer Programming 1**
- Concept: **Variable Names** (`cp1_22_variable_names`)
- Week / unit: **Week 7 — Variables**
- Lab: **5 of 10**
- Mechanic: **Scope** (`scope`)
- Learning target: **choose valid and meaningful variable names**
- Challenge bank: `data/cp1/challenges/variable_names.json`, entry 5
- Page: `cp1/variable_names/variation5/index.html`

## Task

Place each item in file scope or main.

Tap a declaration or line, then the frame that contains it.

## Answer and explanation

high_score is global; player_score and _lives are local to main.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/variable_names/variation5/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
