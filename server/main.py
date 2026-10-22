"""FastAPI app — §16 server/main.py.

Endpoints:
    GET  /health          liveness + model tag/digest
    POST /serve           preview an existing manifest game without LLM generation
    POST /api/games/regenerate  explicit replay generation, saved to source JSON
    POST /warm_pool       bootstrap LLM pools for given weeks
    POST /reset_pools     clear all LLM pools (called on login)
    POST /log             telemetry intake
    GET  /admin-info      pool + manifest stats
"""

from __future__ import annotations

import os
import asyncio
import json
import random
import tempfile
import csv
import io
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import JSONResponse, RedirectResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Literal
import hmac

from .fallback_loader import load_registry, Registry, validate_game_definition
from .llm_client import LLMClient
from .pool_worker import PoolWorker

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parent.parent


# ── Request models ────────────────────────────────────────────────────
class ServeRequest(BaseModel):
    student_id: str
    week: int = Field(ge=1, le=9)
    level: int = Field(ge=1, le=10)          # ⭐ NEW
    difficulty: str = Field(pattern="^(needs_support|standard|advanced)$")


class MarkUsedRequest(BaseModel):
    file_id: str = Field(min_length=1, max_length=160, pattern="^[A-Za-z0-9_.-]+$")


class RegenerateGameRequest(BaseModel):
    file_id: str = Field(min_length=1, max_length=160, pattern="^[A-Za-z0-9_.-]+$")
    request_id: str = Field(min_length=16, max_length=80, pattern="^[A-Za-z0-9_.:-]+$")


class LogRequest(BaseModel):
    kind: str
    payload: dict


class WarmPoolRequest(BaseModel):
    student_id: str
    weeks: list[int] = [1, 2, 3]


class ResetPoolsRequest(BaseModel):
    student_id: str | None = None


class SyncBatchRequest(BaseModel):
    table: Literal["students", "levels", "level_attempts", "events", "coin_transactions"]
    rows: list[dict] = Field(min_length=1, max_length=50)


# ── Module state ──────────────────────────────────────────────────────
_client: LLMClient | None = None
_pool: PoolWorker | None = None
_registry: Registry | None = None
_serve_locks: dict[tuple[int, int, str], asyncio.Lock] = {}
_regenerate_locks: dict[str, asyncio.Lock] = {}
_regeneration_results: OrderedDict[str, dict] = OrderedDict()
_regeneration_request_files: dict[str, str] = {}
_generation_retry_tasks: dict[str, asyncio.Task] = {}
_selection_queues: dict[tuple[int, int, str], list[str]] = {}
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
        print("[startup] ⚠️  game catalogue unavailable; /serve cannot select a fallback game")
        _registry = None

    try:
        yield
    finally:
        retry_tasks = list(_generation_retry_tasks.values())
        for task in retry_tasks:
            task.cancel()
        if retry_tasks:
            await asyncio.gather(*retry_tasks, return_exceptions=True)
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
        "source_path": spec.get("source_path", ""),
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


def _source_path_for_game(game: dict) -> Path:
    """Resolve a catalogue game's recorded source without trusting a client path."""
    raw_path = str(game.get("source_path") or "")
    root = (REPO_ROOT / "data" / "fallback_pool").resolve()
    candidate = (REPO_ROOT / raw_path).resolve()
    if not candidate.is_relative_to(root) or candidate.suffix.lower() != ".json" or not candidate.is_file():
        raise HTTPException(status_code=409, detail="The selected game has no valid fallback-pool source file")
    return candidate


def _write_json_atomically(path: Path, value: dict) -> None:
    """Validate serialization, then replace one source file atomically on its volume."""
    serialized = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    # Round-trip before touching the existing file so malformed output cannot truncate it.
    if not isinstance(json.loads(serialized), dict):
        raise ValueError("Generated game JSON must be an object")
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="\n", dir=path.parent, suffix=".tmp", delete=False) as temp:
            temp_name = temp.name
            temp.write(serialized)
            temp.flush()
            os.fsync(temp.fileno())
        os.replace(temp_name, path)
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)


