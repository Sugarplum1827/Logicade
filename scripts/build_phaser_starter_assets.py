"""Assemble a small, reproducible Phaser asset kit from the vendored CC0 pack."""

from __future__ import annotations

import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "vendor" / "kenney" / "organized"
OUTPUT = ROOT / "data" / "phaser_assets" / "logicade_starter_pack"
ARCHIVE = OUTPUT.parent / "logicade_starter_pack.zip"

SOURCES = {
    "characters/green_idle.png": "sprites/new_platformer_pack_1_1/characters/2x/character_green_idle.png",
    "characters/green_walk_a.png": "sprites/new_platformer_pack_1_1/characters/2x/character_green_walk_a.png",
    "characters/green_walk_b.png": "sprites/new_platformer_pack_1_1/characters/2x/character_green_walk_b.png",
    "characters/green_jump.png": "sprites/new_platformer_pack_1_1/characters/2x/character_green_jump.png",
    "characters/green_hit.png": "sprites/new_platformer_pack_1_1/characters/2x/character_green_hit.png",
    "characters/beige_idle.png": "sprites/new_platformer_pack_1_1/characters/2x/character_beige_idle.png",
    "characters/beige_walk_a.png": "sprites/new_platformer_pack_1_1/characters/2x/character_beige_walk_a.png",
    "characters/beige_walk_b.png": "sprites/new_platformer_pack_1_1/characters/2x/character_beige_walk_b.png",
    "enemies/slime_rest.png": "sprites/new_platformer_pack_1_1/enemies/1x/slime_block_rest.png",
    "enemies/slime_walk_a.png": "sprites/new_platformer_pack_1_1/enemies/1x/slime_normal_walk_a.png",
    "enemies/slime_walk_b.png": "sprites/new_platformer_pack_1_1/enemies/1x/slime_normal_walk_b.png",
    "enemies/bee_rest.png": "sprites/new_platformer_pack_1_1/enemies/1x/bee_rest.png",
    "enemies/bee_fly_a.png": "sprites/new_platformer_pack_1_1/enemies/1x/bee_a.png",
    "enemies/bee_fly_b.png": "sprites/new_platformer_pack_1_1/enemies/1x/bee_b.png",
    "backgrounds/forest.png": "sprites/new_platformer_pack_1_1/backgrounds/1x/background_color_trees.png",
    "backgrounds/hills.png": "sprites/new_platformer_pack_1_1/backgrounds/1x/background_color_hills.png",
    "backgrounds/cave.png": "sprites/new_platformer_pack_1_1/backgrounds/1x/background_color_mushrooms.png",
    "backgrounds/desert.png": "sprites/new_platformer_pack_1_1/backgrounds/1x/background_color_desert.png",
    "tiles/grass.png": "sprites/new_platformer_pack_1_1/tiles/1x/grass.png",
    "tiles/dirt.png": "sprites/new_platformer_pack_1_1/tiles/1x/terrain_dirt_block.png",
    "tiles/stone.png": "sprites/new_platformer_pack_1_1/tiles/1x/brick_grey.png",
    "tiles/wood.png": "sprites/new_platformer_pack_1_1/tiles/1x/bridge_logs.png",
    "tiles/spikes.png": "sprites/new_platformer_pack_1_1/tiles/1x/block_spikes.png",
    "tiles/coin.png": "sprites/new_platformer_pack_1_1/tiles/1x/coin_gold.png",
    "tiles/flag.png": "sprites/new_platformer_pack_1_1/tiles/1x/flag_green_a.png",
    "tiles/bush.png": "sprites/new_platformer_pack_1_1/tiles/1x/bush.png",
    "audio/jump.ogg": "audio/sfx/new_platformer_pack_1_1/sfx_jump.ogg",
    "audio/coin.ogg": "audio/sfx/new_platformer_pack_1_1/sfx_coin.ogg",
    "audio/hurt.ogg": "audio/sfx/new_platformer_pack_1_1/sfx_hurt.ogg",
    "audio/goal.ogg": "audio/sfx/new_platformer_pack_1_1/sfx_gem.ogg",
    "audio/impact.ogg": "audio/sfx/new_platformer_pack_1_1/sfx_bump.ogg",
}


