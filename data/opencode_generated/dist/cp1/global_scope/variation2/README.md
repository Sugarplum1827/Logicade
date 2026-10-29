# Global Scope — Lab 02: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Global Scope** (`cp1_30_global_scope`)
- Week / unit: **Week 8 — Scope**
- Lab: **2 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **read and reason about global variables**
- Challenge bank: `data/cp1/challenges/global_scope.json`, entry 2
- Page: `cp1/global_scope/variation2/index.html`

## Task

Put the steps of global scope in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Declare the variable outside every function → Initialize it once → Use it from more than one function → Avoid hiding it with a local of the same name

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/global_scope/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
