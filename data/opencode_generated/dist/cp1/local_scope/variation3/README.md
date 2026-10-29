# Local Scope — Lab 03: Order the procedure

- Track: **Computer Programming 1**
- Concept: **Local Scope** (`cp1_29_local_scope`)
- Week / unit: **Week 8 — Scope**
- Lab: **3 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **identify where a local variable can be used**
- Challenge bank: `data/cp1/challenges/local_scope.json`, entry 3
- Page: `cp1/local_scope/variation3/index.html`

## Task

Put the steps of local scope in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Enter the function → Declare the local variable → Use it inside the same function → Leave the function and lose access

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/local_scope/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
