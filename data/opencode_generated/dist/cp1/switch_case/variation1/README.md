# Switch Statements — Lab 01: Repair the program

- Track: **Computer Programming 1**
- Concept: **Switch Statements** (`cp1_38_switch_case`)
- Week / unit: **Week 10 — Conditionals**
- Lab: **1 of 10**
- Mechanic: **Repair** (`repair`)
- Learning target: **trace switch cases and break statements**
- Challenge bank: `data/cp1/challenges/switch_case.json`, entry 1
- Page: `cp1/switch_case/variation1/index.html`

## Task

Repair the switch statement.

Tap a token, then a blank. Decoy tokens are mixed into the bank.

## Answer and explanation

case 1 is matched by the value; break prevents fall-through.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/switch_case/variation1/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
