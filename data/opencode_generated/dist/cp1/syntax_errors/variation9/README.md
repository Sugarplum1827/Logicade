# Syntax Errors — Lab 09: Split the scopes

- Track: **Computer Programming 1**
- Concept: **Syntax Errors** (`cp1_48_syntax_errors`)
- Week / unit: **Week 14 — Debugging**
- Lab: **9 of 10**
- Mechanic: **Scope** (`scope`)
- Learning target: **recognize errors the compiler reports**
- Challenge bank: `data/cp1/challenges/syntax_errors.json`, entry 9
- Page: `cp1/syntax_errors/variation9/index.html`

## Task

Place each item in file scope or main.

Tap a declaration or line, then the frame that contains it.

## Answer and explanation

The header and definition are top-level; the working statements are inside main.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/syntax_errors/variation9/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
