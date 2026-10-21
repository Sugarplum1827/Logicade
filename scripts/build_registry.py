"""Build data/registry.json from the Kenney manifest — Phase 2.

Reads vendor/kenney/manifest.json, picks a source PNG for every sprite id
and tilemap id in the *current* data/registry.json, copies the picks into
client/assets/, synthesizes 16x16 placeholders only when no candidate
survives, and rewrites data/registry.json atomically.

Guarantees (asserted by tests/test_core.py::test_registry_contract):
  • every sprite id present before the run survives the rewrite
  • every sprite keeps its 'role' and 'allowed_contexts'
  • every tilemap id present before the run survives the rewrite

Picking policy:
  • A per-role pack preference table means gameplay sprites come from the
    packs that actually contain gameplay sprites — not whichever pack has
    the most small PNGs.
  • A denylist removes UI/hud/particle/background matches, which are
    never valid gameplay entities.
  • Duplicate sources are avoided: if two sprite ids would resolve to the
    same file, the second one falls back to its next-best candidate.
  • Placeholders are used only when nothing survives. The pipeline is
    honest about gaps rather than silently copying a wrong file.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("[build] Pillow is required: pip install Pillow", file=sys.stderr)
    raise

REPO_ROOT = Path(__file__).resolve().parent.parent
MANIFEST = REPO_ROOT / "vendor" / "kenney" / "manifest.json"
REGISTRY = REPO_ROOT / "data" / "registry.json"
ASSETS = REPO_ROOT / "client" / "assets"

# ── Picking policy ────────────────────────────────────────────────────

# Never select these for any sprite or tilemap — they are UI, HUD,
# particle effects, backgrounds, or preview material.
DENYLIST_PATTERNS = (
    "hud_", "/hud/", "ui_", "/ui/", "cursor_", "keyboard_", "gamepad_",
    "icon_", "_icon.", "button_", "/button", "/ui/",
    "preview", "sample", "license", "thumbnail",
)

# Order matters: earlier packs rank higher. Every preferred pack must
# exist in the manifest or the score for that pack simply contributes
# nothing (missing packs are not an error).
ROLE_PACK_PREFERENCE: dict[str, list[str]] = {
    "player":      ["kenney_pixel-platformer",
                    "kenney_new-platformer-pack-1.1",
                    "kenney_1-bit-pack"],
    "collectible": ["kenney_puzzle-pack-1",
                    "kenney_new-platformer-pack-1.1",
                    "kenney_pixel-platformer"],
    "hazard":      ["kenney_new-platformer-pack-1.1",
                    "kenney_pixel-platformer"],
    "obstacle":    ["kenney_new-platformer-pack-1.1",
                    "kenney_pixel-platformer"],
    "goal":        ["kenney_new-platformer-pack-1.1",
                    "kenney_pixel-platformer"],
    "powerup":     ["kenney_new-platformer-pack-1.1",
                    "kenney_puzzle-pack-1"],
    "decor":       ["kenney_foliage-pack",
                    "kenney_new-platformer-pack-1.1"],
    "projectile":  ["kenney_new-platformer-pack-1.1",
                    "kenney_pixel-platformer"],
}

# Tightened keyword bags. Note "player" is deliberately *not* a keyword —
# it pulls in hud_player_* and player_*_ui assets. Real characters use
# "character", "/p1_", "hero", "knight", etc.
ROLE_KEYWORDS: dict[str, list[str]] = {
    "player":      ["player", "character", "alien", "robot", "knight", "survivor", "char_"],
    "collectible": ["coin", "gem", "key", "jewel", "crystal", "star", "heart", "treasure"],
    "hazard":      ["spike", "enemy", "slime", "bomb", "fire", "lava", "saw", "trap", "zombie"],
    "obstacle":    ["rock", "crate", "stone_block", "brick", "box", "barrel"],
    "goal":        ["flag", "door", "exit", "portal", "goal"],
    "powerup":     ["potion", "shield", "ammo", "boost"],
}

MAP_PACK_PREFERENCE: dict[str, list[str]] = {
    "grid_12x9_forest":  ["kenney_foliage-pack",
                          "kenney_new-platformer-pack-1.1"],
    "grid_12x9_cave":    ["kenney_new-platformer-pack-1.1"],
    "grid_16x12_castle": ["kenney_new-platformer-pack-1.1"],
    "grid_10x8_dungeon": ["kenney_new-platformer-pack-1.1"],
    "grid_14x10_ruins":  ["kenney_pixel-platformer",
                          "kenney_new-platformer-pack-1.1"],
}

MAP_KEYWORDS: dict[str, list[str]] = {
    "grid_12x9_forest":  ["grass", "dirt", "leaf", "terrain"],
    "grid_12x9_cave":    ["stone", "rock", "ground", "terrain"],
    "grid_16x12_castle": ["stone", "brick", "wall"],
    "grid_10x8_dungeon": ["stone", "cobble", "ground", "terrain"],
    "grid_14x10_ruins":  ["stone", "brick", "ground", "terrain"],
}

TILE_SIZE_RANGE = (8, 64)           # Kenney's new-platformer uses 64x64 tiles
TARGET_MAX_DIM = 64                 # reject oversized candidates for sprites
TARGET_GOOD_SIZES = {(16, 16), (24, 24), (32, 32), (48, 48)}

# Denylist for tilemap candidates. Adds /characters/, /items/, /ui/ etc.
# — those are sprite categories, not ground/terrain textures.
TILEMAP_DENYLIST = (
    "cloud_background", "background", "_bg", "/bg/", "sky", "/preview",
    "wireframe", "/characters/", "/chars/", "/character/",
    "/items/", "/ui/", "/hud/", "/effects/", "/weapons/",
)

# Require at least ONE of these in the path — "tile" alone is not enough
# because sliced spritesheets name every frame tile_XXXX.png.
TILE_STRONG_KEYWORDS = (
    "/terrain/", "terrain_", "/ground", "ground_", "grass", "/grass",
    "/stone", "stone_", "dirt", "brick_", "/brick", "block_", "/block",
    "floor", "cobble", "sand", "snow", "wood_", "/wood",
)

ROLE_COLOURS = {
    "player":      (60, 120, 220),
    "collectible": (240, 200, 50),
    "hazard":      (220, 60, 60),
    "obstacle":    (110, 110, 110),
    "goal":        (60, 200, 120),
    "powerup":     (200, 60, 200),
    "decor":       (120, 180, 90),
    "projectile":  (255, 140, 0),
}


# ── Loading ───────────────────────────────────────────────────────────

def _load_manifest() -> dict:
    if not MANIFEST.exists():
        print(f"[build] manifest missing: {MANIFEST}\n"
              f"[build] run `python scripts/ingest_kenney.py` first.",
              file=sys.stderr)
        sys.exit(1)
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def _all_sprites(manifest: dict) -> list[dict]:
    out: list[dict] = []
    for pack in manifest["packs"]:
        for f in pack["files"]:
            if f.get("kind") != "sprite":
                continue
            rec = dict(f)
            rec["pack"] = pack["pack"]
            rec["abs"] = (REPO_ROOT / pack["root"] / f["rel"]).resolve()
            out.append(rec)
    return out


# ── Scoring ───────────────────────────────────────────────────────────

def _name(asset: dict) -> str:
    return f"{asset['pack']}/{asset['rel']}".lower()


def _sprite_denylisted(asset: dict) -> bool:
    n = "/" + _name(asset) + "/"
    return any(p in n for p in DENYLIST_PATTERNS)


def _tilemap_denylisted(asset: dict) -> bool:
    n = _name(asset)
    return any(p in n for p in TILEMAP_DENYLIST)


def _score_sprite(asset: dict, sprite: dict) -> int | None:
    """Return score, or None if the asset is not a valid candidate."""
    if _sprite_denylisted(asset):
        return None
    w, h = asset.get("w", 0), asset.get("h", 0)
    if w == 0 or h == 0 or w > TARGET_MAX_DIM or h > TARGET_MAX_DIM:
        return None

    name = _name(asset)
    id_terms = [t for t in re.split(r"[_\-\s]+", sprite["id"].lower())
                if len(t) > 2]
    keywords = ROLE_KEYWORDS.get(sprite["role"], [])

    keyword_score = 0
    for kw in id_terms:
        if kw in name:
            keyword_score += 8
    for kw in keywords:
        if kw in name:
            keyword_score += 10

    # Require at least one keyword match. Pack preference alone must never
    # promote an unrelated asset (e.g. "any tiny PNG from pixel-platformer").
    if keyword_score == 0:
        return None

    prefs = ROLE_PACK_PREFERENCE.get(sprite["role"], [])
    pack_score = 0
    if asset["pack"] in prefs:
        pack_score = (len(prefs) - prefs.index(asset["pack"])) * 100

    size_bonus = 4 if (w, h) in TARGET_GOOD_SIZES else (
        2 if abs(w - h) <= max(w, h) * 0.2 else 0
    )
    return keyword_score + pack_score + size_bonus


def _score_tilemap(asset: dict, map_id: str) -> int | None:
    if _tilemap_denylisted(asset):
        return None
    w, h = asset.get("w", 0), asset.get("h", 0)
    lo, hi = TILE_SIZE_RANGE
    if not (lo <= w <= hi and lo <= h <= hi):
        return None
    if abs(w - h) > 4:
        return None

    name = _name(asset)
    strong_hits = sum(1 for kw in TILE_STRONG_KEYWORDS if kw in name)
    if strong_hits == 0:
        return None  # not a tilemap candidate — this is what was missing

    score = 0
    for kw in MAP_KEYWORDS.get(map_id, []):
        if kw in name:
            score += 15
    score += strong_hits * 5
    score += 3  # baseline for being a valid tilemap candidate

    prefs = MAP_PACK_PREFERENCE.get(map_id, [])
    if asset["pack"] in prefs:
        # 30 (not 40) so a strong keyword match beats a weak pack match
        score += (len(prefs) - prefs.index(asset["pack"])) * 30
    return score


def _sprite_candidates(sprite: dict, all_sprites: list[dict]) -> list[dict]:
    scored = []
    for a in all_sprites:
        s = _score_sprite(a, sprite)
        if s is not None:
            scored.append((s, a))
    scored.sort(key=lambda t: (-t[0], _name(t[1])))
    return [a for _, a in scored]


def _tilemap_candidates(map_id: str, all_sprites: list[dict]) -> list[dict]:
    scored = []
    for a in all_sprites:
        s = _score_tilemap(a, map_id)
        if s is not None:
            scored.append((s, a))
    scored.sort(key=lambda t: (-t[0], _name(t[1])))
    return [a for _, a in scored]


# ── Writes ────────────────────────────────────────────────────────────

def _copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(src.read_bytes())


def _make_placeholder(dst: Path, colour: tuple[int, int, int],
                      size: int = 16) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGBA", (size, size), (*colour, 255))
    ImageDraw.Draw(img).rectangle([0, 0, size - 1, size - 1],
                                  outline=(255, 255, 255, 255))
    img.save(dst, "PNG")


def _cleanup_stale_tmp() -> None:
    for stale in REGISTRY.parent.glob(".registry.*.json"):
        try:
            stale.unlink()
            print(f"[build] removed stale tmp: {stale.name}")
        except OSError as exc:
            print(f"[build] warning: cannot remove {stale}: {exc}",
                  file=sys.stderr)


def _atomic_write(path: Path, payload: dict) -> None:
    """Atomic write that works on Windows.

    The previous version discarded the fd returned by mkstemp, which
    left the file open and made os.replace raise WinError 32. Here we
    wrap the fd with os.fdopen so it is closed before the rename.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=".registry.", suffix=".json",
                                    dir=path.parent)
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        # fd is now closed; safe on Windows. Retry to survive transient
        # handles from OneDrive / antivirus.
        for attempt in range(5):
            try:
                os.replace(tmp, path)
                return
            except PermissionError:
                if attempt == 4:
                    raise
                time.sleep(0.2 * (attempt + 1))
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass


