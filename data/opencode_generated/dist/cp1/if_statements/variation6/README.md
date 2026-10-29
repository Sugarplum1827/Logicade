# If Statements — Lab 06: Order the procedure

- Track: **Computer Programming 1**
- Concept: **If Statements** (`cp1_36_if_statements`)
- Week / unit: **Week 10 — Conditionals**
- Lab: **6 of 10**
- Mechanic: **Order** (`order`)
- Learning target: **control one block with an if test**
- Challenge bank: `data/cp1/challenges/if_statements.json`, entry 6
- Page: `cp1/if_statements/variation6/index.html`

## Task

Put the steps of if statements in the order they happen.

Tap the pieces in the right order. Tap a placed piece to send it back.

## Answer and explanation

Correct order: Evaluate the condition in parentheses → If true, run the braced body → If false, skip the body → Continue with the next statement

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/if_statements/variation6/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
