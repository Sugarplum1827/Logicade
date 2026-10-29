"""Add the imported Kenney packs to LogiCade's Phaser runtime asset library.

The full source packs stay in vendor/kenney/organized. This copies their
renderable PNG/audio files into the shared, lazy-extracted runtime package,
extends its manifest, and assigns each of the 50 concepts to a visual theme.
Only the few assets selected for a run are loaded by Phaser.
"""

from __future__ import annotations

import json
import shutil
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "vendor" / "kenney" / "organized" / "registry.json"
PACK_ROOT = ROOT / "data" / "logicade_phaser_templates" / "logicade_phaser_templates" / "assets" / "logicade_starter_pack"
MANIFEST_PATH = PACK_ROOT / "asset_manifest.json"
KENNEY_ASSETS = PACK_ROOT / "assets" / "kenney"

PACKS = {
    "space": {"space_shooter_remastered", "sci_fi_sounds"},
    "urban": {"rpg_urban_pack"},
    "underwater": {"fish_pack_2"},
    "tower_defense": {"tower_defense_top_down"},
    "pirate": {"pirate_pack"},
    "farm": {"pixel_platformer_farm_expansion"},
    "food": {"pixel_platformer_food_expansion"},
}


def theme_for(game: dict) -> str | None:
    text = f"{game.get('template_id', '')} {game.get('display_name', '')}".lower()
    if any(word in text for word in ("underwater", "deep_sea", "abyssal", "submarine")):
        return "underwater"
    if "pirate" in text:
        return "pirate"
    if any(word in text for word in ("space", "alien", "stellar", "quantum", "cyber", "hacker", "rhythm", "synthesizer", "time_travel", "weather_station", "retro_arcade")):
        return "space"
    if any(word in text for word in ("tower", "castle", "gladiator", "kingdom_defender", "zombie", "siege", "dungeon", "magic_spell", "vampire", "circus", "royal_court")):
        return "tower_defense"
    if any(word in text for word in ("farm", "botanic", "eco_park", "jungle", "mountain", "volcano", "desert", "platformer_quest", "pixel_art_restorer")):
        return "farm"
    if any(word in text for word in ("cooking", "kitchen", "bakery", "baking", "candy_factory", "food")):
        return "food"
    if any(word in text for word in ("detective", "urban", "city", "supermarket", "airport", "superhero", "museum_heist", "sewer", "train", "factory", "wild_west", "tavern", "haunted", "ninja", "maze", "flowchart", "puzzle")):
        return "urban"
    return None


def row_id(row: dict) -> str:
    return row.get("id") or ("kenney." + row["name"])