# ── Main ──────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true",
                    help="report picks + top alternates without writing")
    ap.add_argument("--inspect", metavar="ROLE_OR_MAP_ID",
                    help="dump top-20 candidates for a role or tilemap id")
    args = ap.parse_args()

    if not REGISTRY.exists():
        print(f"[build] {REGISTRY} not found; run Phase 0 first.",
              file=sys.stderr)
        return 1

    _cleanup_stale_tmp()

    manifest = _load_manifest()
    all_sprites = _all_sprites(manifest)
    print(f"[build] manifest has {len(all_sprites)} sprite PNGs")

    # ── --inspect mode ────────────────────────────────────────────────
    if args.inspect:
        target = args.inspect
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        sprite = next((s for s in registry["sprites"] if s["id"] == target),
                      None)
        if sprite is not None:
            print(f"\n[build] role={sprite['role']}  id={target}")
            for a in _sprite_candidates(sprite, all_sprites)[:20]:
                print(f"  {_score_sprite(a, sprite):4d}  {_name(a)}")
            return 0
        tmap = next((t for t in registry["tilemaps"] if t["id"] == target),
                    None)
        if tmap is not None:
            print(f"\n[build] tilemap  id={target}")
            for a in _tilemap_candidates(target, all_sprites)[:20]:
                print(f"  {_score_tilemap(a, target):4d}  {_name(a)}")
            return 0
        print(f"[build] no sprite or tilemap id {target!r}", file=sys.stderr)
        return 1

    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    prov: dict = {"sprites": {}, "tilemaps": {}}
    used_sources: set[str] = set()

    # ── Sprites ───────────────────────────────────────────────────────
    new_sprites: list[dict] = []
    for s in registry["sprites"]:
        candidates = _sprite_candidates(s, all_sprites)
        # Prefer sources not already used by another sprite id.
        free = [c for c in candidates if _name(c) not in used_sources]
        pick = (free or candidates[:1])
        pick = pick[0] if pick else None

        if args.dry_run:
            print(f"  sprite  {s['id']:18s} <- "
                  f"{_name(pick) if pick else 'PLACEHOLDER'}")
            for alt in candidates[1:4]:
                print(f"          alt: {_name(alt)}")
            new_sprites.append(s)
            prov["sprites"][s["id"]] = {
                "source": _name(pick) if pick else None,
                "kind": "real" if pick else "placeholder",
            }
            continue

        enriched = dict(s)
        enriched["sprite_key"] = f"sprites/{s['role']}/{s['id']}.png"
        dst = ASSETS / enriched["sprite_key"]
        if pick:
            _copy(pick["abs"], dst)
            enriched["collision_box"] = [pick.get("w", 16), pick.get("h", 16)]
            used_sources.add(_name(pick))
            kind = "real"
            src = _name(pick)
        else:
            _make_placeholder(dst, ROLE_COLOURS.get(s["role"], (150, 150, 150)))
            kind = "placeholder"
            src = None
        new_sprites.append(enriched)
        prov["sprites"][s["id"]] = {"source": src, "kind": kind}
        print(f"  sprite  {s['id']:18s} <- {src or 'PLACEHOLDER'}")

    # ── Tilemaps ──────────────────────────────────────────────────────
    new_tilemaps: list[dict] = []
    for t in registry["tilemaps"]:
        candidates = _tilemap_candidates(t["id"], all_sprites)
        free = [c for c in candidates if _name(c) not in used_sources]
        pick = free[0] if free else (candidates[0] if candidates else None)

        if args.dry_run:
            print(f"  map     {t['id']:18s} <- "
                  f"{_name(pick) if pick else 'PLACEHOLDER'}")
            if pick and ("/terrain/" not in _name(pick)
                         and "terrain_" not in _name(pick)):
                print(f"          WARN: picked from non-terrain path — inspect")
            for alt in candidates[1:4]:
                print(f"          alt: {_name(alt)}")
            new_tilemaps.append(t)
            prov["tilemaps"][t["id"]] = {
                "source": _name(pick) if pick else None,
                "kind": "real" if pick else "placeholder",
            }
            continue

        enriched = dict(t)
        enriched["tileset"] = f"tilemaps/{t['id']}.png"
        dst = ASSETS / enriched["tileset"]
        if pick:
            _copy(pick["abs"], dst)
            enriched["tile_size"] = pick.get("w", 16)
            used_sources.add(_name(pick))
            kind = "real"
            src = _name(pick)
        else:
            _make_placeholder(dst, (100, 140, 100))
            enriched["tile_size"] = 16
            kind = "placeholder"
            src = None
        new_tilemaps.append(enriched)
        prov["tilemaps"][t["id"]] = {"source": src, "kind": kind}
        print(f"  map     {t['id']:18s} <- {src or 'PLACEHOLDER'}")

    real_s = sum(1 for v in prov["sprites"].values() if v["kind"] == "real")
    place_s = sum(1 for v in prov["sprites"].values() if v["kind"] == "placeholder")
    real_t = sum(1 for v in prov["tilemaps"].values() if v["kind"] == "real")
    place_t = sum(1 for v in prov["tilemaps"].values() if v["kind"] == "placeholder")

    if args.dry_run:
        print(f"\n[build] dry-run: "
              f"{real_s}/{place_s} sprites (real/placeholder), "
              f"{real_t}/{place_t} tilemaps")
        return 0

    payload = {
        "_meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source_manifest": str(MANIFEST.relative_to(REPO_ROOT).as_posix()),
            "provenance": prov,
        },
        "sprites": new_sprites,
        "tilemaps": new_tilemaps,
    }
    _atomic_write(REGISTRY, payload)
    print(f"\n[build] wrote {REGISTRY.relative_to(REPO_ROOT)}")
    print(f"[build] {real_s}/{place_s} sprites, {real_t}/{place_t} tilemaps")
    print("[build] verify with: pytest tests/test_core.py -v")
    return 0


if __name__ == "__main__":
    sys.exit(main())