def _cache_regeneration_result(request_id: str, result: dict) -> dict:
    """Make retried explicit UI actions idempotent within this server process."""
    cached = json.loads(json.dumps(result, ensure_ascii=False))
    _regeneration_results[request_id] = cached
    _regeneration_results.move_to_end(request_id)
    while len(_regeneration_results) > 512:
        expired_id, _ = _regeneration_results.popitem(last=False)
        _regeneration_request_files.pop(expired_id, None)
    return cached


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
            "started_at", "ended_at", "status", "restart_count",
            "question_retry_count", "origin",
        },
        "events": {
            "event_id", "level_id", "attempt_id", "student_id", "event_type",
            "t_ms_since_start", "entity_id", "rule_id", "payload", "created_at",
        },
        "coin_transactions": {
            "transaction_id", "student_id", "amount", "reason", "source",
            "level_id", "attempt_id", "event_id", "actor_id", "created_at",
        },
    }
    for row in req.rows:
        if not isinstance(row, dict) or set(row) - allowed[req.table]:
            raise HTTPException(status_code=422, detail=f"Invalid columns in {req.table} batch")

    conflict = {"students": "student_id", "levels": "level_id", "level_attempts": "attempt_id",
                "events": "event_id", "coin_transactions": "transaction_id"}[req.table]
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
            # PostgREST requires every row in one bulk insert to have the same
            # object keys. Older clients and newly added optional columns can
            # otherwise mix row shapes and cause PGRST102 for the whole batch.
            grouped_rows: dict[tuple[str, ...], list[dict]] = {}
            for row in req.rows:
                grouped_rows.setdefault(tuple(sorted(row)), []).append(row)
            for group in grouped_rows.values():
                response = await client.post(url, headers=headers, json=group)
                if not response.is_success:
                    detail = response.text.replace("\n", " ")[:320]
                    print(f"[sync] PostgREST rejected table={req.table} status={response.status_code}: {detail}")
                    raise HTTPException(status_code=502, detail=f"Database rejected {req.table} batch ({response.status_code}): {detail}")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Database sync request failed") from exc
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


def _require_admin_auth(x_admin_key: str | None) -> None:
    expected = os.environ.get("LOGICADE_ADMIN_KEY", "")
    if not expected or not x_admin_key or not hmac.compare_digest(expected, x_admin_key):
        raise HTTPException(status_code=401, detail="Admin key is missing or invalid")


def _check_admin_key(x_admin_key: str | None) -> tuple[str, str]:
    _require_admin_auth(x_admin_key)
    base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not service_key:
        raise HTTPException(status_code=503, detail="Server-side database access is not configured")
    return base_url, service_key


