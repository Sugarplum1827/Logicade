"""FastAPI app — §16 server/main.py.

Endpoints:
    GET  /health          liveness + model tag/digest
    POST /generate        synchronous one-shot generation (LLM)
    POST /serve           serve a level — manifest first, LLM pool fallback
    POST /warm_pool       bootstrap LLM pools for given weeks
    POST /reset_pools     clear all LLM pools (called on login)
    POST /log             telemetry intake
    GET  /admin-info      pool + manifest stats
"""

from __future__ import annotations

import os
import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Literal
import hmac

from .fallback_loader import load_registry, Registry
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
    level: int = Field(ge=1, le=10)          # ⭐ NEW
    difficulty: str = Field(pattern="^(needs_support|standard|advanced)$")


class LogRequest(BaseModel):
    kind: str
    payload: dict


class WarmPoolRequest(BaseModel):
    student_id: str
    weeks: list[int] = [1, 2, 3]


class ResetPoolsRequest(BaseModel):
    student_id: str | None = None


class SyncBatchRequest(BaseModel):
    table: Literal["students", "levels", "level_attempts", "events"]
    rows: list[dict] = Field(min_length=1, max_length=50)


# ── Module state ──────────────────────────────────────────────────────
_client: LLMClient | None = None
_pool: PoolWorker | None = None
_registry: Registry | None = None
_serve_locks: dict[tuple[int, int, str], asyncio.Lock] = {}
_generated_stacks: dict[tuple[int, int, str], list[dict]] = {}
_served_generated_ids: set[str] = set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _client, _pool, _registry, _generated_stacks, _served_generated_ids

    _client = LLMClient.from_env()
    reachable = await _client.probe()
    print(
        f"[startup] ollama={_client.host} model={_client.model} "
        f"tag={_client.model_tag} digest={_client.model_digest} "
        f"reachable={reachable}"
    )
    _pool = PoolWorker(_client.generate)
    _generated_stacks = {}
    served_state = REPO_ROOT / "data" / "generated_games" / ".served_ids"
    try:
        _served_generated_ids = set(json.loads(served_state.read_text(encoding="utf-8"))) if served_state.exists() else set()
    except (OSError, json.JSONDecodeError, TypeError):
        _served_generated_ids = set()
    generated_root = REPO_ROOT / "data" / "generated_games"
    if generated_root.exists():
        for path in sorted(generated_root.rglob("*.json")):
            if path.name == ".served_ids":
                continue
            try:
                game = json.loads(path.read_text(encoding="utf-8"))
                if str(game.get("file_id") or game.get("game_id") or "") in _served_generated_ids:
                    continue
                key = (int(game["week"]), int(game["level"]), str(game["difficulty"]))
                game["source_path"] = path.relative_to(REPO_ROOT).as_posix()
                _generated_stacks.setdefault(key, []).append(game)
            except (OSError, ValueError, KeyError, json.JSONDecodeError):
                print(f"[startup] skipped invalid generated game file: {path.name}")

    try:
        _registry = load_registry()
        for generated in sorted(
            (game for games in _generated_stacks.values() for game in games),
            key=lambda game: game.get("generated_at", ""),
        ):
            _register_generated_game(generated)
        s = _registry.stats()
        print(
            f"[startup] catalog: {s['total']}/{s['attempted']} loaded, "
            f"{s['missing']} missing, "
            f"{s['invalid']} invalid, "
            f"{s['dups']} dup-keys, "
            f"{s['unique_mechanics']} mechanics"
        )
        if s["missing"]:
            for line in _registry.missing[:10]:
                print(f"[startup]   ⚠️  {line}")
            if s["missing"] > 10:
                print(f"[startup]   … and {s['missing'] - 10} more")
    except Exception as exc:
        print(f"[startup] ⚠️  manifest load failed: {exc}")
        print("[startup] ⚠️  /serve will use template-based generation only")
        _registry = None

    try:
        yield
    finally:
        await _client.close()


app = FastAPI(title="LogiCade", lifespan=lifespan)


