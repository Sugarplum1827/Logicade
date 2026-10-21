"""FastAPI app — §16 server/main.py.

Endpoints:
    GET  /health          liveness + model tag/digest
    POST /generate        synchronous one-shot generation
    POST /serve           pop from the pre-gen pool
    POST /warm_pool       bootstrap pools for given weeks
    POST /reset_pools     clear all pools (called on login)
    POST /log             telemetry intake
    GET  /admin-info      pool stats
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .llm_client import LLMClient
from .pool_worker import PoolWorker
from .shuffler import build_brief

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parent.parent


# ── Request models ────────────────────────────────────────────────────
class GenerateRequest(BaseModel):
    student_id: str
    week: int = Field(ge=1, le=9)
    difficulty: str = Field(pattern="^(needs_support|standard|advanced)$")
    recent_levels: list[dict] | None = None
    recent_fingerprints: list[str] | None = None


class ServeRequest(BaseModel):
    student_id: str
    week: int = Field(ge=1, le=9)
    difficulty: str = Field(pattern="^(needs_support|standard|advanced)$")


class LogRequest(BaseModel):
    kind: str
    payload: dict


class WarmPoolRequest(BaseModel):
    student_id: str
    weeks: list[int] = [1, 2, 3]


class ResetPoolsRequest(BaseModel):
    student_id: str | None = None


# ── Lifespan ──────────────────────────────────────────────────────────
_client: LLMClient | None = None
_pool: PoolWorker | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _client, _pool
    _client = LLMClient.from_env()
    reachable = await _client.probe()
    print(
        f"[startup] ollama={_client.host} model={_client.model} "
        f"tag={_client.model_tag} digest={_client.model_digest} "
        f"reachable={reachable}"
    )
    _pool = PoolWorker(_client.generate)
    try:
        yield
    finally:
        await _client.close()


app = FastAPI(title="LogiCade", lifespan=lifespan)


# ── Defensive static mounting ─────────────────────────────────────────
def _mount_if_exists(url_path: str, directory: Path, *, html: bool = False) -> bool:
    if directory.exists() and directory.is_dir():
        app.mount(url_path, StaticFiles(directory=str(directory), html=html),
                  name=url_path.strip("/"))
        print(f"[startup] mounted {url_path!r} -> {directory}")
        return True
    print(f"[startup] skipped mount {url_path!r} — {directory} not found")
    return False


REACT_DIST = REPO_ROOT / "client" / "dist"
_has_react = _mount_if_exists("/app", REACT_DIST, html=True)
_mount_if_exists("/client", REPO_ROOT / "client", html=True)
_mount_if_exists("/data",   REPO_ROOT / "data")
_mount_if_exists("/static", REPO_ROOT / "client" / "js" / "vendor")
_mount_if_exists("/admin",  REPO_ROOT / "admin", html=True)


# ── Helpers (must come BEFORE any route that calls them) ──────────────
def _require_ready() -> tuple[LLMClient, PoolWorker]:
    if _client is None or _pool is None:
        raise HTTPException(status_code=503, detail="server not ready")
    return _client, _pool


# ── Root + config ─────────────────────────────────────────────────────
@app.get("/")
async def root():
    if _has_react:
        return RedirectResponse(url="/app/")
    return RedirectResponse(url="/client/index.html")


@app.get("/api/config")
async def config_js() -> JSONResponse:
    return JSONResponse({
        "supabaseUrl": os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321"),
        "supabaseAnonKey": os.environ.get("SUPABASE_ANON_KEY", ""),
    })


# ── API endpoints ─────────────────────────────────────────────────────
@app.get("/health")
async def health() -> dict:
    client, _ = _require_ready()
    return {
        "ok": True,
        "model_tag": client.model_tag,
        "model_digest": client.model_digest,
    }


@app.post("/generate")
async def generate(req: GenerateRequest) -> dict:
    client, _ = _require_ready()
    recent = req.recent_fingerprints or []
    brief = build_brief(
        week=req.week, difficulty=req.difficulty,
        recent_levels=req.recent_levels,
    )
    spec, meta = await client.generate(brief, req.week, req.difficulty, recent)
    return {"spec": spec, "meta": meta, "brief": brief}


# ⭐ ONLY ONE /serve — with diagnostic logging
@app.post("/serve")
async def serve(req: ServeRequest) -> dict:
    _, pool = _require_ready()
    spec, meta = await pool.serve(req.student_id, req.week, req.difficulty)
    print(
        f"[serve] week={req.week} diff={req.difficulty} "
        f"source={meta.get('verification_result')} "
        f"pool_size={meta.get('pool_size', '?')} "
        f"win={spec.get('win')} rules={len(spec.get('rules', []))}"
    )
    return {"spec": spec, "meta": meta}


@app.post("/warm_pool")
async def warm_pool(req: WarmPoolRequest) -> dict:
    _, pool = _require_ready()
    import asyncio
    for week in req.weeks:
        asyncio.create_task(pool.build_week(req.student_id, week))
    print(f"[warm] Bootstrapping pools for student={req.student_id} weeks={req.weeks}")
    return {"ok": True, "weeks": req.weeks}


@app.post("/reset_pools")
async def reset_pools(req: ResetPoolsRequest | None = None) -> dict:
    _, pool = _require_ready()
    pool.reset_all()
    return {"ok": True, "scope": "all"}


@app.post("/log")
async def log(req: LogRequest) -> dict:
    return {"ok": True, "kind": req.kind, "stored": False,
            "note": "storage wired in Phase 5"}


@app.get("/admin-info")
async def admin_info() -> dict:
    _, pool = _require_ready()
    return {
        "note": "Phase 7 wires this to Realtime + summary tables",
        "pool_stats_sample": next(iter(pool.stats.values()), {}),
    }