async def _admin_rows(
    base_url: str, service_key: str, resource: str,
    *, params: dict | None = None, limit: int = 500, offset: int = 0,
) -> tuple[list[dict], int | None]:
    """Read only through the server-held service key; never expose it to the browser."""
    import httpx
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Accept": "application/json",
        "Range": f"{offset}-{offset + limit - 1}",
        "Prefer": "count=exact",
    }
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.get(
                f"{base_url}/rest/v1/{resource}",
                headers=headers,
                params={"select": "*", **(params or {})},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Database request for {resource} failed") from exc
    if response.status_code == 404:
        raise HTTPException(status_code=503, detail=f"Database resource {resource} is missing; apply the Supabase migrations first")
    if not response.is_success:
        detail = response.text.replace("\n", " ")[:240]
        raise HTTPException(status_code=502, detail=f"Database resource {resource} failed ({response.status_code}): {detail}")
    count = None
    content_range = response.headers.get("content-range", "")
    if "/" in content_range:
        try:
            count = int(content_range.rsplit("/", 1)[1])
        except ValueError:
            pass
    rows = response.json()
    return (rows if isinstance(rows, list) else []), count


@app.get("/api/admin/participants")
async def admin_participants(
    x_admin_key: str | None = Header(default=None),
    search: str | None = None, week: int | None = Query(default=None, ge=1, le=9),
    stratum: str | None = None,
    offset: int = Query(default=0, ge=0), limit: int = Query(default=50, ge=1, le=200),
) -> dict:
    base, key = _check_admin_key(x_admin_key)
    params: dict = {"order": "created_at.desc"}
    if search:
        safe = "".join(ch for ch in search if ch.isalnum() or ch in "_. @-")[:80]
        params["student_id"] = f"ilike.*{safe}*"
    if week is not None:
        params["current_week"] = f"eq.{week}"
    if stratum in {"Knowledgeable", "Moderate", "Minimal"}:
        params["stratum"] = f"eq.{stratum}"
    rows, total = await _admin_rows(base, key, "v_admin_participants", params=params, limit=limit, offset=offset)
    return {"items": rows, "total": total if total is not None else len(rows), "offset": offset, "limit": limit}


@app.get("/api/admin/participants/{participant_id}")
async def admin_participant_detail(
    participant_id: str, x_admin_key: str | None = Header(default=None),
) -> dict:
    base, key = _check_admin_key(x_admin_key)
    import httpx
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"}
    resources = {
        "participant": ("v_admin_participants", {"student_id": f"eq.{participant_id}"}),
        "levels": ("levels", {"student_id": f"eq.{participant_id}", "order": "generated_at.desc"}),
        "attempts": ("level_attempts", {"student_id": f"eq.{participant_id}", "order": "started_at.desc"}),
        "events": ("events", {"student_id": f"eq.{participant_id}", "order": "created_at.desc"}),
        "coins": ("v_admin_coin_summary", {"student_id": f"eq.{participant_id}"}),
        "decisions": ("difficulty_decisions", {"student_id": f"eq.{participant_id}", "order": "decided_at.desc"}),
        "assessments": ("assessments", {"student_id": f"eq.{participant_id}", "order": "completed_at.desc"}),
    }
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            responses = await asyncio.gather(*[
                client.get(f"{base}/rest/v1/{resource}", headers=headers,
                           params={"select": "*", "limit": "200", **filters})
                for resource, filters in resources.values()
            ])
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Participant detail query failed") from exc
    data = {}
    for name, response in zip(resources, responses):
        if response.status_code == 404 and name in {"coins", "decisions", "assessments"}:
            data[name] = []
            continue
        if not response.is_success:
            detail = response.text.replace("\n", " ")[:240]
            raise HTTPException(status_code=502, detail=f"Participant {name} query failed ({response.status_code}): {detail}")
        values = response.json()
        data[name] = values[0] if name == "participant" and values else (values or [])
    if not data["participant"]:
        raise HTTPException(status_code=404, detail="Participant not found")
    return data


@app.get("/api/admin/events")
async def admin_events(
    x_admin_key: str | None = Header(default=None), student_id: str | None = None,
    event_type: str | None = None, offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict:
    base, key = _check_admin_key(x_admin_key)
    params: dict = {"order": "created_at.desc"}
    if student_id:
        params["student_id"] = f"eq.{student_id}"
    if event_type:
        safe_type = "".join(ch for ch in event_type if ch.isalnum() or ch in "_.:-")[:80]
        params["event_type"] = f"eq.{safe_type}"
    rows, total = await _admin_rows(base, key, "events", params=params, limit=limit, offset=offset)
    return {"items": rows, "total": total if total is not None else len(rows), "offset": offset, "limit": limit}


@app.get("/api/admin/content")
async def admin_content(
    x_admin_key: str | None = Header(default=None), week: int | None = None,
    level: int | None = None, difficulty: str | None = None, search: str | None = None,
    offset: int = Query(default=0, ge=0), limit: int = Query(default=100, ge=1, le=300),
) -> dict:
    _require_admin_auth(x_admin_key)
    if _registry is None:
        raise HTTPException(status_code=503, detail="Game catalogue is unavailable")
    try:
        rows = _registry.list_games(week=week, level=level, difficulty=difficulty, search=search)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"items": rows[offset:offset + limit], "total": len(rows), "offset": offset, "limit": limit,
            "manifest": _registry.stats()}


@app.get("/api/admin/operations")
async def admin_operations(x_admin_key: str | None = Header(default=None)) -> dict:
    _require_admin_auth(x_admin_key)
    client = _client
    model_reachable = await client.probe() if client else False
    registry_stats = _registry.stats() if _registry else {"loaded": False}
    pool_stats: dict = {"pools": len(_pool._pools) if _pool else 0, "queue_items": 0,
                        "served": 0, "llm_generated": 0, "fallback_served": 0}
    if _pool:
        for pool in _pool._pools.values():
            pool_stats["queue_items"] += len(pool._queue)
            pool_stats["served"] += pool._served_count
            pool_stats["llm_generated"] += pool._llm_served
            pool_stats["fallback_served"] += pool._fallback_served
    return {
        "llm": {"host": client.host if client else None, "model": client.model if client else None,
                "tag": client.model_tag if client else None, "digest": client.model_digest if client else None,
                "reachable": model_reachable},
        "catalog": registry_stats,
        "pools": pool_stats,
        "generation_logs": "Generation history is recorded best-effort when the migration is applied.",
        "notes": ["Pool and LLM counts are process-local and reset when the server restarts.",
                  "Durable generation history appears after generation logging is wired to the database."],
    }


@app.get("/api/admin/sync")
async def admin_sync(x_admin_key: str | None = Header(default=None)) -> dict:
    base, key = _check_admin_key(x_admin_key)
    try:
        rows, _ = await _admin_rows(base, key, "v_admin_sync_devices", limit=10)
    except HTTPException as exc:
        if exc.status_code == 503:
            return {"reported": False, "note": "Apply migration 008; client devices do not currently report local outbox status.", "summary": None}
        raise
    return {"reported": False, "note": "The schema is ready, but client devices do not currently report local outbox status. Values are not a complete count of offline pending records.",
            "summary": rows[0] if rows else None}


@app.get("/api/admin/difficulty")
async def admin_difficulty(x_admin_key: str | None = Header(default=None)) -> dict:
    base, key = _check_admin_key(x_admin_key)
    rows, _ = await _admin_rows(base, key, "v_admin_difficulty", params={"order": "week.asc,difficulty.asc"}, limit=200)
    return {"items": rows}


@app.get("/api/admin/research-summary")
async def admin_research_summary(x_admin_key: str | None = Header(default=None)) -> dict:
    base, key = _check_admin_key(x_admin_key)
    rows, _ = await _admin_rows(base, key, "v_admin_research_summary", limit=1)
    return {"summary": rows[0] if rows else {}}


@app.get("/api/admin/generation")
async def admin_generation(x_admin_key: str | None = Header(default=None)) -> dict:
    base, key = _check_admin_key(x_admin_key)
    try:
        rows, _ = await _admin_rows(base, key, "v_admin_generation", params={"order": "latest_at.desc"}, limit=200)
        return {"available": True, "items": rows}
    except HTTPException as exc:
        if exc.status_code == 503:
            return {"available": False, "items": [], "note": "Apply migration 008 to enable durable generation analytics."}
        raise


async def _record_admin_audit(base_url: str, service_key: str, action: str, target_id: str, details: dict) -> None:
    import httpx
    record = {
        "audit_id": str(__import__("uuid").uuid4()), "actor_id": "shared-admin-key",
        "action": action, "target_type": "report", "target_id": target_id,
        "outcome": "success", "details": details,
    }
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}",
               "Content-Type": "application/json", "Prefer": "return=minimal"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(f"{base_url}/rest/v1/audit_logs", headers=headers, json=record)
        if not response.is_success:
            print(f"[admin-audit] write failed status={response.status_code}: {response.text[:180]}")
    except httpx.HTTPError as exc:
        print(f"[admin-audit] write failed: {type(exc).__name__}: {exc}")


