#!/usr/bin/env python3
"""Extract Kenney zips into a clean, named asset library.

Unlike a plain unzip, this sorts every file into a category folder, gives every
asset a unique, readable *name*, and writes a registry that maps name -> file.

Input : vendor/kenney/*.zip                      (override with --src)
Output: vendor/kenney/organized/                 (override with --out)

    sprites/<pack>/<group>/<variant>/<file>.png      individual sprites
    spritesheets/<pack>/<file>.png                   whole atlases / tilesheets
    tiles/<pack>/<sheet>/rRR_cCC.png                 grid-sliced tiles   (--slice; empty tiles skipped,
                                                     UI sheets are not sliced)
    ui/<pack>/...                                    UI 9-slices and pieces
    particles/<pack>/<variant>/...                   particle textures
    vector/<pack>/...                                SVG sources
    audio/<type>/<pack>/<group>/<file>.ogg           sfx | jingles | impact | interface | rpg
    maps/<pack>/*.tmx, *.tsx                         Tiled maps/tilesets (paths rewritten)
    data/<pack>/*.xml, *.txt                         atlas XML, tilesheet info
    docs/<pack>/                                     licenses, previews, samples
    other/<pack>/                                    anything else
    registry.json / registry.csv                     name -> path + metadata

Naming
    file names  : normalised to snake_case  (impactBell_heavy_000.ogg -> impact_bell_heavy_000.ogg)
    asset names : <pack>.<group>.<file>  e.g.  puzzle_pack.element_blue_diamond
                  variants get a suffix: @2x (double/retina), ~black, ~rotated, ~svg

Safe and repeatable
    * identical zips (same SHA-256) are processed once
    * output paths are built from sanitised names, never from raw zip paths
      (no zip-slip), and nothing is written outside --out
    * re-running skips files that are already there (use --force to rewrite)
    * junk is dropped: .sfk, .url, Thumbs.db, .DS_Store, __MACOSX
      engine files (.unitypackage, .swf, .c3p) are skipped unless --keep-engine-files

Usage
    python extract_assets.py
    python extract_assets.py --src /path/to/zips --out /path/to/out
    python extract_assets.py --slice            # also cut tilesheets into named tiles
    python extract_assets.py --only roguelike   # only packs whose key contains this
    python extract_assets.py --dry-run          # show the plan, write nothing
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import posixpath
import re
import struct
import sys
import wave
import zipfile
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from xml.etree import ElementTree as ET

try:
    from PIL import Image
except ImportError:  # dimensions and --slice need Pillow
    Image = None

# Hard-coded Kenney vendor folder on this machine
KENNEY_DIR = Path(r"C:\Users\Shiela\OneDrive\Apps\Documents\thesis_System\Logicade\vendor\kenney")
DEFAULT_SRC = KENNEY_DIR
DEFAULT_OUT = KENNEY_DIR / "organized"

JUNK_NAMES = {"thumbs.db", "desktop.ini", ".ds_store"}
JUNK_EXT = {".sfk", ".url", ".lnk", ".db", ".ini"}
HEAVY_EXT = {".unitypackage", ".swf", ".c3p"}
AUDIO_EXT = {".ogg", ".wav", ".mp3", ".flac"}
IMAGE_EXT = {".png", ".svg", ".jpg", ".jpeg", ".gif"}
MAP_EXT = {".tmx", ".tsx", ".tmj", ".tsj"}
DATA_EXT = {".xml", ".txt", ".json", ".csv"}

SHEET_DIRS = {"spritesheet", "spritesheets", "tilesheet", "tilesheets", "tilemap", "tilemaps"}
GENERIC_IMG_DIRS = {"png", "sprites", "images", "image"}
GENERIC_AUDIO_DIRS = {"ogg", "audio", "sounds", "sound", "wav", "mp3"}
VARIANTS = {
    "default": "1x", "default size": "1x",
    "double": "2x", "retina": "2x",
    "png (transparent)": "transparent", "transparent": "transparent",
    "png (black background)": "black", "black background": "black",
    "rotated": "rotated",
}
SPECIAL_PACKS = {"rpgsounds": "rpg_sounds"}
NO_SLICE_TOKENS = {"ui"}  # UI sheets hold 9-slice pieces; the ui/ folder already has them


# ----------------------------------------------------------------- helpers --
def slug(text: str) -> str:
    t = re.sub(r"^UI(?=[a-z])", "UI_", text)
    t = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", t)
    t = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", t)
    t = re.sub(r"([A-Za-z])(\d)", r"\1_\2", t)
    t = re.sub(r"[^A-Za-z0-9]+", "_", t).strip("_").lower()
    return t or "unnamed"


def display(text: str) -> str:
    return " ".join(w.capitalize() for w in slug(text).split("_"))


def pack_identity(zip_stem: str) -> tuple[str, str]:
    s = re.sub(r"^kenney_", "", zip_stem, flags=re.I)
    s = re.sub(r"_kenney$", "", s, flags=re.I)
    key = SPECIAL_PACKS.get(s.lower()) or slug(s)
    return key, key.replace("_", " ").title()


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def audio_type(pack: str) -> str:
    for k in ("jingle", "impact", "interface", "rpg"):
        if k in pack:
            return "jingles" if k == "jingle" else k
    return "sfx"


def ogg_duration(data: bytes):
    i = data.find(b"\x01vorbis")
    j = data.rfind(b"OggS")
    if i < 0 or j < 0 or len(data) < i + 16:
        return None
    rate = struct.unpack_from("<I", data, i + 12)[0]
    gp = struct.unpack_from("<q", data, j + 6)[0]
    return round(gp / rate, 3) if rate and gp >= 0 else None


def audio_meta(data: bytes, ext: str) -> dict:
    try:
        if ext == ".ogg":
            d = ogg_duration(data)
        elif ext == ".wav":
            with wave.open(io.BytesIO(data)) as w:
                d = round(w.getnframes() / w.getframerate(), 3)
        else:
            d = None
    except Exception:
        d = None
    return {"duration_sec": d} if d is not None else {}


def image_meta(data: bytes, ext: str) -> dict:
    if ext == ".svg":
        head = data[:2048].decode("utf-8", "ignore")
        vb = re.search(r'viewBox="[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"', head)
        if vb:
            return {"w": round(float(vb.group(1))), "h": round(float(vb.group(2)))}
        return {}
    if Image is None:
        return {}
    try:
        with Image.open(io.BytesIO(data)) as im:
            return {"w": im.size[0], "h": im.size[1]}
    except Exception:
        return {}


def xml_meta(data: bytes, ext: str, kind: str) -> dict:
    try:
        root = ET.fromstring(data.lstrip(b"\xef\xbb\xbf"))
    except Exception:
        return {}
    a = root.attrib
    if kind == "map" and root.tag == "map":
        return {"map": {
            "width": a.get("width"), "height": a.get("height"),
            "tile_w": a.get("tilewidth"), "tile_h": a.get("tileheight"),
            "layers": [l.get("name") for l in root.findall("layer")],
            "tilesets": [t.get("source") or t.get("name") for t in root.findall("tileset")],
        }}
    if kind == "map" and root.tag == "tileset":
        img = root.find("image")
        return {"tileset": {
            "name": a.get("name"), "tile_w": a.get("tilewidth"), "tile_h": a.get("tileheight"),
            "tilecount": a.get("tilecount"), "columns": a.get("columns"),
            "spacing": a.get("spacing"), "image": img.get("source") if img is not None else None,
        }}
    if root.tag == "TextureAtlas":
        return {"atlas": {"image": a.get("imagePath"), "regions": len(root.findall("SubTexture"))}}
    return {}


def parse_tile_info(text: str):
    t = re.search(r"tile size[^0-9]*(\d+)\s*(?:px)?\s*[x\u00d7]\s*(\d+)", text, re.I) or \
        re.search(r"tiles are\s*(\d+)\s*[x\u00d7]\s*(\d+)\s*px", text, re.I)
    if not t:
        return None
    sp = re.search(r"(\d+)\s*px\s*margin", text, re.I) or re.search(r"margin:?\s*(\d+)", text, re.I) \
        or re.search(r"space between tiles[^0-9]*(\d+)", text, re.I)
    return int(t.group(1)), int(t.group(2)), int(sp.group(1)) if sp else 0


# -------------------------------------------------------------------- model --
@dataclass
class Item:
    pack: str
    member: str
    category: str
    kind: str
    dest: str
    group: str = ""
    variants: list = field(default_factory=list)
    name: str = ""
    meta: dict = field(default_factory=dict)
    size: int = 0


def split_variants(dirs: list[str], generic: set[str]):
    group, variants = [], []
    for d in dirs:
        dl = d.lower()
        if dl in VARIANTS:
            v = VARIANTS[dl]
            if v not in variants:
                variants.append(v)
        elif dl in generic:
            continue
        else:
            group.append(slug(d))
    return group, variants


def plan_member(pack: str, member: str, keep_heavy: bool):
    parts = [p for p in member.split("/") if p]
    if not parts or member.endswith("/") or parts[0] == "__MACOSX":
        return None
    fname, dirs = parts[-1], parts[:-1]
    if fname.startswith("."):
        return None
    stem, ext = posixpath.splitext(fname)
    ext, sl = ext.lower(), stem.lower()
    if fname.lower() in JUNK_NAMES or ext in JUNK_EXT:
        return None
    if ext in HEAVY_EXT and not keep_heavy:
        return None
    dirs_l = [d.lower() for d in dirs]
    out_name = slug(stem) + ext
    base = slug(stem)

    def done(cat, kind, group, variants, name_suffix=""):
        folder = "/".join([cat, pack] + group + variants)
        gname = "_".join(group)
        name = pack + "." + (gname + "." if gname else "") + base
        if "2x" in variants:
            name += "@2x"
        if "black" in variants:
            name += "~black"
        if "rotated" in variants and "rotated" not in base:
            name += "~rotated"
        name += name_suffix
        it = Item(pack, member, cat, kind, f"{folder}/{out_name}", gname, variants, name)
        return it

    if any(k in sl for k in ("license", "licence", "readme")) and ext in {".txt", ".md", ".pdf"}:
        return done("docs", "doc", [], [], "~doc")
    if ext in {".png", ".jpg", ".jpeg", ".gif"} and any(k in sl for k in ("preview", "sample", "thumbnail")):
        return done("docs", "doc", ["previews"], [], "~preview")
    if ext in MAP_EXT:
        return done("maps", "map", [], [], "~" + ext[1:])
    if ext in AUDIO_EXT:
        group, variants = split_variants(dirs, GENERIC_AUDIO_DIRS)
        return done("audio/" + audio_type(pack), "audio", group, variants)
    if ext in IMAGE_EXT:
        if "vector" in dirs_l or ext == ".svg":
            group, variants = split_variants([d for d in dirs if d.lower() != "vector"], GENERIC_IMG_DIRS)
            return done("vector", "vector", group, variants, "~svg")
        if any(d in SHEET_DIRS for d in dirs_l):
            group, variants = split_variants([d for d in dirs if d.lower() not in SHEET_DIRS], GENERIC_IMG_DIRS)
            return done("spritesheets", "spritesheet", group, variants, "~sheet")
        group, variants = split_variants(dirs, GENERIC_IMG_DIRS)
        if "particle" in pack:
            return done("particles", "particle", group, variants)
        if "ui" in pack.split("_") or "9-slice" in dirs_l:
            return done("ui", "ui", group, variants)
        return done("sprites", "sprite", group, variants)
    if ext in DATA_EXT:
        return done("data", "data", [], [], "~" + ext[1:])
    return done("other", "other", [], [], "~" + ext[1:])


SRC_RE = re.compile(r'(<(?:tileset|image)\b[^>]*?\bsource\s*=\s*")([^"]+)(")', re.I)


def rewrite_refs(text: str, member: str, dest: str, plan_ci: dict, warnings: list) -> str:
    base = posixpath.dirname(member)
    here = posixpath.dirname(dest) or "."

    def sub(m):
        src = m.group(2)
        if re.match(r"^[a-z]+://", src, re.I):
            return m.group(0)
        target = posixpath.normpath(posixpath.join(base, src.replace("\\", "/")))
        it = plan_ci.get(target.lower())
        if it is None:
            warnings.append(f"{member}: reference not found in zip -> {src}")
            return m.group(0)
        return m.group(1) + posixpath.relpath(it.dest, here) + m.group(3)

    return SRC_RE.sub(sub, text)


# -------------------------------------------------------------- processing --
def write_file(path: Path, data: bytes, force: bool) -> str:
    if path.exists() and path.stat().st_size == len(data) and not force:
        return "skipped"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return "written"


def process_pack(zip_path: Path, key: str, pack_name: str, out: Path, args) -> tuple[list[Item], list[str], Counter]:
    stats, warnings = Counter(), []
    with zipfile.ZipFile(zip_path) as zf:
        members = [i.filename for i in zf.infolist() if not i.is_dir()]
        plan: dict[str, Item] = {}
        used_dest: set[str] = set()
        for m in members:
            it = plan_member(key, m, args.keep_engine_files)
            if it is None:
                stats["dropped_junk"] += 1
                continue
            n = 2
            stem, ext = posixpath.splitext(it.dest)
            while it.dest.lower() in used_dest:  # two source files normalise to one name
                it.dest = f"{stem}_{n}{ext}"
                it.name += f"_{n}"
                n += 1
            used_dest.add(it.dest.lower())
            plan[m] = it
        plan_ci = {m.lower(): it for m, it in plan.items()}

        tile_info = None
        for m, it in plan.items():
            if it.category == "data" and m.lower().endswith(".txt"):
                try:
                    tile_info = tile_info or parse_tile_info(zf.read(m).decode("utf-8", "ignore"))
                except Exception:
                    pass

        sheets = []
        for m, it in plan.items():
            data = zf.read(m)
            ext = posixpath.splitext(m)[1].lower()
            if it.kind == "map":
                text = data.decode("utf-8-sig", "ignore")
                data = rewrite_refs(text, m, it.dest, plan_ci, warnings).encode("utf-8")
                it.meta.update(xml_meta(data, ext, "map"))
            elif it.kind == "audio":
                it.meta.update(audio_meta(data, ext))
            elif it.kind in {"sprite", "spritesheet", "ui", "particle", "vector"}:
                it.meta.update(image_meta(data, ext))
            elif it.kind == "data" and ext == ".xml":
                it.meta.update(xml_meta(data, ext, "data"))
            it.size = len(data)
            if not args.dry_run:
                stats[write_file(out / it.dest, data, args.force)] += 1
            if (args.slice and tile_info and it.kind == "spritesheet" and ext == ".png"
                    and not (NO_SLICE_TOKENS & set(key.split("_")))
                    and "transparent" in it.dest.lower() and not re.search(r"packed|magenta", it.dest.lower())):
                sheets.append((it, data))

        extra: list[Item] = []
        for it, data in sheets:
            extra += slice_sheet(it, data, tile_info, out, args, stats, warnings)
    return list(plan.values()) + extra, warnings, stats


def slice_sheet(sheet: Item, data: bytes, info, out: Path, args, stats: Counter, warnings: list) -> list[Item]:
    if Image is None:
        warnings.append("Pillow not installed: cannot slice tilesheets (pip install pillow)")
        return []
    tw, th, sp = info
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    W, H = im.size
    cols, rows = (W + sp) // (tw + sp), (H + sp) // (th + sp)
    if abs(cols * (tw + sp) - sp - W) > 1 or abs(rows * (th + sp) - sp - H) > 1:
        warnings.append(f"{sheet.dest}: {W}x{H} is not an exact {tw}px grid (spacing {sp}); slicing what fits")
    sheet_slug = posixpath.splitext(posixpath.basename(sheet.dest))[0]
    items = []
    for r in range(rows):
        for c in range(cols):
            x, y = c * (tw + sp), r * (th + sp)
            tile = im.crop((x, y, x + tw, y + th))
            if tile.getbbox() is None:
                stats["empty_tiles_skipped"] += 1
                continue
            dest = f"tiles/{sheet.pack}/{sheet_slug}/r{r:02d}_c{c:02d}.png"
            it = Item(sheet.pack, sheet.member, "tiles", "tile", dest, sheet_slug, [],
                      f"{sheet.pack}.{sheet_slug}.r{r:02d}_c{c:02d}")
            it.meta = {"w": tw, "h": th, "sheet": sheet.name, "row": r, "col": c,
                       "index": r * cols + c, "tiled_gid": r * cols + c + 1}
            buf = io.BytesIO()
            tile.save(buf, "PNG")
            it.size = buf.tell()
            if not args.dry_run:
                stats[write_file(out / dest, buf.getvalue(), args.force)] += 1
            stats["tiles_sliced"] += 1
            items.append(it)
    return items


def make_unique_names(items: list[Item]) -> None:
    seen: dict[str, int] = {}
    for it in items:
        n = seen.get(it.name, 0) + 1
        seen[it.name] = n
        if n > 1:
            it.name += f"_{n}"


def registry_row(it: Item, zip_name: str, pack_name: str, license_path: str | None) -> dict:
    shown = display(posixpath.splitext(posixpath.basename(it.dest))[0])
    if it.kind == "tile":
        shown = f"{display(it.group)} R{it.meta['row']:02d} C{it.meta['col']:02d}"
    row = {
        "name": it.name,
        "display_name": shown,
        "category": it.category,
        "kind": it.kind,
        "pack": it.pack,
        "pack_name": pack_name,
        "group": it.group,
        "variant": "+".join(it.variants),
        "path": it.dest,
        "ext": posixpath.splitext(it.dest)[1].lstrip("."),
        "size": it.size,
        "source": f"{zip_name}:{it.member}",
    }
    if it.kind in {"audio", "sprite", "ui", "particle", "vector", "spritesheet"}:
        toks = [t for t in posixpath.splitext(posixpath.basename(it.dest))[0].split("_") if not t.isdigit()]
        row["tags"] = toks
    row.update(it.meta)
    if license_path:
        row["license_file"] = license_path
    return row


# --------------------------------------------------------------------- main --
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", default=str(DEFAULT_SRC), help="folder with the Kenney *.zip files")
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="output folder")
    ap.add_argument("--only", action="append", default=[], help="only packs whose key contains this (repeatable)")
    ap.add_argument("--slice", action="store_true", help="cut transparent tilesheets into named tiles")
    ap.add_argument("--keep-engine-files", action="store_true", help="also extract .unitypackage/.swf/.c3p")
    ap.add_argument("--force", action="store_true", help="rewrite files that already exist")
    ap.add_argument("--dry-run", action="store_true", help="plan and report only; write nothing")
    ap.add_argument("--no-csv", action="store_true", help="skip registry.csv")
    args = ap.parse_args()

    src, out = Path(args.src), Path(args.out)
    if not src.exists():
        print(f"[assets] source folder not found: {src}", file=sys.stderr)
        return 1
    zips = sorted(src.glob("*.zip"), key=lambda p: p.name.lower())
    if not zips:
        print(f"[assets] no *.zip files in {src}", file=sys.stderr)
        return 1

    seen_hash: dict[str, str] = {}
    used_keys: set[str] = set()
    jobs = []
    for z in zips:
        h = sha256_file(z)
        if h in seen_hash:
            print(f"[assets] skip {z.name}: identical to {seen_hash[h]}")
            continue
        seen_hash[h] = z.name
        key, pname = pack_identity(z.stem)
        n = 2
        base_key = key
        while key in used_keys:
            key = f"{base_key}_{n}"
            n += 1
        used_keys.add(key)
        if args.only and not any(o.lower() in key for o in args.only):
            continue
        jobs.append((z, key, pname, h))

    print(f"[assets] {len(jobs)} pack(s) -> {out}{'  (dry run)' if args.dry_run else ''}")
    all_rows, packs, all_warnings, totals = [], [], [], Counter()
    for z, key, pname, h in jobs:
        items, warnings, stats = process_pack(z, key, pname, out, args)
        lic = next((i.dest for i in items if i.category == "docs" and i.dest.endswith(".txt")
                    and "licen" in i.dest), None)
        rows = [registry_row(i, z.name, pname, lic) for i in items]
        all_rows += rows
        by_cat = Counter(i.category for i in items)
        packs.append({"key": key, "name": pname, "zip": z.name, "sha256": h,
                      "assets": len(items), "by_category": dict(by_cat), "license_file": lic})
        totals.update(stats)
        all_warnings += [f"[{key}] {w}" for w in warnings]
        cats = ", ".join(f"{k}:{v}" for k, v in sorted(by_cat.items()))
        print(f"[assets]   {key:24s} {len(items):5d} assets   ({cats})")

    # names must be unique across the whole library
    seen: dict[str, int] = {}
    for r in all_rows:
        seen[r["name"]] = seen.get(r["name"], 0) + 1
        if seen[r["name"]] > 1:
            r["name"] += f"_{seen[r['name']]}"
    all_rows.sort(key=lambda r: (r["category"], r["name"]))

    if not args.dry_run:
        out.mkdir(parents=True, exist_ok=True)
        reg_path = out / "registry.json"
        # keep entries of packs we did not process this run (e.g. when using --only)
        if reg_path.exists():
            try:
                old = json.loads(reg_path.read_text(encoding="utf-8"))
                done = {p["key"] for p in packs}
                packs += [p for p in old.get("packs", []) if p["key"] not in done]
                all_rows += [a for a in old.get("assets", []) if a.get("pack") not in done]
                all_rows.sort(key=lambda r: (r["category"], r["name"]))
            except Exception:
                pass
        reg_path.write_text(json.dumps({
            "generated_by": "extract_assets.py",
            "output": str(out),
            "total_assets": len(all_rows),
            "packs": sorted(packs, key=lambda p: p["key"]),
            "assets": all_rows,
        }, indent=1, ensure_ascii=False), encoding="utf-8")
        if not args.no_csv:
            cols = ["name", "display_name", "category", "kind", "pack", "group", "variant", "path",
                    "ext", "size", "w", "h", "duration_sec", "tags", "source"]
            with (out / "registry.csv").open("w", newline="", encoding="utf-8") as f:
                wr = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
                wr.writeheader()
                for r in all_rows:
                    r = dict(r)
                    r["tags"] = " ".join(r.get("tags", []))
                    wr.writerow(r)
        print(f"[assets] wrote {reg_path.relative_to(out.parent) if out.parent in reg_path.parents else reg_path}")

    cat_totals = Counter(r["category"] for r in all_rows)
    print("[assets] ---- totals ----")
    for c, n in sorted(cat_totals.items()):
        print(f"[assets]   {c:20s} {n}")
    print(f"[assets] {len(all_rows)} assets | " + ", ".join(f"{k}={v}" for k, v in sorted(totals.items())))
    for w in all_warnings:
        print(f"[assets] WARNING {w}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
