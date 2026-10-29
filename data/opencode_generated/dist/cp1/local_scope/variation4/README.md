# Local Scope — Lab 04: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Local Scope** (`cp1_29_local_scope`)
- Week / unit: **Week 8 — Scope**
- Lab: **4 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **identify where a local variable can be used**
- Challenge bank: `data/cp1/challenges/local_scope.json`, entry 4
- Page: `cp1/local_scope/variation4/index.html`

## Task

Build a local variable inside a function.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

Declaring local inside the function body gives it local scope.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/local_scope/variation4/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