@app.get("/api/admin/audit")
async def admin_audit_log(
    x_admin_key: str | None = Header(default=None), offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict:
    base, key = _check_admin_key(x_admin_key)
    rows, total = await _admin_rows(base, key, "audit_logs", params={"order": "created_at.desc"}, limit=limit, offset=offset)
    return {"items": rows, "total": total if total is not None else len(rows), "offset": offset, "limit": limit}


@app.get("/api/admin/export.csv")
async def admin_export_csv(
    x_admin_key: str | None = Header(default=None), dataset: str = "participants",
) -> Response:
    base, key = _check_admin_key(x_admin_key)
    resources = {
        "participants": ("v_admin_participants", "created_at.desc"),
        "levels": ("levels", "generated_at.desc"),
        "attempts": ("level_attempts", "started_at.desc"),
        "events": ("events", "created_at.desc"),
        "coins": ("coin_transactions", "created_at.desc"),
        "difficulty": ("difficulty_decisions", "decided_at.desc"),
        "audit": ("audit_logs", "created_at.desc"),
        "mechanics": ("v_admin_mechanics", "total_attempts.desc"),
        "weekly": ("v_admin_weekly", "week.asc"),
    }
    if dataset not in resources:
        raise HTTPException(status_code=422, detail="Unsupported CSV dataset")
    resource, order = resources[dataset]
    first_batch, total = await _admin_rows(base, key, resource, params={"order": order}, limit=1000, offset=0)
    columns = sorted({column for row in first_batch for column in row})

    async def stream_csv():
        row_count = 0
        try:
            if columns:
                output = io.StringIO(newline="")
                writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
                writer.writeheader()
                yield "\ufeff" + output.getvalue()
                for offset, batch in [(0, first_batch)]:
                    output.seek(0); output.truncate(0)
                    for row in batch:
                        writer.writerow({k: ("'" + v if isinstance(v, str) and v[:1] in "=+-@" else v) for k, v in row.items()})
                    row_count += len(batch)
                    yield output.getvalue()
                offset = len(first_batch)
                while first_batch and (total is None or offset < total):
                    batch, _ = await _admin_rows(base, key, resource, params={"order": order}, limit=1000, offset=offset)
                    if not batch:
                        break
                    output.seek(0); output.truncate(0)
                    for row in batch:
                        writer.writerow({k: ("'" + v if isinstance(v, str) and v[:1] in "=+-@" else v) for k, v in row.items()})
                    row_count += len(batch)
                    offset += len(batch)
                    yield output.getvalue()
            await _record_admin_audit(base, key, "report.export.csv", dataset,
                                      {"row_count": row_count, "format": "csv"})
        except asyncio.CancelledError:
            raise

    return StreamingResponse(stream_csv(), media_type="text/csv; charset=utf-8",
                              headers={"Content-Disposition": f'attachment; filename="logicade_{dataset}.csv"',
                                       "Cache-Control": "no-store"})


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


@app.post("/serve")
async def serve(req: ServeRequest) -> dict:
    """Preview an existing fallback game; selection never invokes the LLM."""
    key = (req.week, req.level, req.difficulty)
    lock = _serve_locks.setdefault(key, asyncio.Lock())
    async with lock:
        registry = _registry
        if registry is None:
            raise HTTPException(status_code=503, detail="Game catalogue is unavailable")
        candidates = [
            game for game in registry.get(req.week, req.level, req.difficulty)
            if str(game.get("source_path") or "").replace("\\", "/").startswith("data/fallback_pool/")
        ]
        if not candidates:
            raise HTTPException(status_code=404, detail="No existing JSON game is available for this level")
        queue = _selection_queues.get(key, [])
        available_ids = {str(game.get("file_id") or game.get("game_id")) for game in candidates}
        queue = [game_id for game_id in queue if game_id in available_ids]
        if not queue:
            queue = list(available_ids)
            random.shuffle(queue)
        selected_id = queue.pop()
        _selection_queues[key] = queue
        selected = registry.get_by_id(selected_id)
        if selected is None:
            raise HTTPException(status_code=404, detail="Selected game is no longer in the catalogue")
        source_path = _source_path_for_game(selected)
        try:
            spec = json.loads(source_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=500, detail="Selected game JSON could not be read") from exc
        if not isinstance(spec, dict):
            raise HTTPException(status_code=500, detail="Selected game JSON is not an object")
        spec["source_path"] = source_path.relative_to(REPO_ROOT).as_posix()
        print(f"[serve] selected existing JSON {spec['source_path']} student={req.student_id}")
        return {"spec": spec, "meta": {"verification_result": "catalogue", "source_path": spec["source_path"], "used": False, "generated": False}}


def _log_generation_success(filename: str, path: Path, spec: dict) -> None:
    print(f"{filename} located in {path} with info of (code inside json):")
    print(json.dumps(spec, ensure_ascii=False, indent=2))


async def _persist_generation_log(
    *, file_id: str, source_path: Path, attempt_label: str, outcome: str,
    duration_ms: int, meta: dict | None = None, error: str | None = None,
    spec: dict | None = None,
) -> None:
    """Best-effort durable generation history; never block serving on telemetry."""
    base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not service_key:
        return
    meta = meta or {}
    try:
        attempt_count = int(attempt_label.split("/", 1)[0])
    except (TypeError, ValueError):
        attempt_count = 1
    row = {
        "generation_id": str(__import__("uuid").uuid4()),
        "request_id": None,
        "week": (spec or {}).get("week"),
        "level": (spec or {}).get("level"),
        "difficulty": (spec or {}).get("difficulty"),
        "game_id": file_id,
        "source_path": source_path.relative_to(REPO_ROOT).as_posix(),
        "model_tag": meta.get("model_tag") or (_client.model_tag if _client else None),
        "outcome": outcome,
        "attempts": attempt_count,
        "duration_ms": max(0, int(duration_ms)),
        "verifier_result": meta.get("verification_result"),
        "error": str(error or "")[:1000] or None,
        "fingerprint": (spec or {}).get("fingerprint") or (spec or {}).get("unique_identity_key"),
    }
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}",
               "Content-Type": "application/json", "Prefer": "return=minimal"}
    import httpx
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.post(f"{base_url}/rest/v1/generation_logs", headers=headers, json=row)
        if not response.is_success:
            print(f"[generation-log] DB write failed status={response.status_code}: {response.text[:180]}")
    except httpx.HTTPError as exc:
        print(f"[generation-log] DB write failed: {type(exc).__name__}: {exc}")