def map_layout(map_id: str, biome: str, obstacles: list[dict], floor_gaps: list[int], coins: list[list[int]], enemies: list[dict]) -> dict:
    width, height = 14, 9
    return {
        "map_id": map_id,
        "biome": biome,
        "tile_size": 64,
        "width": width,
        "height": height,
        "background": f"backgrounds/{biome}.png",
        "bounds": {"left": 0, "top": 0, "right": width, "bottom": height},
        "spawn": {"x": 1, "y": 6},
        "goal": {"x": 12, "y": 6, "sprite": "tiles/flag.png"},
        "floor": {"y": 7, "sprite": "tiles/grass.png", "subsurface": "tiles/dirt.png",
                  "gaps": [{"x": x, "width": 1} for x in floor_gaps]},
        "obstacles": obstacles,
        "collectibles": [{"x": x, "y": y, "sprite": "tiles/coin.png"} for x, y in coins],
        "enemies": enemies,
    }


def main() -> None:
    missing = [source for source in SOURCES.values() if not (VENDOR / source).is_file()]
    if missing:
        raise SystemExit("Missing vendored source assets:\n" + "\n".join(missing))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for relative, source in SOURCES.items():
        target = OUTPUT / "assets" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(VENDOR / source, target)

    shutil.copy2(VENDOR / "docs" / "new_platformer_pack_1_1" / "license.txt", OUTPUT / "LICENSE-Kenney-New-Platformer-Pack.txt")
    maps = [
        map_layout("forest_path_01", "forest", [
            {"x": 4, "y": 6, "type": "spike"}, {"x": 8, "y": 6, "type": "gap"},
            {"x": 10, "y": 5, "type": "wood_platform"},
        ], [8], [[3, 5], [4, 4], [5, 5], [7, 5], [8, 4], [9, 5], [11, 5]], [
            {"x": 6, "y": 6, "sprite": "enemies/slime_rest.png"},
        ]),
        map_layout("cave_path_01", "cave", [
            {"x": 3, "y": 6, "type": "gap"}, {"x": 6, "y": 6, "type": "spike"},
            {"x": 9, "y": 6, "type": "gap"}, {"x": 11, "y": 5, "type": "stone_platform"},
        ], [3, 9], [[2, 5], [4, 5], [5, 4], [7, 5], [8, 4], [10, 5], [12, 4]], [
            {"x": 5, "y": 6, "sprite": "enemies/bee_rest.png"},
            {"x": 10, "y": 4, "sprite": "enemies/slime_rest.png"},
        ]),
    ]
    (OUTPUT / "maps").mkdir(exist_ok=True)
    for item in maps:
        (OUTPUT / "maps" / f"{item['map_id']}.json").write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")

    catalog = {
        "pack_id": "logicade-starter-01",
        "pack_version": "1.0.0",
        "engine": "Phaser",
        "license": "CC0-1.0",
        "attribution": "Kenney New Platformer Pack 1.1 (attribution appreciated, not required)",
        "source_license_file": "LICENSE-Kenney-New-Platformer-Pack.txt",
        "asset_count": len(SOURCES),
        "assets": [{"id": key.removesuffix(Path(key).suffix).replace("/", "."),
                    "path": f"assets/{key}", "category": key.split("/", 1)[0],
                    "source": f"vendor/kenney/organized/{source}"}
                   for key, source in SOURCES.items()],
        "maps": [{"id": item["map_id"], "path": f"maps/{item['map_id']}.json",
                  "width": item["width"], "height": item["height"], "biome": item["biome"]} for item in maps],
        "audio_events": {"jump": "assets/audio/jump.ogg", "collect": "assets/audio/coin.ogg",
                         "hurt": "assets/audio/hurt.ogg", "complete": "assets/audio/goal.ogg",
                         "obstacle": "assets/audio/impact.ogg"},
        "notes": ["Animations use reusable sprite frames; no per-session media generation is required.",
                  "Map layouts and audio event mappings are fixed pack data.",
                  "Keep this asset pack independent from learner identity and assessment records."],
    }
    (OUTPUT / "asset_manifest.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "README.md").write_text(
        "# LogiCade Phaser starter asset pack\n\n"
        "A small local CC0 pack assembled from the repository's vendored Kenney New Platformer Pack 1.1. "
        "It includes character animation frames, enemies, four backgrounds, terrain and obstacle sprites, "
        "five sound effects, a manifest, and two fixed map layouts.\n\n"
        "The maps describe tile coordinates and obstacle placement. Phaser templates should render these "
        "through the game engine; the LLM should select from this data rather than write executable code.\n\n"
        "See `LICENSE-Kenney-New-Platformer-Pack.txt` for the source license.\n", encoding="utf-8")

    with zipfile.ZipFile(ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(OUTPUT.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(OUTPUT.parent).as_posix())
    print(f"Created {OUTPUT.relative_to(ROOT).as_posix()}/")
    print(f"Created {ARCHIVE.relative_to(ROOT).as_posix()} ({len(SOURCES)} source assets, {len(maps)} maps)")


if __name__ == "__main__":
    main()