# ── Defensive static mounting ─────────────────────────────────────────
def _mount_if_exists(url_path: str, directory: Path, *, html: bool = False) -> bool:
    if directory.exists() and directory.is_dir():
        app.mount(
            url_path,
            StaticFiles(directory=str(directory), html=html),
            name=url_path.strip("/"),
        )
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
_mount_if_exists("/vendor", REPO_ROOT / "vendor")


# ── Helpers ───────────────────────────────────────────────────────────
def _require_client() -> LLMClient:
    if _client is None:
        raise HTTPException(status_code=503, detail="LLM client not ready")
    return _client


def _require_pool() -> PoolWorker:
    if _pool is None:
        raise HTTPException(status_code=503, detail="pool worker not ready")
    return _pool


def _register_generated_game(spec: dict) -> None:
    if _registry is None:
        return
    entry = {
        "week": spec.get("week"),
        "level": spec.get("level"),
        "difficulty": spec.get("difficulty"),
        "file_id": spec.get("file_id") or spec.get("game_id"),
        "unique_identity_key": spec.get("unique_identity_key"),
        "mission_type": spec.get("mission_type"),
        "primary_mechanic": spec.get("primary_mechanic"),
        "theme": spec.get("theme"),
        "region": spec.get("region"),
        "trial": 1,
        "path": spec.get("source_path", ""),
    }
    try:
        _registry.add(entry, spec)
        _registry.attempted += 1
    except (KeyError, TypeError, ValueError) as exc:
        print(f"[catalog] generated game was not indexed: {spec.get('file_id')}: {exc}")


def _mark_generated_served(spec: dict) -> None:
    game_id = str(spec.get("file_id") or spec.get("game_id") or "")
    if not game_id:
        return
    _served_generated_ids.add(game_id)
    state_path = REPO_ROOT / "data" / "generated_games" / ".served_ids"
    temporary_path = state_path.with_suffix(".tmp")
    try:
        state_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path.write_text(json.dumps(sorted(_served_generated_ids)), encoding="utf-8")
        temporary_path.replace(state_path)
    except OSError as exc:
        print(f"[serve] unable to persist LIFO queue state for {game_id}: {exc}")


async def _generate_and_store_game(key: tuple[int, int, str]) -> dict:
    week, level, difficulty = key
    client = _require_client()
    spec, meta = await client.generate_template_game(week, level, difficulty)
    filename = meta["generated_filename"]
    output = REPO_ROOT / "data" / "generated_games" / f"week_{week}" / f"level_{level}" / difficulty / filename
    output.parent.mkdir(parents=True, exist_ok=True)
    spec["source_path"] = output.relative_to(REPO_ROOT).as_posix()
    spec["generated_file"] = True
    spec["model_tag"] = meta.get("model_tag") or "template_fallback"
    spec["verification_result"] = meta.get("verification_result", "template_fallback")
    output.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _generated_stacks.setdefault(key, []).append(spec)
    _register_generated_game(spec)
    print(f"[llm] wrote {spec['source_path']} result={meta['verification_result']} model={meta.get('model_tag')}")
    return spec


# ── Root + config ─────────────────────────────────────────────────────
@app.get("/")
async def root():
    if _has_react:
        return RedirectResponse(url="/app/")
    return RedirectResponse(url="/client/index.html")


@app.get("/api/config")
async def config_js() -> JSONResponse:
    return JSONResponse({
        "apiBaseUrl": "/api",
        "catalogPath": "/api/games",
        "syncPath": "/api/sync/batch",
    })


