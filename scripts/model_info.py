"""Print the Ollama model tag and digest for reproducibility — §2.1, §18.

Run at FastAPI startup (Phase 3) and via `make model-info`.

Exit codes:
  0  model found; tag + digest printed
  1  Ollama unreachable or response unreadable
  2  Ollama reachable but the model is not pulled

All diagnostics go to stderr with explicit flush so that Windows /
subprocess pipes never silently swallow them.
"""

from __future__ import annotations

import json
import os
import sys
import traceback
import urllib.error
import urllib.request


def fetch_tags(host: str) -> list[dict]:
    url = host.rstrip("/") + "/api/tags"
    print(f"[model-info] GET {url}", file=sys.stderr, flush=True)
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=5) as resp:
        body = resp.read().decode("utf-8")
    print(f"[model-info] response bytes: {len(body)}", file=sys.stderr, flush=True)
    return json.loads(body).get("models", [])


def main() -> int:
    host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    model = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")

    print(f"[model-info] host={host} model={model}", file=sys.stderr, flush=True)

    try:
        models = fetch_tags(host)
    except Exception as exc:  # noqa: BLE001 — we want ANY failure surfaced
        print(
            f"[model-info] cannot reach Ollama at {host}: "
            f"{type(exc).__name__}: {exc}",
            file=sys.stderr,
            flush=True,
        )
        traceback.print_exc(file=sys.stderr)
        return 1

    if not models:
        print(
            "[model-info] Ollama is reachable but returned 0 models",
            file=sys.stderr,
            flush=True,
        )
        return 2

    available = [m.get("name") for m in models]
    print(f"[model-info] available models: {available}", file=sys.stderr, flush=True)

    for m in models:
        name = m.get("name") or ""
        if name == model or name.startswith(model):
            print(f"model_tag    = {m['name']}", flush=True)
            print(f"model_digest = {m.get('digest', '')[:12]}", flush=True)
            print(f"model_size   = {m.get('size', 0)}", flush=True)
            return 0

    print(
        f"[model-info] model {model!r} not pulled. "
        f"Run `ollama pull {model}`.",
        file=sys.stderr,
        flush=True,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())