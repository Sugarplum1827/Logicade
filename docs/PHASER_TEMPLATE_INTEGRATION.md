# Legacy Phaser template integration status

This document describes an older optional renderer. Its required folder, `data/logicade_phaser_templates/logicade_phaser_templates/`, is absent from the current workspace, so template catalog and asset requests fail and `GameContainer` falls back to the legacy JSON renderer. Do not treat that older renderer as the active generated-game system.

## Active generated-game flow

1. `LevelSelect` calls `/serve` with the selected week, level, and difficulty. The server chooses an existing CP1 description JSON and reserves an unused OpenCode variation for that participant.
2. The mission panel shows the description and objective. On **View Mission**, `/api/games/prepare` compiles the selected OpenCode variation and question bank into a same-stem ZIP and writes its description and manifest JSON next to the source JSON.
3. The server extracts a private lease. **Cancel** releases that lease; **Start** opens the ZIP's game-only `index.html` in the sandboxed `GamePackageFrame`.
4. The shared game engine, assets, and Phaser runtime are served from `data/opencode_generated/dist` through `/game-runtime`; the ZIP stores only game-specific data and launcher files.
5. Exit, repeat, and completion consume or rotate the selected variation according to the gameplay flow. Attempts and telemetry are queued locally and synchronized through the authenticated API.

The active library currently contains 50 concepts and 500 variations. They are distinct authored builds, not 500 separately coded engines; the project shares a runtime and visual assets. During this audit the catalog scan found 50 concepts and 500 valid variation folders.

## Legacy renderer limitations

The old client still contains `LogicadeTemplateScene` and calls `loadTemplateData()`. Because the template directory is missing, those calls fail and the client falls back to its JSON Phaser scenes. Restore that exact data library only if the legacy renderer is intentionally retained. Otherwise, remove that dead branch in a separately reviewed cleanup after confirming all supported start and reload paths use the packaged OpenCode game.
