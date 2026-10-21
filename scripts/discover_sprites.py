#!/usr/bin/env python3
"""
Phase 11B: Comprehensive Asset Discovery & Distribution.

Scans vendor/kenney/extracted/ for every usable PNG and audio file.
- Categorizes images by role and subcategory (e.g., player/humanoid, hazard/slime).
- Distributes them into client/assets/sprites/, tilesets/, particle-effects/, and ui/.
- Distributes audio into client/assets/audio/ui/, impacts/, jingles/, etc.
- Deduplicates by content hash.
- Preserves the original 13 seed IDs so Phase 1 tests still pass.
- Generates a new data/registry.json with 100+ sprites.

Run:
    python scripts/discover_sprites.py
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "vendor" / "kenney" / "extracted"
ASSETS_DIR = REPO_ROOT / "client" / "assets"
REGISTRY = REPO_ROOT / "data" / "registry.json"

MIN_SIZE = 12
MAX_SIZE = 128
ASPECT_TOLERANCE = 1.6

# Global denylist to filter out UI, previews, etc.
DENY_ANY = (
    "hud_", "/hud/", "ui_", "/ui/", "icon_", "/icon", "cursor",
    "preview", "sample", "thumbnail", "license", "inputprompt",
    "input_", "hand_", "pointer_", "background", "backdrop"
)

# Image classification rules
# Format: (target_folder, role, subcategory, keywords, extra_deny)
IMAGE_RULES = [
    # ── SPRITES ──────────────────────────────────────────────────────
    ("sprites/player/humanoid",       "player",      "humanoid",      ["character", "player", "hero", "knight", "survivor", "adventurer", "p1_"], ["enemy", "hud"]),
    ("sprites/player/creature",       "player",      "creature",      ["alien", "robot", "creature", "ghost", "char_"], ["enemy", "hud"]),
    
    ("sprites/hazard/slime",          "hazard",      "slime",         ["slime"], []),
    ("sprites/hazard/spike",          "hazard",      "spike",         ["spike"], []),
    ("sprites/hazard/fire",           "hazard",      "fire",          ["fire_", "flame", "lava_"], []),
    ("sprites/hazard/saw",            "hazard",      "saw",           ["saw", "blade", "spinner"], []),
    ("sprites/hazard/bomb",           "hazard",      "bomb",          ["bomb", "tnt"], []),
    ("sprites/hazard/enemy",          "hazard",      "enemy",         ["enemy", "zombie", "bat_", "skeleton", "monster"], ["hud"]),
    
    ("sprites/collectible/coin",      "collectible", "coin",          ["coin"], ["block_"]),
    ("sprites/collectible/gem",       "collectible", "gem",           ["gem", "jewel", "crystal"], ["particle"]),
    ("sprites/collectible/key",       "collectible", "key",           ["key_", "_key"], []),
    ("sprites/collectible/special",   "collectible", "special",       ["star", "heart"], ["particle"]),
    
    ("sprites/obstacle/rock",         "obstacle",    "rock",          ["rock", "stone_", "_stone"], ["terrain"]),
    ("sprites/obstacle/crate",        "obstacle",    "crate",         ["crate", "barrel", "box_"], []),
    ("sprites/obstacle/terrain_block","obstacle",    "terrain_block", ["brick", "block_brick"], []),
    
    ("sprites/goal/flag",             "goal",        "flag",          ["flag_"], []),
    ("sprites/goal/door",             "goal",        "door",          ["door_"], []),
    ("sprites/goal/portal",           "goal",        "portal",        ["portal", "gate", "exit_"], []),
    
    ("sprites/powerup/potion",        "powerup",     "potion",        ["potion", "flask", "bottle"], []),
    ("sprites/powerup/shield",        "powerup",     "shield",        ["shield_"], []),
    
    ("sprites/decor/tree",            "decor",       "tree",          ["tree", "pine", "oak"], []),
    ("sprites/decor/bush",            "decor",       "bush",          ["bush", "shrub"], []),
    ("sprites/decor/plant",           "decor",       "plant",         ["flower", "plant", "grass_"], ["terrain"]),
    
    # ── TILESETS ─────────────────────────────────────────────────────
    ("tilesets/terrain/grass",        "tileset",     "grass",         ["terrain_grass", "grass_"], []),
    ("tilesets/terrain/stone",        "tileset",     "stone",         ["terrain_stone", "stone_"], []),
    ("tilesets/terrain/dirt",         "tileset",     "dirt",          ["terrain_dirt", "dirt_"], []),
    ("tilesets/building/brick",       "tileset",     "brick",         ["brick", "wall"], []),
    ("tilesets/building/wood",        "tileset",     "wood",          ["wood", "plank"], []),
    
    # ── PARTICLES ────────────────────────────────────────────────────
    ("particle-effects/fire",         "particle",    "fire",          ["fire", "flame", "lava"], []),
    ("particle-effects/smoke",        "particle",    "smoke",         ["smoke", "cloud", "dust"], []),
    ("particle-effects/magic",        "particle",    "magic",         ["magic", "sparkle", "glow", "star"], ["particleCartoonStar"]),
    ("particle-effects/sparks",       "particle",    "sparks",        ["spark", "slash", "hit"], []),
    
    # ── UI ───────────────────────────────────────────────────────────
    ("ui/buttons",                    "ui",          "buttons",       ["button", "btn_"], []),
    ("ui/panels",                     "ui",          "panels",        ["panel", "window", "frame"], []),
    ("ui/icons",                      "ui",          "icons",         ["icon_", "cursor", "pointer"], []),
]

# Audio classification rules
AUDIO_RULES = [
    ("audio/ui",        ["click_", "confirmation_", "error_", "select_", "close_", "open_", "maximize_", "minimize_", "back_"]),
    ("audio/impacts",   ["impact"]),
    ("audio/jingles",   ["jingles_"]),
    ("audio/footsteps", ["footstep_"]),
    ("audio/ambience",  ["ambience_", "loop_"]),
]

def _content_hash(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()[:16]

def _is_square_ish(w: int, h: int) -> bool:
    if w == 0 or h == 0: return False
    return max(w / h, h / w) <= ASPECT_TOLERANCE

def _clean_name(stem: str) -> str:
    s = stem.lower()
    s = re.sub(r"^tile_0*", "tile", s)
    s = re.sub(r"[^a-z0-9_]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "sprite"

def _classify_image(rel: str) -> tuple[str, str, str] | None:
    lower = ("/" + rel + "/").lower()
    
    for token in DENY_ANY:
        if token in lower:
            return None

    for folder, role, sub, keywords, extra_deny in IMAGE_RULES:
        if any(ed in lower for ed in extra_deny):
            continue
        for kw in keywords:
            if kw in lower:
                return folder, role, sub
    return None

def _classify_audio(filename: str) -> str | None:
    name = filename.lower()
    for folder, prefixes in AUDIO_RULES:
        if any(name.startswith(p) for p in prefixes):
            return folder
    return None

def main() -> int:
    if not SRC_DIR.exists():
        print(f"[discover] missing source: {SRC_DIR}")
        return 1

    # 1. Load existing registry to preserve seed IDs
    old_registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    seed_ids = {s["id"] for s in old_registry["sprites"]}
    
    # 2. Setup counters and trackers
    seen_hashes = set()
    new_sprites = []
    new_tilesets = []
    stats = {}
    audio_moved = 0

    # 3. Scan and process images
    print("[discover] scanning images...")
    for png in sorted(SRC_DIR.rglob("*.png")):
        try:
            with Image.open(png) as im:
                w, h = im.size
        except Exception:
            continue

        if not (MIN_SIZE <= w <= MAX_SIZE and MIN_SIZE <= h <= MAX_SIZE):
            continue
        if not _is_square_ish(w, h):
            continue

        rel = png.relative_to(SRC_DIR).as_posix()
        ch = _content_hash(png)
        if ch in seen_hashes:
            continue

        classification = _classify_image(rel)
        if not classification:
            continue
            
        folder, role, sub = classification
        
        # Determine target ID
        base_id = f"{role}_{sub}_{_clean_name(png.stem)}"
        asset_id = base_id
        n = 1
        existing_ids = {s["id"] for s in new_sprites} | seed_ids
        while asset_id in existing_ids:
            asset_id = f"{base_id}_{n}"
            n += 1

        # Copy file
        dst_dir = ASSETS_DIR / folder
        dst_dir.mkdir(parents=True, exist_ok=True)
        dst = dst_dir / f"{asset_id}.png"
        shutil.copy2(png, dst)
        
        seen_hashes.add(ch)
        
        # Save registry entry
        if role == "tileset":
            new_tilesets.append({
                "id": asset_id,
                "sprite_key": f"{folder}/{asset_id}.png",
                "group": "tileset",
                "subcategory": sub,
                "size": [w, h],
            })
        elif role not in ("particle", "ui"):
            new_sprites.append({
                "id": asset_id,
                "sprite_key": f"{folder}/{asset_id}.png",
                "role": role,
                "subcategory": sub,
                "frames": 1,
                "collision_box": [w, h],
                "allowed_contexts": [1, 2, 3, 4, 5, 6, 7, 8],
            })
            
        key = f"{role}.{sub}"
        stats[key] = stats.get(key, 0) + 1

    # 4. Scan and process audio
    print("[discover] scanning audio...")
    for ext in ("*.ogg", "*.wav", "*.mp3"):
        for audio_file in SRC_DIR.rglob(ext):
            folder = _classify_audio(audio_file.name)
            if not folder: continue
            
            dst_dir = ASSETS_DIR / folder
            dst_dir.mkdir(parents=True, exist_ok=True)
            dst = dst_dir / audio_file.name
            
            if not dst.exists():
                shutil.copy2(audio_file, dst)
                audio_moved += 1

    # 5. Reconstruct registry, preserving seed sprites but updating their paths
    # The old seed sprites are already in client/assets/sprites/player/ etc.
    # We just need to ensure their IDs are in the new registry.
    
    preserved_sprites = []
    # Map old seed IDs to new paths based on their role
    for s in old_registry["sprites"]:
        if s["id"] in seed_ids:
            # Point to the new organized location
            sub = "humanoid" if s["role"] == "player" else s["role"]
            if s["id"] == "coin": sub = "coin"
            elif s["id"] == "gem": sub = "gem"
            elif s["id"] == "spike": sub = "spike"
            elif s["id"] == "slime": sub = "slime"
            elif s["id"] == "rock": sub = "rock"
            elif s["id"] == "crate": sub = "crate"
            elif s["id"] == "flag": sub = "flag"
            elif s["id"] == "portal": sub = "portal"
            elif s["id"] == "heart": sub = "special"
            elif s["id"] == "star": sub = "special"
            elif s["id"] == "bolt": sub = "enemy"
            
            s["sprite_key"] = f"sprites/{s['role']}/{sub}/{s['id']}.png"
            preserved_sprites.append(s)

    new_registry = {
        "_meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "discover_sprites.py",
            "seed_count": len(preserved_sprites),
            "discovered_count": len(new_sprites),
            "tileset_count": len(new_tilesets),
            "category_stats": dict(sorted(stats.items())),
        },
        "sprites": preserved_sprites + new_sprites,
        "tilemaps": old_registry["tilemaps"],
    }

    REGISTRY.write_text(json.dumps(new_registry, indent=2), encoding="utf-8")

    print(f"\n[discover] preserved {len(preserved_sprites)} seed sprites")
    print(f"[discover] discovered {len(new_sprites)} new sprites")
    print(f"[discover] collected {len(new_tilesets)} tileset tiles")
    print(f"[discover] moved {audio_moved} audio files")
    print("\nBreakdown by role.subcategory:")
    for key, count in stats.items():
        print(f"  {key:<25} {count}")
        
    print(f"\n[discover] wrote {REGISTRY.relative_to(REPO_ROOT)}")
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())