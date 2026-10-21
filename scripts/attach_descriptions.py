"""Merge semantic descriptions into registry.json so the LLM can matchmake."""
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
REGISTRY = REPO_ROOT / "data" / "registry.json"
MAP_DESC = REPO_ROOT / "data" / "map_descriptions.json"
SPRITE_DESC = REPO_ROOT / "data" / "sprite_descriptions.json"

def main():
    if not REGISTRY.exists():
        print(f"[desc] {REGISTRY} not found. Run discover_sprites.py first.")
        return

    reg = json.loads(REGISTRY.read_text(encoding="utf-8"))
    
    # 1. Attach Map Descriptions
    maps = json.loads(MAP_DESC.read_text(encoding="utf-8-sig"))
    map_index = {m["id"]: m for m in maps}
    for tm in reg["tilemaps"]:
        desc = map_index.get(tm["id"], {})
        tm.update({
            "display_name": desc.get("display_name", tm["id"]),
            "description": desc.get("description", ""),
            "themes": desc.get("themes", []),
            "tone": desc.get("tone", ""),
            "best_for": desc.get("best_for", []),
            "suggested_enemies": desc.get("suggested_enemies", []),
            "suggested_collectibles": desc.get("suggested_collectibles", []),
        })

    # 2. Attach Sprite Descriptions
    sprites = json.loads(SPRITE_DESC.read_text(encoding="utf-8-sig"))
    attached = 0
    for sp in reg["sprites"]:
        # Try exact match (role_subcategory), then role
        key = f"{sp['role']}_{sp.get('subcategory', '')}"
        desc = sprites.get(key) or sprites.get(sp["role"])
        
        if desc:
            sp.update({
                "description": desc.get("description", ""),
                "themes": desc.get("themes", []),
                "tone": desc.get("tone", "")
            })
            attached += 1

    REGISTRY.write_text(json.dumps(reg, indent=2), encoding="utf-8")
    print(f"[desc] Attached descriptions to {len(reg['tilemaps'])} maps and {attached} sprites.")

if __name__ == "__main__":
    main()