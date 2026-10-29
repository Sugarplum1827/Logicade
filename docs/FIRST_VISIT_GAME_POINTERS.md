# First-visit game pointers

The introductory playable stage of each region includes a guided overlay: Kingdom (Week 1) Stage 2, and Weeks 2–9 Stage 1. The welcome video and later stages do not show it.

The guide highlights real controls or Canvas locations with a dashed outline and a dotted arrow. It describes the current mission without executing a solution:

- Flowcharts: task, draggable block tray, a drop position, Check Chart.
- Connected C nodes: objective, incoming signals, node editors, port directions, target/actual output, execution controls.
- Factory: objective, machine sprite tray, source, output destination, execution controls.
- Adventure: objective, character, a crystal when present, exit, source/program controls, execution controls. Item and exit positions come from the selected challenge, including variations.
- C archive: lesson panel, question, answer area. Week 4's approved gameplay remains unchanged.

Use Back/Next to inspect the guide, then Got it · Play to close it. The overlay blocks game input, traps keyboard focus, and stops gameplay elapsed time and simulation advancement while open. Reduced-motion preferences disable the animated dotted line. No hints are purchased and no rewards are granted by the walkthrough.

## First-visit state

The React host decides whether to show the guide and sends only a boolean in the existing sandbox initialization message. Completion is accepted only from that iframe's window. It is saved under `logicade_game_guidance_v1_<participant>_w<week>`. Completing a guide for one account or region does not complete another. Existing local completed-stage records suppress a guide for a stage already cleared. Leaving before the last step does not save completion.

This preference is local to the browser. It is not synchronized across devices; clearing browser storage can show it again. Gameplay, coins, difficulty decisions and formal assessment records are unchanged.

The runtime implementation is included in the existing shared `lesson-guide.js` asset and `styles.css`. Mission preparation compiles the selected native Canvas ZIP using the current runtime index; no bulk rewrite of the challenge pool is needed.

## Verification

- 125 frontend tests passed, including account/region eligibility checks and pointer-target construction for all 270 introductory stage/difficulty/variation records.
- 51 package and replacement regression checks passed.
- Production React build passed; existing large-bundle warning remains.
- Isolated browser walkthroughs completed for all nine regions. Every step's highlight was visible and closing each guide returned control to the game. Tests used disposable packages and did not write participant records.

Evidence: `artifacts/first-visit-browser-checks.json`, `artifacts/first-visit-adventure-pointers.png`, `artifacts/first-visit-frontend-tests.txt`, and `artifacts/first-visit-backend-tests.txt`.
