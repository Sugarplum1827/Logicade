# C Program Structure — Lab 06: Split the scopes

- Track: **Computer Programming 1**
- Concept: **C Program Structure** (`cp1_11_c_program_structure`)
- Week / unit: **Week 4 — C Introduction**
- Lab: **6 of 10**
- Mechanic: **Scope** (`scope`)
- Learning target: **identify the parts of a C program**
- Challenge bank: `data/cp1/challenges/c_program_structure.json`, entry 6
- Page: `cp1/c_program_structure/variation6/index.html`

## Task

Place each item in the file scope or the main function.

Tap a declaration or line, then the frame that contains it.

## Answer and explanation

The include and main definition sit at file scope; its body statements belong to main.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_program_structure/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