def candidates(rows: list[dict], *needles: str) -> list[str]:
    found = []
    for row in rows:
        path = row.get("path", "").lower()
        name = row.get("name", "").lower()
        if any(n in path or n in name for n in needles):
            found.append(row_id(row))
    return found


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest-only", action="store_true", help="rebuild manifest/theme routing without recopying assets")
    args = parser.parse_args()
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    original_assets = {asset["id"]: asset for asset in manifest.get("assets", [])}
    new_assets: dict[str, dict] = {}

    for row in registry.get("assets", []):
        pack = row.get("pack")
        if pack not in set().union(*PACKS.values()):
            continue
        if row.get("kind") not in {"sprite", "spritesheet", "audio"}:
            continue
        ext = str(row.get("ext", "")).lower()
        if ext not in {"png", "ogg", "wav", "mp3"}:
            continue
        source = ROOT / "vendor" / "kenney" / "organized" / row["path"]
        if not args.manifest_only and not source.is_file():
            raise SystemExit(f"Cataloged asset is missing: {source}")
        asset_id = row_id(row)
        relative = Path(row["path"])
        target_rel = Path("assets") / "kenney" / relative
        target = PACK_ROOT / target_rel
        target.parent.mkdir(parents=True, exist_ok=True)
        if not args.manifest_only and (not target.exists() or target.stat().st_size != source.stat().st_size):
            shutil.copy2(source, target)
        item = {
            "id": asset_id,
            "path": target_rel.as_posix(),
            "category": row.get("category", "sprites"),
            "kind": row.get("kind", "sprite"),
            "pack": pack,
            "source": f"vendor/kenney/organized/{row['path']}",
            "license": "CC0-1.0",
        }
        for key in ("w", "h", "duration_sec"):
            if row.get(key) is not None:
                item[key] = row[key]
        new_assets[asset_id] = item

    all_assets = {**original_assets, **new_assets}
    assets_by_pack: dict[str, list[dict]] = {
        pack: [
            asset for asset in new_assets.values()
            if asset.get("pack") == pack and asset.get("kind") in {"sprite", "audio"}
            and "@2x" not in asset["id"].lower()
        ]
        for pack in set().union(*PACKS.values())
    }

    theme_sets: dict[str, dict] = {}
    for theme, pack_names in PACKS.items():
        rows = [row for pack in pack_names for row in assets_by_pack.get(pack, [])]
        image_rows = [row for row in rows if row.get("kind") == "sprite"]
        audio_rows = [row for row in rows if row.get("kind") == "audio"]
        tiles = [row_id(row) for row in image_rows if "/tiles/" in row.get("path", "") and "@2x" not in row.get("id", "").lower()]
        backgrounds = candidates(image_rows, "background", "backgrounds/", "sky")
        players = candidates(image_rows, "player_ship", "fish_", "ship_parts/crew", "ships/ship_")
        enemies = candidates(image_rows, "enemies/enemy_", "fish_", "ships/ship_")
        collectibles = candidates(image_rows, "power_ups/", "fish_", "treasure", "cannon_ball", "coin", "gem", "fruit")
        obstacles = candidates(image_rows, "meteor", "rock", "cannon", "tile_00", "seaweed", "tower_defense_tile_")
        goals = candidates(image_rows, "flag", "portal", "treasure", "ships/ship_")
        if not tiles:
            tiles = [row_id(row) for row in image_rows if "background" not in row.get("id", "").lower()]
        if not obstacles:
            obstacles = tiles
        theme_sets[theme] = {
            "packs": sorted(pack_names),
            "backgrounds": backgrounds,
            "players": players,
            "enemies": enemies,
            "tiles": tiles,
            "collectibles": collectibles,
            "obstacles": obstacles,
            "goals": goals,
            "audio": [row_id(row) for row in audio_rows],
        }

    catalog_path = ROOT / "data" / "logicade_phaser_templates" / "logicade_phaser_templates" / "data" / "registry.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    template_themes = {
        game["template_id"]: theme
        for game in catalog.get("games", [])
        if (theme := theme_for(game)) is not None
    }

    manifest["assets"] = sorted(all_assets.values(), key=lambda a: a["id"])
    manifest["asset_count"] = len(manifest["assets"])
    manifest["kenney_pack_sets"] = theme_sets
    manifest["template_themes"] = template_themes
    manifest["kenney_license"] = "CC0-1.0; source license files are retained under licenses/kenney/"
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # Retain each pack's own license document beside the runtime assets.
    licenses = PACK_ROOT / "licenses" / "kenney"
    for pack in set().union(*PACKS.values()):
        license_rows = [row for row in registry["assets"] if row.get("pack") == pack and row.get("category") == "docs" and "license" in row.get("name", "").lower()]
        if not license_rows:
            continue
        source = ROOT / "vendor" / "kenney" / "organized" / license_rows[0]["path"]
        target = licenses / f"{pack}.txt"
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

    print(f"Added {len(new_assets)} Kenney runtime assets ({sum(a.get('kind') == 'sprite' for a in new_assets.values())} images, {sum(a.get('kind') == 'audio' for a in new_assets.values())} audio files).")
    print("Theme sets: " + ", ".join(f"{name}={len(values['tiles'])} visual candidates" for name, values in sorted(theme_sets.items())))
    print(f"Mapped {len(template_themes)}/{len(catalog.get('games', []))} concepts to a Kenney visual theme.")


if __name__ == "__main__":
    main()
