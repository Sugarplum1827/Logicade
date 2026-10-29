"""Bundle the shared Phaser art pack for LogiCade's lazy extraction flow."""

from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK_ROOT = ROOT / "data" / "logicade_phaser_templates" / "logicade_phaser_templates" / "assets" / "logicade_starter_pack"
ARCHIVE = ROOT / "data" / "logicade_phaser_templates" / "phaser_template_assets.zip"

INDEX = b"""<!doctype html>
<html lang=\"en\"><head><meta charset=\"utf-8\"><title>LogiCade Phaser assets</title></head>
<body><main>LogiCade shared Phaser asset package. The host renders gameplay.</main></body></html>
"""


def main() -> None:
    if not (PACK_ROOT / "asset_manifest.json").is_file():
        raise SystemExit(f"Asset manifest not found under {PACK_ROOT}")
    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=8) as bundle:
        bundle.writestr("index.html", INDEX)
        for path in sorted(PACK_ROOT.rglob("*")):
            if not path.is_file():
                continue
            bundle.write(path, Path("assets") / "logicade_starter_pack" / path.relative_to(PACK_ROOT))
    with zipfile.ZipFile(ARCHIVE) as bundle:
        bad = bundle.testzip()
        if bad:
            raise SystemExit(f"Archive verification failed at {bad}")
        print(f"Created {ARCHIVE.relative_to(ROOT)} ({len(bundle.namelist())} files)")


if __name__ == "__main__":
    main()
