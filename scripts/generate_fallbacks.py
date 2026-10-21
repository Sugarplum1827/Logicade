"""Generate the 24 fallback templates (§8, §16).

Thin wrapper over server.fallbacks.build_fallback — every file written
here matches what llm_client._load_fallback synthesizes at runtime.
Each spec is verified with verifier.verify() before the file is
written. Any failure aborts the whole run.

Run: python scripts/generate_fallbacks.py [--check]
  --check   verify existing files match what would be generated; exit 1 on drift
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from server.fallbacks import DIFFICULTIES, build_fallback  # noqa: E402
from server.verifier import verify  # noqa: E402

OUT = REPO_ROOT / "data" / "fallback_templates"


def main() -> int:
    print(f"[generate] start, out={OUT}", flush=True)

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true",
                    help="verify existing files, exit 1 on drift")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)

    failures: list[str] = []
    drifts: list[str] = []
    wrote = 0
    seen_fps: dict[str, list[str]] = {}

    for week in range(1, 9):
        for difficulty in DIFFICULTIES:
            spec = build_fallback(week, difficulty)
            result = verify(spec, week, difficulty, [])
            if not result["pass"]:
                failures.append(
                    f"week {week} {difficulty}: {result['errors']}"
                )
                continue

            fp = spec["fingerprint"]
            seen_fps.setdefault(fp, []).append(f"w{week}_{difficulty}")

            path = OUT / f"week{week}_{difficulty}.json"
            text = json.dumps(spec, indent=2, ensure_ascii=False) + "\n"

            if args.check:
                if not path.exists():
                    drifts.append(f"missing {path.name}")
                elif path.read_text(encoding="utf-8") != text:
                    drifts.append(f"drift {path.name}")
                continue

            path.write_text(text, encoding="utf-8")
            wrote += 1
            print(f"  wrote {path.name}  fp={fp}  win={spec['win']!r}",
                  flush=True)

    if failures:
        print("\nFAILED verification:", file=sys.stderr)
        for f in failures:
            print(f"  {f}", file=sys.stderr)
        return 1

    if args.check:
        if drifts:
            print("DRIFT detected:", file=sys.stderr)
            for d in drifts:
                print(f"  {d}", file=sys.stderr)
            return 1
        print("[check] 24 files match; no drift.", flush=True)
        return 0

    print(f"\n[generate] wrote {wrote} files to "
          f"{OUT.relative_to(REPO_ROOT)}", flush=True)
    print(f"[generate] {len(seen_fps)} distinct fingerprints across 24 files",
          flush=True)
    shared = {fp: files for fp, files in seen_fps.items() if len(files) > 1}
    if shared:
        print(f"[generate] {len(shared)} fingerprints shared across files:",
              flush=True)
        for fp, files in shared.items():
            print(f"  {fp}: {', '.join(files)}", flush=True)
    return 0


if __name__ == "__main__":
    print(f"[generate] __main__ entry", flush=True)
    sys.exit(main())