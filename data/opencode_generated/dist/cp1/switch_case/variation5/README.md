# Switch Statements — Lab 05: Assemble the line

- Track: **Computer Programming 1**
- Concept: **Switch Statements** (`cp1_38_switch_case`)
- Week / unit: **Week 10 — Conditionals**
- Lab: **5 of 10**
- Mechanic: **Assemble** (`assemble`)
- Learning target: **trace switch cases and break statements**
- Challenge bank: `data/cp1/challenges/switch_case.json`, entry 5
- Page: `cp1/switch_case/variation5/index.html`

## Task

Build a case label for choice 2 followed by a break.

Choose tokens from the bank. Every token is used once; some are decoys.

## Answer and explanation

A case label ends with a colon; break exits the switch.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/switch_case/variation5/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
