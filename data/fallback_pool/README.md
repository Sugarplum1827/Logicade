# Fallback pool naming and package layout

The pool is organized by study week, level, and the difficulty that is served:

```text
data/fallback_pool/
  week_1/
    level1/
      needs_support/
      standard/
      advanced/
```

Each JSON filename identifies its catalog slot:

```text
game_week{week}_level{level}_difficulty({Difficulty})_{slot}.json
```

For example:

```text
week_1/level1/standard/game_week1_level1_difficulty(Standard)_1.json
```

Difficulty tokens in filenames are `NeedAssistance`, `Standard`, and `Advance`;
the matching directory names are `needs_support`, `standard`, and `advanced`.
Slots start at 1 and are unique within a week/level/difficulty folder. Keep the
JSON's `file_id` and `unique_identity_key` stable when replacing the contents of
a slot. The server writes replacements back to the selected JSON path, so the
slot name remains stable across regeneration.

## Playable Phaser game packages

Every cataloged fallback has a same-stem `.zip` package beside its JSON:

```text
game_week1_level1_difficulty(Standard)_1.json
game_week1_level1_difficulty(Standard)_1.zip
```

Each generated Phaser package stores its per-game template and variation
assignment in `logicade_phaser_game.json`. The Phaser runtime and shared assets
are packaged once; mission preview extracts that shared runtime with the
selected game package, and Start launches it in LogiCade's Phaser scene. The
original JSON remains the authoritative mission and CP1 description.

Imported OhMyGame HTML5 builds can also use same-stem ZIPs. They contain a
standalone `index.html` and assets, and launch in the sandboxed frame. Do not
replace a generated Phaser package unless intentionally replacing that game
with an OhMyGame build. Use `scripts/import_ohmygame_build.py` for that import.

## Normalize and check names

Run the normalizer from the repository root to preview changes:

```powershell
python scripts/normalize_fallback_pool_names.py
```

Add `--apply` to rename noncanonical files. It validates each JSON's week,
level, and difficulty against its containing folder and assigns the next free
slot number without changing the embedded game identity.