async def _try_generate_source_game(file_id: str, source_path: Path, attempt_label: str) -> tuple[dict | None, dict]:
    """One LLM generation, validation, and atomic write for the selected source file."""
    filename = source_path.name
    started = time.perf_counter()
    print(f"{attempt_label} attempt of generating {filename} to {source_path}")
    try:
        template = json.loads(source_path.read_text(encoding="utf-8"))
        if not isinstance(template, dict):
            raise ValueError("source JSON is not an object")
        client = _require_client()
        generated, meta = await client.generate_template_game(
            int(template["week"]), int(template["level"]), str(template["difficulty"]),
            template_spec=template,
        )
    except Exception as exc:
        print(f"generation failed: {type(exc).__name__}: {exc}")
        await _persist_generation_log(file_id=file_id, source_path=source_path,
                                      attempt_label=attempt_label, outcome="generation_failed",
                                      duration_ms=(time.perf_counter() - started) * 1000,
                                      error=f"{type(exc).__name__}: {exc}")
        return None, {"fallback": True, "error": str(exc), "generated": False}

    if meta.get("fallback") or meta.get("verification_result") != "llm_template":
        print("generation failed: LLM did not return a valid replacement JSON.")
        await _persist_generation_log(file_id=file_id, source_path=source_path,
                                      attempt_label=attempt_label, outcome="fallback_or_rejected",
                                      duration_ms=(time.perf_counter() - started) * 1000,
                                      meta=meta, error=meta.get("error"), spec=template)
        return None, meta

    generated["file_id"] = template.get("file_id", file_id)
    generated["game_id"] = template.get("game_id", file_id)
    generated["unique_identity_key"] = template.get("unique_identity_key")
    generated["source_path"] = source_path.relative_to(REPO_ROOT).as_posix()
    selected = _registry.get_by_id(file_id) if _registry else None
    validation_entry = {
        **(selected or {}),
        "file_id": file_id,
        "unique_identity_key": generated["unique_identity_key"],
        "mission_type": generated.get("mission_type"),
    }
    invalid_reason = validate_game_definition(validation_entry, generated)
    if invalid_reason:
        print(f"generation failed: generated JSON validation failed: {invalid_reason}")
        await _persist_generation_log(file_id=file_id, source_path=source_path,
                                      attempt_label=attempt_label, outcome="schema_rejected",
                                      duration_ms=(time.perf_counter() - started) * 1000,
                                      meta=meta, error=invalid_reason, spec=generated)
        return None, {**meta, "fallback": True, "error": invalid_reason, "generated": False}
    try:
        _write_json_atomically(source_path, generated)
    except (OSError, ValueError, TypeError) as exc:
        print(f"generation failed while saving JSON: {type(exc).__name__}: {exc}")
        await _persist_generation_log(file_id=file_id, source_path=source_path,
                                      attempt_label=attempt_label, outcome="save_failed",
                                      duration_ms=(time.perf_counter() - started) * 1000,
                                      meta=meta, error=f"{type(exc).__name__}: {exc}", spec=generated)
        return None, {**meta, "fallback": True, "error": str(exc), "generated": False}

    if selected is not None:
        selected.update(generated)
        selected["source_path"] = generated["source_path"]
        selected["id"] = file_id
        selected["game_id"] = file_id
        selected["metadata"] = {
            **selected.get("metadata", {}),
            "week": generated["week"], "level": generated["level"],
            "difficulty": generated["difficulty"],
            "mechanic": generated.get("primary_mechanic"),
            "mission_type": generated.get("mission_type"),
        }
    _log_generation_success(filename, source_path, generated)
    print(f"[llm] saved replacement JSON; model={meta.get('model_tag')}")
    await _persist_generation_log(file_id=file_id, source_path=source_path,
                                  attempt_label=attempt_label, outcome="verified_saved",
                                  duration_ms=(time.perf_counter() - started) * 1000,
                                  meta=meta, spec=generated)
    return generated, {**meta, "source_path": generated["source_path"], "generated": True}


