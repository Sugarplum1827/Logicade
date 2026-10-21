"""Extract Kenney interface sounds into client/assets/audio/ and build a manifest."""
import json
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
# Look inside the extracted folder for ANY audio files
SRC_DIR = REPO_ROOT / "vendor" / "kenney" / "extracted"
DST = REPO_ROOT / "client" / "assets" / "audio"

def main():
    if not SRC_DIR.exists():
        print(f"[audio] source not found: {SRC_DIR}")
        print("[audio] run `python scripts/ingest_kenney.py` first")
        return 1

    DST.mkdir(parents=True, exist_ok=True)

    copied = []
    # Search recursively for any .ogg, .wav, or .mp3 files
    for f in sorted(SRC_DIR.rglob("*")):
        if f.suffix.lower() not in {".wav", ".ogg", ".mp3"}:
            continue
        
        # We only want the interface sounds. Skip other packs if they exist.
        if "interface" not in str(f).lower() and "audio" not in str(f).lower() and "jingle" not in str(f).lower():
            continue
            
        dst = DST / f.name
        if dst.exists():
            continue
        shutil.copy2(f, dst)
        copied.append(f.name)
        print(f"[audio] copied {f.name}")

    # Manifest of everything that exists
    manifest = sorted([f.name for f in DST.iterdir() if f.suffix.lower() in {".wav", ".ogg", ".mp3"}])
    (DST / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"\n[audio] total: {len(manifest)} files in {DST.relative_to(REPO_ROOT)}")
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())