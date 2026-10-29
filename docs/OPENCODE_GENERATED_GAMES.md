# OpenCode generated games

The OpenCode game library is copied into `data/opencode_generated/dist` so LogiCade can package and run it without depending on the separate `opencode_generated` folder. The backend indexes each concept and its `variation1` through `variation10` directories at startup. Set `LOGICADE_GENERATED_GAMES_DIR` only if the copied library is moved.

## Learner flow

1. Selecting an unlocked level reads the assigned CP1 difficulty and an available fallback description JSON from its week/level/difficulty folder.
2. The server compares the description's topic and learning alignment with the OpenCode games, reserves a variation the learner has not seen, and returns that variation's mission description.
3. Choosing **CHALLENGE** creates the same-stem ZIP beside the fallback JSON, plus same-stem `.description.json` and `.manifest.json` files. The ZIP contains a game-only entry page and the selected variation/question data. It does not show the OpenCode catalog or build-information page.
4. The server extracts the small ZIP into a private lease. The sandboxed game loads the shared engine, art, and Phaser library from the read-only `/game-runtime` mounts, rather than duplicating them in each lease, and continues to report gameplay to LogiCade.
5. Cancel removes only the private extracted copy. Completing a game, exiting, or choosing Repeat records the variation as used and pops the matching ZIP and generated sidecars. Repeat immediately selects and compiles a different variation; selecting the level again after Exit does the same.

The canonical fallback JSON remains the source description for CP1 week, level, and difficulty. The OpenCode variation's question bank and objective are written into its generated `description.json`; the manifest records the source JSON, selected variation, difficulty, and archive identity. Existing ZIPs are backed up once under `data/opencode_package_backups/` before first replacement.

## Variation selection and limits

Variation selection prefers the closest learning-target match, then chooses randomly among unused variations. The seen list is stored by pseudonymous participant ID in `data/opencode_generated/used_variations.json`; it resets to a new cycle only after that participant has seen all 500 variations. The library currently contains 50 concepts and 500 variations.

The source library does not define separate Needs Support, Standard, and Advanced builds. LogiCade selects the fallback JSON from the assigned difficulty folder and records that difficulty in the description, ZIP manifest, and game metadata. It does not silently alter OpenCode game mechanics or invent new adaptation thresholds.

The ZIP is compiled from a pre-generated OpenCode variation. This is a local packaging step, not an LLM or OpenCode generation request. A genuinely new concept or variation must first be authored and added to the internal library, then the API server restarted to discover it.