async def _retry_generation_until_success(file_id: str) -> None:
    """Retry an explicitly requested game replacement every five minutes."""
    retry_number = 0
    try:
        while True:
            await asyncio.sleep(300)
            retry_number += 1
            try:
                registry = _registry
                selected = registry.get_by_id(file_id) if registry else None
                if selected is None:
                    print(f"[llm] retry stopped: game {file_id} is no longer in the catalogue")
                    return
                source_path = _source_path_for_game(selected)
                lock = _regenerate_locks.setdefault(file_id, asyncio.Lock())
                async with lock:
                    generated, _meta = await _try_generate_source_game(
                        file_id, source_path, f"retry {retry_number}"
                    )
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                generated = None
                print(f"[llm] retry {retry_number} encountered an error: {type(exc).__name__}: {exc}")
            if generated is not None:
                print(f"[llm] background retry succeeded for {source_path.name}; stopping retries")
                return
            print("generation failed, try again after another 5 mins.")
    except asyncio.CancelledError:
        print(f"[llm] background retry stopped during server shutdown for {file_id}")
        raise
    except Exception as exc:
        print(f"[llm] background retry error for {file_id}: {type(exc).__name__}: {exc}")
    finally:
        current = asyncio.current_task()
        if _generation_retry_tasks.get(file_id) is current:
            _generation_retry_tasks.pop(file_id, None)


