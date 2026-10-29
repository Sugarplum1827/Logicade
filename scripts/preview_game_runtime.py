"""Preview a real packaged game in its sandbox without study/database writes.

Run from the project root: python -m scripts.preview_game_runtime --port 8123
Only copied source metadata and temporary ZIP/extraction files are modified.
"""

from __future__ import annotations

import argparse
import json
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

from server.game_packages import prepare_package
from server.generated_games import description_for_level, discover_games
from server.opencode_packages import compile_generated_package
from server.canvas_games import compile_canvas_package, describe_canvas_game, discover_canvas_games


def create_preview(workspace: Path, temporary: Path, slug: str, variation: int, *, native: bool = False, week: int = 1) -> FastAPI:
    runtime = workspace / ("game-platform" if native else "data/opencode_generated/dist")
    concepts = discover_canvas_games(runtime) if native else discover_games(runtime)
    game = next((game for game in concepts.get(slug, []) if game.index == variation), None)
    if game is None:
        raise ValueError(f"No shipped variation {variation} exists for {slug}")
    original = workspace / f"data/fallback_pool/week_{week}/level1/standard/game_week{week}_level1_difficulty(Standard)_1.json"
    pool = temporary / "pool"
    source = pool / original.name
    pool.mkdir()
    shutil.copyfile(original, source)
    spec = json.loads(source.read_text(encoding="utf-8"))
    description = describe_canvas_game(game, spec) if native else description_for_level(game, spec)
    if native:
        compile_canvas_package(source_json=source, pool_root=pool, runtime_root=runtime,
            game=game, spec=spec, backup_root=temporary / "backups")
    else:
        compile_generated_package(source_json=source, pool_root=pool, runtime_root=runtime,
            game=game, description=description, spec=spec, backup_root=temporary / "backups")
    cache = temporary / "cache"
    package = prepare_package(source, pool, cache, shared_web_runtime_root=runtime if not native else None,
        shared_canvas_runtime_root=runtime if native else None,
        expected_generated_game_id=game.variation_id)
    if package is None:
        raise ValueError("No runnable package was created")
    app = FastAPI(title="LogiCade isolated game preview")
    if native:
        app.mount("/canvas-runtime", CORSMiddleware(StaticFiles(directory=runtime, html=True), allow_origins=["*"]))
        app.mount("/vendor/kenney", CORSMiddleware(StaticFiles(directory=workspace / "vendor/kenney"), allow_origins=["*"]))
    else:
        for name in ("engine", "public", "vendor"):
            app.mount(f"/game-runtime/{name}", CORSMiddleware(StaticFiles(directory=runtime / name),
                allow_origins=["*"], allow_methods=["GET", "HEAD"]))
    app.mount("/game-builds", CORSMiddleware(StaticFiles(directory=cache, html=True),
        allow_origins=["*"], allow_methods=["GET", "HEAD"]))
    initialize = json.dumps({"channel": "logicade-host", "version": 1, "type": "initialize",
        "week": week, "level": 1, "difficulty": "standard", "game_id": game.game_id,
        "description": description}, ensure_ascii=False).replace("</", "<\\/")
    html = """<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>LogiCade isolated preview</title>
<style>body{margin:0;background:#07101c;color:#eff;font:14px system-ui}header{height:44px;display:flex;align-items:center;gap:12px;padding:0 12px}button{padding:5px 12px}iframe{border:0;width:100%;height:calc(100dvh - 110px);display:block}pre{height:52px;overflow:auto;margin:4px 12px;white-space:pre-wrap;font-size:11px}</style>
<header><strong>Isolated game preview</strong><button id="pause">Pause</button><button id="resume">Resume</button><button id="hint">Oracle hint</button><span id="state">Loading</span></header>
<iframe id="game" title="Packaged LogiCade game" sandbox="allow-scripts allow-pointer-lock" src="__URL__"></iframe><pre id="events" aria-live="polite"></pre>
<script>const frame=document.getElementById('game'),log=document.getElementById('events'),state=document.getElementById('state');
const initialize=__INITIALIZE__;window.__previewEvents=[];
const send=(type,extra={})=>frame.contentWindow.postMessage({channel:'logicade-host',version:1,type,...extra},'*');
frame.addEventListener('load',()=>{frame.contentWindow.postMessage(initialize,'*');state.textContent='Package loaded';});
for(const type of ['pause','resume'])document.getElementById(type).onclick=()=>send(type);
document.getElementById('hint').onclick=()=>send('hint',{hint:initialize.description.hint});
window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.data?.channel!=='logicade-game')return;window.__previewEvents.push(event.data);state.textContent=event.data.type;log.textContent=window.__previewEvents.slice(-3).map(value=>JSON.stringify(value)).join(String.fromCharCode(10));});
</script></html>""".replace("__URL__", package["launch_url"]).replace("__INITIALIZE__", initialize)

    @app.get("/", response_class=HTMLResponse)
    async def index():
        return html

    return app


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8123)
    parser.add_argument("--slug", default=None)
    parser.add_argument("--variation", type=int, default=1)
    parser.add_argument("--week", type=int, choices=range(1, 10), default=1)
    parser.add_argument("--runtime", choices=("canvas", "generated"), default="canvas")
    args = parser.parse_args()
    import uvicorn
    workspace = Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory(prefix="logicade-runtime-preview-") as directory:
        app = create_preview(workspace, Path(directory), args.slug or ("platformer" if args.runtime == "canvas" else "platformer_quest"), args.variation, native=args.runtime == "canvas", week=args.week)
        uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
