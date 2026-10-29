# If Statements — Lab 01: Split the scopes

- Track: **Computer Programming 1**
- Concept: **If Statements** (`cp1_36_if_statements`)
- Week / unit: **Week 10 — Conditionals**
- Lab: **1 of 10**
- Mechanic: **Scope** (`scope`)
- Learning target: **control one block with an if test**
- Challenge bank: `data/cp1/challenges/if_statements.json`, entry 1
- Page: `cp1/if_statements/variation1/index.html`

## Task

Place each item in main or the if body.

Tap a declaration or line, then the frame that contains it.

## Answer and explanation

temp is local to main; hot is local to the if body.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/if_statements/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