@app.post("/api/games/regenerate")
async def regenerate_game(req: RegenerateGameRequest) -> dict:
    """Explicit replay action: try three times, then retry every five minutes."""
    registry = _registry
    if registry is None:
        raise HTTPException(status_code=503, detail="Game catalogue is unavailable")
    selected = registry.get_by_id(req.file_id)
    if selected is None:
        raise HTTPException(status_code=404, detail="Selected game was not found")
    claimed_file = _regeneration_request_files.get(req.request_id)
    if claimed_file is not None and claimed_file != req.file_id:
        raise HTTPException(status_code=409, detail="Request identifier was already used for another game")
    _regeneration_request_files[req.request_id] = req.file_id
    cached = _regeneration_results.get(req.request_id)
    if cached is not None:
        return cached
    lock = _regenerate_locks.setdefault(req.file_id, asyncio.Lock())
    async with lock:
        cached = _regeneration_results.get(req.request_id)
        if cached is not None:
            return cached
        source_path = _source_path_for_game(selected)
        try:
            original = json.loads(source_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=500, detail="Selected source JSON could not be read") from exc
        if not isinstance(original, dict):
            raise HTTPException(status_code=500, detail="Selected source JSON is not an object")

        generated = None
        meta: dict = {}
        for attempt in range(1, 4):
            generated, meta = await _try_generate_source_game(
                req.file_id, source_path, f"{attempt}/3"
            )
            if generated is not None:
                result = {
                    "spec": generated,
                    "meta": {**meta, "generated": True, "attempts": attempt},
                }
                return _cache_regeneration_result(req.request_id, result)
            if attempt == 1:
                print("generation failed, try second attempt.")
            elif attempt == 2:
                print("generation failed, try third attempt.")
        print("generation failed, try again after 5 mins.")
        task = _generation_retry_tasks.get(req.file_id)
        if task is None or task.done():
            _generation_retry_tasks[req.file_id] = asyncio.create_task(
                _retry_generation_until_success(req.file_id)
            )
        result = {
            "spec": {**original, "source_path": source_path.relative_to(REPO_ROOT).as_posix()},
            "meta": {**meta, "source_path": source_path.relative_to(REPO_ROOT).as_posix(),
                     "generated": False, "retrying": True, "attempts": 3},
        }
        return _cache_regeneration_result(req.request_id, result)


@app.post("/api/games/mark-used")
async def mark_game_used(req: MarkUsedRequest) -> dict:
    """Persist that a previewed game was consumed by a player action."""
    _mark_generated_served({"file_id": req.file_id})
    print(f"[serve] marked used file_id={req.file_id}")
    return {"ok": True, "file_id": req.file_id, "used": True}


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