@app.get("/api/games")
async def list_games(
    week: int | None = Query(default=None, ge=1, le=9),
    level: int | None = Query(default=None, ge=1, le=10),
    difficulty: str | None = None,
    mechanic: str | None = None,
    mission_type: str | None = None,
    search: str | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> dict:
    registry = _registry
    if registry is None:
        raise HTTPException(status_code=503, detail="Game catalogue is unavailable")
    try:
        rows = registry.list_games(
            week=week, level=level, difficulty=difficulty, mechanic=mechanic,
            mission_type=mission_type, search=search,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"total": len(rows), "offset": offset, "limit": limit, "items": rows[offset:offset + limit]}


@app.get("/api/games/mechanics")
async def list_mechanics() -> dict:
    if _registry is None:
        raise HTTPException(status_code=503, detail="Game catalogue is unavailable")
    return {"items": _registry.mechanics()}


@app.get("/api/games/{game_id}")
async def get_game(game_id: str) -> dict:
    if _registry is None:
        raise HTTPException(status_code=503, detail="Game catalogue is unavailable")
    game = _registry.get_by_id(game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return {"game": game}


@app.post("/api/sync/batch")
async def sync_batch(req: SyncBatchRequest) -> dict:
    """Write offline-first client batches using the server-only service key."""
    base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not service_key:
        raise HTTPException(status_code=503, detail="Server-side database sync is not configured")

    allowed = {
        "students": {"student_id", "created_at"},
        "levels": {
            "level_id", "student_id", "week", "level_index", "difficulty_assigned",
            "difficulty_served", "game_type", "game_id", "game_title", "primary_mechanic",
            "learning_topic", "region_id", "region_name", "map_id", "sprite_ids",
            "fingerprint", "verification_result", "pool_status", "generated_at",
        },
        "level_attempts": {
            "attempt_id", "level_id", "student_id", "attempt_number", "is_replay",
            "score", "accuracy", "in_activity_attempts", "error_count",
            "completion_time_sec", "hint_count", "activity_retries", "completed",
            "started_at", "ended_at",
        },
        "events": {
            "event_id", "level_id", "attempt_id", "student_id", "event_type",
            "t_ms_since_start", "entity_id", "rule_id", "payload", "created_at",
        },
    }
    for row in req.rows:
        if not isinstance(row, dict) or set(row) - allowed[req.table]:
            raise HTTPException(status_code=422, detail=f"Invalid columns in {req.table} batch")

    conflict = {"students": "student_id", "levels": "level_id", "level_attempts": "attempt_id", "events": "event_id"}[req.table]
    url = f"{base_url}/rest/v1/{req.table}?on_conflict={conflict}"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    import httpx
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            # Child rows may be retried after their original student row was
            # lost, delayed, or marked dead in the offline queue. Reconcile
            # their parent first so valid level/attempt/event batches cannot
            # remain permanently blocked by a missing student FK.
            if req.table != "students":
                student_ids = sorted({
                    str(row["student_id"])
                    for row in req.rows
                    if row.get("student_id")
                })
                if student_ids:
                    parent_rows = [{"student_id": student_id} for student_id in student_ids]
                    parent_response = await client.post(
                        f"{base_url}/rest/v1/students?on_conflict=student_id",
                        headers=headers,
                        json=parent_rows,
                    )
                    if not parent_response.is_success:
                        detail = parent_response.text.replace("\n", " ")[:320]
                        print(f"[sync] could not reconcile students status={parent_response.status_code}: {detail}")
                        raise HTTPException(status_code=502, detail=f"Database rejected students batch ({parent_response.status_code}): {detail}")
            response = await client.post(url, headers=headers, json=req.rows)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Database sync request failed") from exc
    if not response.is_success:
        detail = response.text.replace("\n", " ")[:320]
        print(f"[sync] PostgREST rejected table={req.table} status={response.status_code}: {detail}")
        raise HTTPException(status_code=502, detail=f"Database rejected {req.table} batch ({response.status_code}): {detail}")
    return {"ok": True, "table": req.table, "stored": len(req.rows)}


@app.get("/api/admin/analytics")
async def admin_analytics(x_admin_key: str | None = Header(default=None)) -> dict:
    expected = os.environ.get("LOGICADE_ADMIN_KEY", "")
    if not expected or not x_admin_key or not hmac.compare_digest(expected, x_admin_key):
        raise HTTPException(status_code=401, detail="Admin key is missing or invalid")
    base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not service_key:
        raise HTTPException(status_code=503, detail="Server-side database access is not configured")
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    import httpx
    resources = {
        "overview": "v_admin_overview",
        "weekly": "v_admin_weekly",
        "mechanics": "v_admin_mechanics",
        "activity": "v_admin_activity",
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            responses = await __import__("asyncio").gather(*[
                client.get(f"{base_url}/rest/v1/{view}?select=*", headers=headers)
                for view in resources.values()
            ])
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Database analytics request failed") from exc
    result = {}
    for name, response in zip(resources, responses):
        if not response.is_success:
            if response.status_code == 404:
                raise HTTPException(status_code=503, detail=f"Analytics view {resources[name]} is missing. Apply the pending Supabase migrations, including 007_dynamic_catalog_analytics.sql.")
            detail = response.text.replace("\n", " ")[:240]
            raise HTTPException(status_code=502, detail=f"Analytics view {resources[name]} failed ({response.status_code}): {detail}")
        result[name] = response.json()
    return result


# ── API endpoints ─────────────────────────────────────────────────────
@app.get("/health")
async def health() -> dict:
    client = _require_client()
    return {
        "ok": True,
        "model_tag": client.model_tag,
        "model_digest": client.model_digest,
        "manifest_loaded": _registry is not None,
        "manifest_size": len(_registry.by_identity) if _registry else 0,
    }


@app.post("/generate")
async def generate(req: GenerateRequest) -> dict:
    client = _require_client()
    recent = req.recent_fingerprints or []
    brief = build_brief(
        week=req.week,
        difficulty=req.difficulty,
        recent_levels=req.recent_levels,
    )
    spec, meta = await client.generate(brief, req.week, req.difficulty, recent)
    return {"spec": spec, "meta": meta, "brief": brief}


@app.post("/serve")
async def serve(req: ServeRequest) -> dict:
    key = (req.week, req.level, req.difficulty)
    lock = _serve_locks.setdefault(key, asyncio.Lock())
    async with lock:
        # Generate on demand so the actual level opened by the player is the
        # newly written template-based JSON, even while the 2,700-game base
        # catalogue still has entries. Then pop newest-first (LIFO).
        try:
            await _generate_and_store_game(key)
        except Exception as exc:
            print(f"[llm] generation failed for {key}: {exc}")
            raise HTTPException(status_code=503, detail=f"Could not generate a game from the week {req.week} template") from exc
        newest = _generated_stacks[key].pop()
        _mark_generated_served(newest)
        print(f"[serve] LIFO generated {newest.get('source_path')} student={req.student_id}")
        return {"spec": newest, "meta": {"verification_result": newest.get("verification_result", "generated_lifo"), "source_path": newest.get("source_path"), "model_tag": newest.get("model_tag"), "lifo": True}}


@app.post("/warm_pool")
async def warm_pool(req: WarmPoolRequest) -> dict:
    pool = _require_pool()
    import asyncio
    for week in req.weeks:
        asyncio.create_task(pool.build_week(req.student_id, week))
    print(
        f"[warm] Bootstrapping LLM pools "
        f"student={req.student_id} weeks={req.weeks}"
    )
    return {"ok": True, "weeks": req.weeks}


@app.post("/reset_pools")
async def reset_pools(req: ResetPoolsRequest | None = None) -> dict:
    pool = _require_pool()
    pool.reset_all()
    return {"ok": True, "scope": "all"}


@app.post("/log")
async def log(req: LogRequest) -> dict:
    return {
        "ok": True,
        "kind": req.kind,
        "stored": False,
        "note": "storage wired in Phase 5",
    }


@app.get("/admin-info")
async def admin_info() -> dict:
    manifest_stats = _registry.stats() if _registry else {"loaded": False}
    pool_stats = (
        next(iter(_pool.stats.values()), {}) if _pool and _pool.stats else {}
    )
    return {
        "manifest": manifest_stats,
        "pool_stats_sample": pool_stats,
    }
