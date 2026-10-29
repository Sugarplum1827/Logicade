# Local Scope — Lab 02: Step the machine

- Track: **Computer Programming 1**
- Concept: **Local Scope** (`cp1_29_local_scope`)
- Week / unit: **Week 8 — Scope**
- Lab: **2 of 10**
- Mechanic: **Simulate** (`simulate`)
- Learning target: **identify where a local variable can be used**
- Challenge bank: `data/cp1/challenges/local_scope.json`, entry 2
- Page: `cp1/local_scope/variation2/index.html`

## Task

Step through the program and commit the final variable values.

Use Step to advance the machine. Type the final values, then commit.

## Answer and explanation

The final state is local = 5, result = 5.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/local_scope/variation2/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
