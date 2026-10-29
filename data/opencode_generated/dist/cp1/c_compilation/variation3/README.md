# Compiling C — Lab 03: Sort into bins

- Track: **Computer Programming 1**
- Concept: **Compiling C** (`cp1_12_c_compilation`)
- Week / unit: **Week 4 — C Introduction**
- Lab: **3 of 10**
- Mechanic: **Sort** (`sort`)
- Learning target: **follow source code through compilation to an executable**
- Challenge bank: `data/cp1/challenges/c_compilation.json`, entry 3
- Page: `cp1/c_compilation/variation3/index.html`

## Task

Sort each step as source, compile, or run.

Tap an item, then the bin where it belongs.

## Answer and explanation

Editing is source time, gcc acts at compile time, and the executable runs later.

## Run

From the repository root:

```bash
npm run dev
# open http://127.0.0.1:5173/cp1/c_compilation/variation3/
```

## Verification

`npm run check` validates this page, its `variation.json`, the challenge bank entry, the ten-distinct-mechanic rule, and the shared interactive runtime. `npm run build` copies the page into `dist/` and writes a checksum manifest.

## Limitations

- Each CP1 variation is one authored interactive task, not a full game level.
- The lab uses the shared DOM mechanic library. It is not a separate engine per page.
- All content, styles, and scripts are local. There are no remote fonts, scripts, or services.
