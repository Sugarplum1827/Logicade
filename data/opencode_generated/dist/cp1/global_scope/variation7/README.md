# Global Scope — Lab 07: Split the scopes

- Track: **Computer Programming 1**
- Concept: **Global Scope** (`cp1_30_global_scope`)
- Week / unit: **Week 8 — Scope**
- Lab: **7 of 10**
- Mechanic: **Scope** (`scope`)
- Learning target: **read and reason about global variables**
- Challenge bank: `data/cp1/challenges/global_scope.json`, entry 7
- Page: `cp1/global_scope/variation7/index.html`

## Task

Place each item in global scope or a function.

Tap a declaration or line, then the frame that contains it.

## Answer and explanation

counter and bump are file-level; result is local to main.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/global_scope/variation7/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
