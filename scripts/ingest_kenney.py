"""Extract Kenney zips and produce a manifest — Phase 2.

Input:  vendor/kenney/*.zip  (default; override with --src)
Output: vendor/kenney/extracted/<pack>/   (extracted trees, gitignored)
        vendor/kenney/manifest.json       (per-file metadata)

Idempotent: re-run skips a pack that already extracted successfully.
Use --force to re-extract a pack that succeeded but you want to refresh.

Manifest entries carry image dimensions (via Pillow) so the registry
builder can filter by tile size without re-opening every PNG.
"""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path

try:
    from PIL import Image  # noqa: F401
except ImportError:
    Image = None  # manifest still works; dims omitted

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = REPO_ROOT / "vendor" / "kenney"
DEFAULT_OUT = REPO_ROOT / "vendor" / "kenney" / "extracted"
MANIFEST = REPO_ROOT / "vendor" / "kenney" / "manifest.json"

SKIP_FILENAMES = {".ds_store", "thumbs.db", "desktop.ini"}
SKIP_SUFFIXES = {".txt", ".md", ".pdf", ".url", ".lnk", ".ds_store"}
SKIP_NAME_KEYWORDS = ("preview", "thumbnail", "license", "readme", "sample")


def _is_sprite(rel: str) -> bool:
    p = Path(rel)
    if p.suffix.lower() != ".png":
        return False
    name = p.name.lower()
    return not any(k in name for k in SKIP_NAME_KEYWORDS)


def _extract(zip_path: Path, out_root: Path, force: bool) -> Path:
    pack_dir = out_root / zip_path.stem
    marker = pack_dir / ".extracted"
    if marker.exists() and not force:
        return pack_dir
    pack_dir.mkdir(parents=True, exist_ok=True)
    print(f"[ingest] extracting {zip_path.name} -> {pack_dir}")
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(pack_dir)
    marker.write_text("ok\n", encoding="utf-8")
    return pack_dir


def _scan(pack_name: str, pack_dir: Path) -> dict:
    files = []
    for p in sorted(pack_dir.rglob("*")):
        if not p.is_file() or p.name.startswith("."):
            continue
        rel = p.relative_to(pack_dir).as_posix()
        if p.name.lower() in SKIP_FILENAMES:
            continue
        if p.suffix.lower() in SKIP_SUFFIXES:
            continue
        entry: dict = {"rel": rel, "size": p.stat().st_size}
        if _is_sprite(rel):
            entry["kind"] = "sprite"
            if Image is not None:
                try:
                    with Image.open(p) as im:
                        entry["w"], entry["h"] = im.size
                except Exception:
                    pass
        elif p.suffix.lower() in {".wav", ".ogg", ".mp3"}:
            entry["kind"] = "audio"
        elif p.suffix.lower() == ".json":
            entry["kind"] = "data"
        else:
            entry["kind"] = "other"
        files.append(entry)
    return {
        "pack": pack_name,
        "root": str(pack_dir.relative_to(REPO_ROOT).as_posix()),
        "files": files,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", default=str(DEFAULT_SRC))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    src = Path(args.src)
    out = Path(args.out)

    if not src.exists():
        print(f"[ingest] source dir not found: {src}", file=sys.stderr)
        print(
            f"[ingest] create it and drop the 10 Kenney zips inside: "
            f"\n  New-Item -ItemType Directory -Force -Path {src}",
            file=sys.stderr,
        )
        return 1

    zips = sorted(src.glob("*.zip"))
    if not zips:
        print(f"[ingest] no *.zip files found in {src}", file=sys.stderr)
        return 1

    print(f"[ingest] found {len(zips)} zip(s) in {src}")
    out.mkdir(parents=True, exist_ok=True)

    packs: list[dict] = []
    total_sprites = 0
    for z in zips:
        pack_dir = _extract(z, out, args.force)
        info = _scan(z.stem, pack_dir)
        n = sum(1 for f in info["files"] if f.get("kind") == "sprite")
        total_sprites += n
        print(f"[ingest]   {z.stem}: {len(info['files'])} files ({n} sprites)")
        packs.append(info)

    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(
        json.dumps(
            {"source": str(src), "packs": packs},
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"[ingest] wrote {MANIFEST.relative_to(REPO_ROOT)}")
    print(f"[ingest] total: {len(packs)} packs, {total_sprites} sprite PNGs")
    return 0


if __name__ == "__main__":
    sys.exit(main())