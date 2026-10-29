# C Selection — Lab 08: Split the scopes

- Track: **Computer Programming 1**
- Concept: **C Selection** (`cp1_19_c_selection`)
- Week / unit: **Week 6 — C Structure**
- Lab: **8 of 10**
- Mechanic: **Scope** (`scope`)
- Learning target: **trace an if/else selection**
- Challenge bank: `data/cp1/challenges/c_selection.json`, entry 8
- Page: `cp1/c_selection/variation8/index.html`

## Task

Place each declaration in main or inside the if block.

Tap a declaration or line, then the frame that contains it.

## Answer and explanation

score is local to main; bonus exists only inside the if block.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_selection/variation8/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
