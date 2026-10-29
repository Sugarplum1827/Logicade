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
import zipfile
import math
from collections import OrderedDict
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import JSONResponse, RedirectResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware
from typing import Literal
import hmac
import base64
import binascii
import hashlib
import secrets
from uuid import UUID
from datetime import datetime, timezone

from .fallback_loader import load_registry, Registry, validate_game_definition
from .generated_games import discover_games, description_for_level, get_game as find_generated_game, select_game
from .game_packages import PackageError, cleanup_expired_packages, prepare_package, release_package
from .opencode_packages import PACKAGE_RUNTIME as OPENCODE_PACKAGE_RUNTIME, compile_generated_package
from .canvas_games import PACKAGE_RUNTIME as CANVAS_PACKAGE_RUNTIME, compile_canvas_package, describe_canvas_game, discover_canvas_games, find_canvas_game, course_lesson
from .difficulty_engine import DIFFICULTIES, next_difficulty
from .stage_difficulty import StageDifficulty, RULE_VERSION as STAGE_RULE_VERSION
from .sync_validation import PRIMARY_KEYS, validate_sync_ownership
from .llm_client import LLMClient
from .canvas_prompting import is_canvas_source
from .canvas_replacements import CanvasReplacementWorker
from .canvas_publication import recover_publications, publish_candidate, PublicationRollbackError
from .pool_worker import PoolWorker
from . import course_assessments

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parent.parent
GENERATED_GAMES_ROOT = Path(os.getenv(
    "LOGICADE_GENERATED_GAMES_DIR",
    str(REPO_ROOT / "data" / "opencode_generated" / "dist"),
)).expanduser()
OPENCODE_USAGE_PATH = GENERATED_GAMES_ROOT.parent / "used_variations.json"
OPENCODE_PACKAGE_BACKUPS = REPO_ROOT / "data" / "opencode_package_backups"
CANVAS_RUNTIME_ROOT = REPO_ROOT / "games"
CANVAS_USAGE_PATH = REPO_ROOT / ".state" / "canvas_usage.json"
CP1_MIDTERM_BANK_PATH = REPO_ROOT / ".state" / "cp1_midterm_bank.json"
_canvas_games: dict = {}
_canvas_usage: dict = {}
_canvas_usage_lock = asyncio.Lock()


def _load_canvas_usage(private_path: Path, legacy_path: Path) -> dict:
    """Keep participant selection history outside the public static-data mount."""
    private_path.parent.mkdir(parents=True, exist_ok=True)
    selected = private_path if private_path.exists() else legacy_path
    try:
        state = json.loads(selected.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    if not isinstance(state, dict):
        raise ValueError("Invalid native selection history")
    if selected == legacy_path:
        _write_json_atomically(private_path, state)
        legacy_path.unlink(missing_ok=True)
    return state


# ── Request models ────────────────────────────────────────────────────
class ServeRequest(BaseModel):
    student_id: str
    week: int = Field(ge=1, le=9)
    level: int = Field(ge=1, le=10)          # ⭐ NEW
    difficulty: str = Field(pattern="^(needs_support|standard|advanced)$")


class StageStartRequest(BaseModel):
    file_id: str = Field(min_length=1,max_length=160)
    level_id: UUID
    content_revision: str = Field(pattern='^[a-f0-9]{64}$')
    consumption_token: str = Field(min_length=1,max_length=1500)


_difficulty_owner_locks: dict[str, asyncio.Lock] = {}


async def _resolve_stage_difficulty(owner,week,level):
    if week==1 and level>2:raise HTTPException(404,'The opening region contains two stages.')
    base,key,httpx=await _account_db()
    async with _difficulty_owner_locks.setdefault(owner,asyncio.Lock()):
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                return await StageDifficulty(client,base,key,owner).resolve(week,level)
        except httpx.HTTPError:
            raise HTTPException(503,'Difficulty history is temporarily unavailable. Synchronize and try again.') from None


async def _enforce_stage_difficulty(owner,week,level,requested):
    # The orientation and first learning stage have an unconditional Standard
    # baseline; all subsequent transitions, including region boundaries, need evidence.
    expected=(await _resolve_stage_difficulty(owner,week,level))['difficulty']
    if requested!=expected:raise HTTPException(409,f'This stage is assigned {expected}. Select the stage again to refresh its mission.')


async def participant_difficulty(week:int=Query(ge=1,le=9),level:int=Query(ge=1,le=10),authorization:str|None=Header(default=None)):
    owner=_require_participant(authorization)
    return JSONResponse(await _resolve_stage_difficulty(owner,week,level),headers={'Cache-Control':'no-store'})


async def start_stage_difficulty(req:StageStartRequest,authorization:str|None=Header(default=None)):
    owner=_require_participant(authorization)
    game=_find_canvas_game(req.file_id)
    if not game:raise HTTPException(404,'The selected Canvas game is unavailable.')
    _check_canvas_consumption(req.consumption_token,owner,req.file_id,req.content_revision)
    if req.content_revision!=game.content_revision:raise HTTPException(409,'This mission has a new revision. Select the stage again.')
    if game.week==1 and game.level>2:raise HTTPException(404,'This stage is unavailable.')
    base,key,httpx=await _account_db()
    async with _difficulty_owner_locks.setdefault(owner,asyncio.Lock()):
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                service=StageDifficulty(client,base,key,owner)
                assignment=await service.resolve(game.week,game.level)
                return JSONResponse(await service.start(assignment,game,str(req.level_id)),headers={'Cache-Control':'no-store'})
        except httpx.HTTPError:
            raise HTTPException(503,'The stage start could not be confirmed. Try Start again.') from None


class MarkUsedRequest(BaseModel):
    file_id: str = Field(min_length=1, max_length=160, pattern="^[A-Za-z0-9_.-]+$")
    generated_game_id: str | None = Field(default=None, min_length=1, max_length=100,
                                          pattern="^[A-Za-z0-9_.-]+$")
    content_revision: str | None = Field(default=None,pattern='^[a-f0-9]{64}$')
    consumption_token: str | None = Field(default=None,max_length=1500)


class ConsumeGameRequest(BaseModel):
    file_id: str = Field(min_length=1, max_length=160, pattern="^[A-Za-z0-9_.-]+$")
    request_id: str = Field(min_length=16, max_length=80, pattern="^[A-Za-z0-9_.:-]+$")


class PrepareGameRequest(BaseModel):
    file_id: str = Field(min_length=1, max_length=160, pattern="^[A-Za-z0-9_.-]+$")
    generated_game_id: str | None = Field(default=None, min_length=1, max_length=100,
                                          pattern="^[A-Za-z0-9_.-]+$")
    content_revision: str | None = Field(default=None,pattern='^[a-f0-9]{64}$')


class ReleaseGameRequest(BaseModel):
    package_id: str = Field(min_length=97, max_length=97, pattern="^[a-f0-9]{64}-[a-f0-9]{32}$")


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
    table: Literal["students", "levels", "level_attempts", "events", "coin_transactions", "difficulty_decisions"]
    rows: list[dict] = Field(min_length=1, max_length=50)


class SyncStatusRequest(BaseModel):
    device_id: str = Field(min_length=8, max_length=100, pattern=r"^[A-Za-z0-9_.:-]+$")
    pending_records: int = Field(ge=0, le=1_000_000)
    failed_records: int = Field(ge=0, le=1_000_000)
    last_sync_at: datetime | None = None
    last_error: str | None = Field(default=None, max_length=500)


class HintSpendRequest(BaseModel):
    transaction_id: str = Field(pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
    level_id: str = Field(pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


class AccountRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_.-]+$")
    student_number: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9][A-Za-z0-9-]*$")
    password: str = Field(min_length=8, max_length=256)


class LoginRequest(BaseModel):
    student_number: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=1, max_length=256)


class AdminLoginRequest(BaseModel):
    email: str
    password: str


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _session_secret() -> bytes:
    secret = os.environ.get("LOGICADE_SESSION_SECRET") or os.environ.get("LOGICADE_ADMIN_KEY", "")
    if not secret:
        raise HTTPException(status_code=503, detail="Account authentication is not configured")
    return hashlib.sha256(secret.encode()).digest()


def _issue_session(student_id: str, role: str = "participant") -> str:
    payload = _b64(json.dumps({"sub": student_id, "role": role,
        "exp": int(datetime.now(timezone.utc).timestamp()) + 60 * 60 * 24 * 14}, separators=(",", ":")).encode())
    signature = _b64(hmac.new(_session_secret(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{signature}"


def _session_claims(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in to continue")
    try:
        payload, signature = authorization[7:].split(".", 1)
        expected = _b64(hmac.new(_session_secret(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError("signature")
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if not isinstance(claims, dict): raise ValueError("claims")
        if int(claims.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
            raise ValueError("expired")
        return claims
    except (ValueError, TypeError, binascii.Error, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Session is invalid or expired")


def _require_participant(authorization: str | None, student_id: str | None = None) -> str:
    claims = _session_claims(authorization)
    if claims.get("role") != "participant":
        raise HTTPException(status_code=403, detail="Participant session required")
    owner = str(claims.get("sub", ""))
    if student_id is not None and not hmac.compare_digest(owner, student_id):
        raise HTTPException(status_code=403, detail="Participant identity does not match this session")
    return owner


def _canvas_consumption_token(owner,file_id,revision):
    payload=_b64(json.dumps({'sub':owner,'file_id':file_id,'revision':revision,'purpose':'canvas_consumption',
        'exp':int(time.time())+14*86400},separators=(',',':')).encode())
    return payload+'.'+_b64(hmac.new(_session_secret(),payload.encode(),hashlib.sha256).digest())


def _check_canvas_consumption(token,owner,file_id,revision):
    claims=_session_claims('Bearer '+token)
    if (claims.get('purpose')!='canvas_consumption' or claims.get('sub')!=owner
            or claims.get('file_id')!=file_id or claims.get('revision')!=revision):
        raise HTTPException(status_code=403,detail='This game revision was not issued to this participant')


def _password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"pbkdf2_sha256$310000${_b64(salt)}${_b64(digest)}"


def _password_matches(password: str, encoded: str) -> bool:
    try:
        kind, rounds, salt, expected = encoded.split("$")
        if kind != "pbkdf2_sha256": return False
        candidate = _password_hash(password, base64.urlsafe_b64decode(salt + "=" * (-len(salt) % 4)))
        return hmac.compare_digest(candidate, encoded)
    except (ValueError, TypeError):
        return False


# ── Module state ──────────────────────────────────────────────────────
_client: LLMClient | None = None
_pool: PoolWorker | None = None
_registry: Registry | None = None
_generated_games: dict = {}
_serve_locks: dict[tuple[int, int, str], asyncio.Lock] = {}
_regenerate_locks: dict[str, asyncio.Lock] = {}
_regeneration_results: OrderedDict[str, dict] = OrderedDict()
_regeneration_request_files: dict[str, str] = {}
_generation_retry_tasks: dict[str, asyncio.Task] = {}
_selection_queues: dict[tuple[int, int, str], list[str]] = {}
_served_pool_ids: set[str] = set()
_opencode_used_by_student: dict[str, set[str]] = {}
_opencode_last_by_student: dict[str, str] = {}
_opencode_usage_lock = asyncio.Lock()
_game_package_locks: dict[str, asyncio.Lock] = {}
_canvas_replacement_worker: CanvasReplacementWorker | None = None


def _load_opencode_usage() -> tuple[dict[str, set[str]], dict[str, str]]:
    try:
        value = json.loads(OPENCODE_USAGE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}, {}
    participants = value.get("participants", {}) if isinstance(value, dict) else {}
    if not isinstance(participants, dict):
        return {}, {}
    used_by_student: dict[str, set[str]] = {}
    last_by_student: dict[str, str] = {}
    for student_id, record in participants.items():
        if not isinstance(student_id, str):
            continue
        if isinstance(record, list):  # Accept the first version of the local history file.
            game_ids = record
            last_id = record[-1] if record and isinstance(record[-1], str) else ""
        elif isinstance(record, dict):
            game_ids = record.get("used", [])
            last_id = str(record.get("last") or "")
        else:
            continue
        if isinstance(game_ids, list):
            used_by_student[student_id] = {game_id for game_id in game_ids if isinstance(game_id, str)}
        if last_id:
            last_by_student[student_id] = last_id
    return used_by_student, last_by_student


def _save_opencode_usage() -> None:
    OPENCODE_USAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema_version": 1,
        "participants": {
            student_id: {
                "used": sorted(game_ids),
                "last": _opencode_last_by_student.get(student_id),
            }
            for student_id, game_ids in sorted(_opencode_used_by_student.items())
        },
    }
    fd, raw_temp = tempfile.mkstemp(prefix=".used_variations.", suffix=".tmp", dir=OPENCODE_USAGE_PATH.parent)
    temporary = Path(raw_temp)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(payload, stream, ensure_ascii=False, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, OPENCODE_USAGE_PATH)
    finally:
        temporary.unlink(missing_ok=True)


def _pop_opencode_sidecars(source_json: Path, variation_id: str) -> bool:
    """Remove only the matching compiled build; preserve its description JSON."""
    archive = source_json.with_suffix(".zip")
    try:
        with zipfile.ZipFile(archive) as bundle:
            manifest = json.loads(bundle.read("package_manifest.json").decode("utf-8"))
        if (manifest.get("runtime") not in {OPENCODE_PACKAGE_RUNTIME, CANVAS_PACKAGE_RUNTIME}
                or manifest.get("variation_id") != variation_id):
            return False
    except (OSError, zipfile.BadZipFile, KeyError, UnicodeDecodeError, json.JSONDecodeError):
        return False
    archive.unlink(missing_ok=True)
    for path in (
        source_json.with_name(f"{source_json.stem}.description.json"),
        source_json.with_name(f"{source_json.stem}.manifest.json"),
    ):
        try:
            metadata = json.loads(path.read_text(encoding="utf-8"))
            matches = metadata.get("variation_id") == variation_id
            if path.name.endswith(".manifest.json"):
                matches = matches and metadata.get("runtime") in {OPENCODE_PACKAGE_RUNTIME, CANVAS_PACKAGE_RUNTIME}
            if matches:
                path.unlink(missing_ok=True)
        except (OSError, json.JSONDecodeError):
            continue
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _canvas_replacement_worker
    publication_guard=CanvasReplacementWorker(REPO_ROOT,CANVAS_RUNTIME_ROOT,_canvas_replacement_lookup,
        _canvas_replacement_bucket,_require_client,_publish_canvas_replacement,_log_canvas_replacement)
    publication_guard.acquire()
    try:
        async with _application_lifespan(app,publication_guard):yield
    finally:
        await publication_guard.close();_canvas_replacement_worker=None
        if _client:await _client.close()


@asynccontextmanager
async def _application_lifespan(app: FastAPI,publication_guard):
    global _client, _pool, _registry, _served_pool_ids, _generated_games, _opencode_used_by_student, _opencode_last_by_student, _canvas_games, _canvas_usage, _canvas_replacement_worker

    enabled=(os.getenv('LOGICADE_NATIVE_CANVAS','1').lower() not in {'0','false','no'}
             and os.getenv('LOGICADE_CANVAS_REPLACEMENTS','1').lower() not in {'0','false','no'})
    _canvas_replacement_worker=publication_guard if enabled else None
    try:recovered=recover_publications(REPO_ROOT)
    except BaseException:
        if _canvas_replacement_worker:await _canvas_replacement_worker.close();_canvas_replacement_worker=None
        raise
    if recovered:print(f'[startup] recovered {recovered} interrupted Canvas publication(s)')

    _canvas_games = discover_canvas_games(CANVAS_RUNTIME_ROOT)
    try:
        _canvas_usage = _load_canvas_usage(CANVAS_USAGE_PATH, REPO_ROOT / "data" / "canvas_usage.json")
    except (OSError, ValueError):
        _canvas_usage = {}
    print(f"[startup] owned Canvas platform: {len(_canvas_games)} games, {sum(map(len, _canvas_games.values()))} variations")

    native_enabled = os.getenv("LOGICADE_NATIVE_CANVAS", "1").lower() not in {"0", "false", "no"}
    _generated_games = {} if native_enabled else discover_games(GENERATED_GAMES_ROOT)
    variation_count = sum(len(items) for items in _generated_games.values())
    if variation_count:
        print(f"[startup] OpenCode game library: {len(_generated_games)} concepts, {variation_count} variations from {GENERATED_GAMES_ROOT}")
    elif not native_enabled:
        print(f"[startup] OpenCode game library unavailable at {GENERATED_GAMES_ROOT}")
    _opencode_used_by_student, _opencode_last_by_student = _load_opencode_usage()

    _client = LLMClient.from_env()
    reachable = await _client.probe()
    print(
        f"[startup] ollama={_client.host} model={_client.model} "
        f"tag={_client.model_tag} digest={_client.model_digest} "
        f"reachable={reachable}"
    )
    _pool = PoolWorker(_client.generate)
    fallback_root = REPO_ROOT / "data" / "fallback_pool"
    served_state = fallback_root / ".served_ids"
    try:
        _served_pool_ids = set(json.loads(served_state.read_text(encoding="utf-8"))) if served_state.exists() else set()
    except (OSError, json.JSONDecodeError, TypeError):
        _served_pool_ids = set()

    try:
        _registry = load_registry()
        for path in sorted(fallback_root.rglob("*.json")):
            if path.name.startswith("game_"):
                continue
            try:
                game = json.loads(path.read_text(encoding="utf-8"))
                game_id = str(game.get("file_id") or game.get("game_id") or "")
                if not game_id or game_id in _served_pool_ids or _registry.get_by_id(game_id):
                    continue
                game["source_path"] = path.relative_to(REPO_ROOT).as_posix()
                if validate_game_definition(game, game):
                    print(f"[startup] skipped invalid supplemental pool JSON: {path.name}")
                    continue
                _register_generated_game(game)
            except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
                print(f"[startup] skipped invalid supplemental pool JSON: {path.name}")
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

    expired = cleanup_expired_packages(GAME_BUILD_CACHE)
    if expired:
        print(f"[package] cleaned {expired} expired extracted game package(s)")
    if _canvas_replacement_worker:
        try:await _canvas_replacement_worker.start()
        except BaseException:
            await _canvas_replacement_worker.close();_canvas_replacement_worker=None
            await _client.close()
            raise
    try:
        yield
    finally:
        retry_tasks = list(_generation_retry_tasks.values())
        for task in retry_tasks:
            task.cancel()
        if retry_tasks:
            await asyncio.gather(*retry_tasks, return_exceptions=True)


app = FastAPI(title="LogiCade", lifespan=lifespan)
app.get('/api/difficulty/resolve')(participant_difficulty)
app.post('/api/difficulty/start')(start_stage_difficulty)
GAME_BUILD_CACHE = REPO_ROOT / "data" / "game_build_cache"


# ── Defensive static mounting ─────────────────────────────────────────
class PublicDataFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        # Also deny normalized/encoded aliases while an old server version's
        # selection file awaits migration on the next application startup.
        parts=path.replace('\\','/').split('/')
        if Path(path).name.lower() == "canvas_usage.json" or any(p.rstrip(' .').casefold()=='runtime' for p in parts):
            raise HTTPException(status_code=404, detail="Not found")
        return await super().get_response(path, scope)


def _mount_if_exists(url_path: str, directory: Path, *, html: bool = False) -> bool:
    if directory.exists() and directory.is_dir():
        app.mount(
            url_path,
            (PublicDataFiles if url_path == "/data" else StaticFiles)(directory=str(directory), html=html),
            name=url_path.strip("/"),
        )
        print(f"[startup] mounted {url_path!r} -> {directory}")
        return True
    print(f"[startup] skipped mount {url_path!r} — {directory} not found")
    return False


def _mount_game_runtime(url_path: str, directory: Path, *, html: bool = False) -> bool:
    """Serve sandboxed game files with CORS for the iframe's opaque origin."""
    if directory.exists() and directory.is_dir():
        app.mount(
            url_path,
            CORSMiddleware(
                app=StaticFiles(directory=str(directory), html=html),
                allow_origins=["*"],
                allow_methods=["GET", "HEAD"],
                allow_headers=["*"],
            ),
            name=url_path.strip("/").replace("/", "-"),
        )
        print(f"[startup] mounted CORS-enabled game files {url_path!r} -> {directory}")
        return True
    print(f"[startup] skipped game files {url_path!r} — {directory} not found")
    return False


REACT_DIST = REPO_ROOT / "client" / "dist"
_has_react = _mount_if_exists("/app", REACT_DIST, html=True)
_mount_if_exists("/assets", REACT_DIST / "assets")
_mount_if_exists("/client", REPO_ROOT / "client", html=True)
_mount_if_exists("/data",   REPO_ROOT / "data")
_mount_if_exists("/static", REPO_ROOT / "client" / "js" / "vendor")
_mount_if_exists("/admin",  REPO_ROOT / "admin", html=True)
_mount_game_runtime("/vendor", REPO_ROOT / "vendor")
_mount_game_runtime("/canvas-runtime", CANVAS_RUNTIME_ROOT, html=True)
_mount_game_runtime("/game-runtime/engine", GENERATED_GAMES_ROOT / "engine")
_mount_game_runtime("/game-runtime/public", GENERATED_GAMES_ROOT / "public")
_mount_game_runtime("/game-runtime/vendor", GENERATED_GAMES_ROOT / "vendor")
GAME_BUILD_CACHE.mkdir(parents=True, exist_ok=True)
_mount_game_runtime("/game-builds", GAME_BUILD_CACHE, html=True)


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
    _served_pool_ids.add(game_id)
    state_path = REPO_ROOT / "data" / "fallback_pool" / ".served_ids"
    temporary_path = state_path.with_suffix(".tmp")
    try:
        state_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path.write_text(json.dumps(sorted(_served_pool_ids)), encoding="utf-8")
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


def _find_canvas_game(variation_id: str):
    match = find_canvas_game(variation_id, _canvas_games)
    if match is not None:
        return match
    return next((game for games in _canvas_games.values() for game in games
                 if game.variation_id == variation_id), None)


def _canvas_replacement_lookup(file_id):
    game=_find_canvas_game(file_id)
    selected=_registry.get_by_id(file_id) if _registry else None
    return (_source_path_for_game(selected),game) if game and selected else None


def _canvas_replacement_bucket(game):
    return [g for rows in _canvas_games.values() for g in rows if (g.week,g.level,g.difficulty)==(game.week,game.level,game.difficulty)]


async def _publish_canvas_replacement(source,old_game,spec,config,expected_revision,source_hash):
    lock=_game_package_locks.setdefault(old_game.file_id,asyncio.Lock())
    async with lock:
        # Synchronous journal commit prevents event-loop readers seeing half a publication.
        try:game=publish_candidate(REPO_ROOT,CANVAS_RUNTIME_ROOT,source,old_game,spec,config,expected_revision,source_hash)
        except PublicationRollbackError:
            _canvas_games[old_game.slug][:]=[g for g in _canvas_games[old_game.slug] if g.file_id!=old_game.file_id]
            raise
        rows=_canvas_games[old_game.slug]
        rows[:]=[game if row.file_id==game.file_id else row for row in rows]
        selected=_registry.get_by_id(game.file_id) if _registry else None
        if selected is not None:
            selected.update(spec)
            selected.update(id=game.file_id,source_path=source.relative_to(REPO_ROOT).as_posix())
    return game


async def _log_canvas_replacement(game,outcome,attempt,started,meta,spec,error):
    await _persist_generation_log(file_id=game.file_id,source_path=game.config_path,
        attempt_label=f'{attempt}/3',outcome=outcome,duration_ms=int((time.perf_counter()-started)*1000),
        meta={**meta,'verification_result':'pass' if outcome=='verified_saved' else 'rejected'},spec=spec,error=error)
    base=os.getenv('SUPABASE_URL','').rstrip('/');key=os.getenv('SUPABASE_SERVICE_ROLE_KEY','')
    if base and key:
        await _record_admin_audit(base,key,'ai.canvas.'+outcome,game.file_id,
            {'attempt':attempt,'objective_id':game.config['learning_objective_id'],'error':error,
             'parameter_fingerprint':spec.get('canvas_generation',{}).get('parameter_fingerprint')},
            target_type='game',actor_id='system:canvas_worker',outcome='success' if outcome=='verified_saved' else 'failed')


async def _enqueue_canvas_replacement(game,revision):
    if not _canvas_replacement_worker:return {'queued':False,'reason':'worker_disabled'}
    try:return await _canvas_replacement_worker.enqueue(game.file_id,revision)
    except OSError as exc:
        print(f'[canvas-generation] queue save failed: {type(exc).__name__}; current pool retained')
        return {'queued':False,'reason':'queue_storage_unavailable'}


async def _reserve_canvas_game(owner: str, week: int | None = None):
    games = [game for values in _canvas_games.values() for game in values
             if not (game.week == 1 and game.level > 2)]
    if week is not None:
        supported = course_lesson(week).get("genres", [])
        games = [game for game in games if game.week == week and game.slug in supported
                 and not (week == 1 and game.level > 2)]
    if not games:
        raise HTTPException(status_code=503, detail="The owned Canvas game platform is unavailable")
    async with _canvas_usage_lock:
        usage_key = owner if week is None else f"{owner}/week/{week}"
        previous = _canvas_usage.get(usage_key)
        legacy = _canvas_usage.get(owner)
        state = previous if isinstance(previous, dict) else legacy if isinstance(legacy, dict) else {}
        used = set(state.get("used", [])) if isinstance(state.get("used", []), list) else set()
        available = [game for game in games if game.variation_id not in used]
        if not available:
            used = {state.get("last")}
            available = [game for game in games if game.variation_id not in used] or games
        game = random.choice(available)
        used.add(game.variation_id)
        _canvas_usage[usage_key] = {"used": sorted(value for value in used if isinstance(value, str)),
                                "last": game.variation_id}
        try:
            CANVAS_USAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
            _write_json_atomically(CANVAS_USAGE_PATH, _canvas_usage)
        except OSError as exc:
            if previous is None:
                _canvas_usage.pop(usage_key, None)
            else:
                _canvas_usage[usage_key] = previous
            raise HTTPException(status_code=503, detail="Could not reserve a different Canvas stage") from exc
    return game


async def _reserve_canvas_description(owner: str, req: ServeRequest, candidates: list[dict]) -> str:
    """Reserve distinct objectives per learner, including previews and pool rollover."""
    scope = f"{owner}/week/{req.week}/level/{req.level}/difficulty/{req.difficulty}"
    recent_scope = f"{owner}/last_canvas_objective"
    choices = []
    for row in candidates:
        file_id = str(row.get("file_id") or row.get("game_id"))
        game = _find_canvas_game(file_id)
        if game is None or (game.week, game.level, game.difficulty) != (req.week, req.level, req.difficulty):
            continue
        objective = " ".join(str(game.config.get("objective") or "").casefold().split())
        fingerprint = hashlib.sha256(objective.encode("utf-8")).hexdigest()
        choices.append((file_id, fingerprint))
    if not choices:
        raise HTTPException(status_code=503, detail="No matching Canvas objective is available")
    async with _canvas_usage_lock:
        previous = dict(_canvas_usage)
        state = _canvas_usage.get(scope, {})
        state = state if isinstance(state, dict) else {}
        used = set(state.get("objectives", []))
        used_files = set(state.get("files", []))
        last = _canvas_usage.get(recent_scope)
        # Old stage history still prevents an immediate repeat after a restart.
        last = last if isinstance(last, str) else state.get("last_objective")
        fresh = [item for item in choices if item[0] not in used_files]
        if not fresh:
            used = set()
            used_files = set()
            fresh = choices
        available = ([item for item in fresh if item[1] not in used and item[1] != last]
                     or [item for item in fresh if item[1] != last]
                     or [item for item in choices if item[1] != last]
                     or [item for item in fresh if item[0] != state.get("last")]
                     or fresh)
        file_id, fingerprint = random.choice(available)
        used.add(fingerprint)
        used_files.add(file_id)
        _canvas_usage[scope] = {"objectives": sorted(used), "files": sorted(used_files),
                                "last_objective": fingerprint, "last": file_id}
        _canvas_usage[recent_scope] = fingerprint
        try:
            _write_json_atomically(CANVAS_USAGE_PATH, _canvas_usage)
        except OSError as exc:
            _canvas_usage.clear()
            _canvas_usage.update(previous)
            raise HTTPException(status_code=503, detail="Could not save the next objective; try again") from exc
    return file_id


@app.get("/api/canvas/catalog")
async def canvas_catalog() -> dict:
    games = _canvas_games or discover_canvas_games(CANVAS_RUNTIME_ROOT)
    return {"runtime": "native_canvas", "items": [game.public_info() for values in games.values() for game in values],
            "implemented_genres": len(games), "variation_count": sum(map(len, games.values())),
            "playable_variation_count": sum(game.week != 1 or game.level <= 2 for values in games.values() for game in values),
            "difficulty_profiles": ["needs_support", "standard", "advanced"]}


@app.post("/api/games/prepare")
async def prepare_game(req: PrepareGameRequest, authorization: str | None = Header(default=None)) -> dict:
    """Compile/extract the selected variation ZIP for a private game lease."""
    owner=_require_participant(authorization)
    registry = _registry
    if registry is None:
        raise HTTPException(status_code=503, detail="Game catalogue is unavailable")
    selected = registry.get_by_id(req.file_id)
    if selected is None:
        raise HTTPException(status_code=404, detail="Game not found")
    if int(selected.get("week", 0)) == 1 and int(selected.get("level", 0)) > 2:
        raise HTTPException(status_code=404, detail="The opening region contains only its welcome video and flowchart stage")
    from .canvas_games import canonical_difficulty
    await _enforce_stage_difficulty(owner,int(selected['week']),int(selected['level']),canonical_difficulty(selected['difficulty']))
    try:
        source_path = _source_path_for_game(selected)
        if req.generated_game_id:
            canvas_game = _find_canvas_game(req.generated_game_id)
            if canvas_game is not None:
                if canvas_game.file_id!=req.file_id:raise HTTPException(status_code=409,detail='Canvas variation does not match this game')
                package_lock = _game_package_locks.setdefault(req.file_id, asyncio.Lock())
                async with package_lock:
                    canvas_game=_find_canvas_game(req.file_id)
                    if req.content_revision and canvas_game.content_revision!=req.content_revision:
                        raise HTTPException(status_code=409,detail='This challenge has a new revision. Select the level again to load its current mission.')
                    spec = json.loads(source_path.read_text(encoding="utf-8"))
                    if not isinstance(spec, dict):raise HTTPException(status_code=422,detail='Selected game JSON is not an object')
                    compiled = await asyncio.to_thread(compile_canvas_package,
                        source_json=source_path, pool_root=REPO_ROOT / "data/fallback_pool",
                        runtime_root=CANVAS_RUNTIME_ROOT, game=canvas_game, spec=spec,
                        backup_root=REPO_ROOT / "data/package_backups")
                    package = await asyncio.to_thread(prepare_package,
                        source_path, REPO_ROOT / "data/fallback_pool", GAME_BUILD_CACHE,
                        shared_canvas_runtime_root=CANVAS_RUNTIME_ROOT,
                        expected_generated_game_id=canvas_game.variation_id)
                if package is None:
                    raise HTTPException(status_code=503, detail="The Canvas package could not be prepared")
                package.update(generated_game=canvas_game.public_info(), game_description=compiled["description"],
                               consumption_token=_canvas_consumption_token(owner,canvas_game.file_id,canvas_game.content_revision))
                print(f"[package] compiled owned Canvas game {compiled['archive']}; Kenney assets remain shared")
                return {"file_id": req.file_id, **package}
            generated_game = find_generated_game(req.generated_game_id, _generated_games)
            if generated_game is None:
                raise HTTPException(status_code=404, detail="Generated game variation is unavailable")
            try:
                spec = json.loads(source_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                raise HTTPException(status_code=500, detail="Selected game JSON could not be read") from exc
            if not isinstance(spec, dict):
                raise HTTPException(status_code=500, detail="Selected game JSON is not an object")
            description = description_for_level(generated_game, spec)
            package_lock = _game_package_locks.setdefault(req.file_id, asyncio.Lock())
            async with package_lock:
                compiled = await asyncio.to_thread(
                    compile_generated_package,
                    source_json=source_path,
                    pool_root=REPO_ROOT / "data" / "fallback_pool",
                    runtime_root=GENERATED_GAMES_ROOT,
                    game=generated_game,
                    description=description,
                    spec=spec,
                    backup_root=OPENCODE_PACKAGE_BACKUPS,
                )
                package = await asyncio.to_thread(
                    prepare_package,
                    source_path,
                    REPO_ROOT / "data" / "fallback_pool",
                    GAME_BUILD_CACHE,
                    shared_web_runtime_root=GENERATED_GAMES_ROOT,
                    expected_generated_game_id=generated_game.variation_id,
                )
            if package is None:
                raise HTTPException(status_code=500, detail="OpenCode game package could not be prepared")
            package["generated_game"] = generated_game.public_info()
            package["game_description"] = compiled["description"]
            print(f"[package] compiled {compiled['archive']} from {generated_game.slug}/{generated_game.variation_id}; extracted game-only build")
            return {"file_id": req.file_id, **package}
        package = await asyncio.to_thread(
            prepare_package,
            source_path,
            REPO_ROOT / "data" / "fallback_pool",
            GAME_BUILD_CACHE,
            REPO_ROOT / "data" / "logicade_phaser_templates" / "phaser_template_assets.zip",
        )
    except PackageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except OSError as exc:
        print(f"[package] prepare failed file_id={req.file_id} error={exc!r}")
        raise HTTPException(status_code=500, detail="Game package could not be prepared") from exc
    if package is None:
        print(f"[package] optional package unavailable for {source_path.name}; using Phaser JSON renderer")
        return {"runtime": "phaser", "file_id": req.file_id, "launch_url": None}
    print(f"[package] extracted {package['archive']} lease={package['package_id']} sha256={package['sha256']}")
    return {"file_id": req.file_id, **package}


@app.post("/api/games/release")
async def release_game(req: ReleaseGameRequest, authorization: str | None = Header(default=None)) -> dict:
    """Discard one extracted preview/game copy while preserving its ZIP source."""
    _require_participant(authorization)
    try:
        removed = await asyncio.to_thread(release_package, req.package_id, GAME_BUILD_CACHE)
    except PackageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except OSError as exc:
        print(f"[package] release failed package_id={req.package_id} error={exc!r}")
        raise HTTPException(status_code=500, detail="Extracted game files could not be released") from exc
    return {"ok": True, "removed": removed}


@app.get("/api/games/{game_id}")
async def get_game(game_id: str) -> dict:
    if _registry is None:
        raise HTTPException(status_code=503, detail="Game catalogue is unavailable")
    game = _registry.get_by_id(game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return {"game": game}


async def _account_db():
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        raise HTTPException(status_code=503, detail="Account database is not configured")
    import httpx
    return base, key, httpx


async def _account_request(client, httpx, method: str, url: str, **kwargs):
    """Turn unavailable Supabase/network failures into a useful API response."""
    try:
        return await client.request(method, url, **kwargs)
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail="The account database cannot be reached. Check the Supabase URL, network, and project status.",
        ) from exc


async def _apply_coin_rows(base: str, key: str, rows: list[dict]) -> list[dict]:
    import httpx
    for row in rows:
        expected = {"hint_used": -6, "first_level_completion_reward": 10}.get(row.get("reason"))
        if expected is None or row.get("amount") != expected or isinstance(row.get("amount"), bool) \
                or row.get("source", "gameplay") != "gameplay" or not row.get("level_id"):
            raise HTTPException(status_code=422, detail="Participants may submit only the fixed hint cost or an eligible level reward")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    results = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            if rows:
                await validate_sync_ownership(client, base, headers, "coin_transactions", rows, str(rows[0].get("student_id") or ""))
            for row in rows:
                response = await client.post(f"{base}/rest/v1/rpc/apply_coin_transaction", headers=headers, json={
                    "p_transaction_id": row.get("transaction_id"), "p_student_id": row.get("student_id"),
                    "p_amount": row.get("amount"), "p_reason": row.get("reason"),
                    "p_source": row.get("source", "gameplay"), "p_level_id": row.get("level_id"),
                    "p_attempt_id": row.get("attempt_id"),
                })
                if not response.is_success:
                    raise HTTPException(status_code=422, detail="Coin transaction rejected by server ledger")
                try:
                    result = response.json()
                except ValueError:
                    result = {}
                if isinstance(result, list):
                    result = result[0] if result else {}
                results.append(result if isinstance(result, dict) else {})
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Coin ledger request failed") from exc
    return results


@app.post("/api/auth/register")
async def register_account(req: AccountRequest) -> dict:
    base, key, httpx = await _account_db()
    username, student_number = req.username.strip(), req.student_number.strip().upper()
    # Hash before creating dependent database rows so invalid password input or
    # hashing errors cannot strand a participant or starting coin transaction.
    password_hash = _password_hash(req.password)
    student_id = f"P-{secrets.token_hex(12).upper()}"
    transaction_id = str(__import__("uuid").uuid4())
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=15) as client:
        response = await _account_request(
            client, httpx, "POST", f"{base}/rest/v1/rpc/register_app_account_atomic",
            headers=headers, json={
                "p_student_id": student_id,
                "p_username": username,
                "p_student_number": student_number,
                "p_password_hash": password_hash,
                "p_transaction_id": transaction_id,
            },
        )
    if not response.is_success:
        try:
            error_payload = response.json()
        except ValueError:
            error_payload = {}
        error_code = str(error_payload.get("code") or "")
        if response.status_code == 409 or error_code == "23505":
            raise HTTPException(status_code=409, detail="Username or student number is already registered")
        if error_code in {"PGRST202", "PGRST204", "42883"}:
            raise HTTPException(status_code=503, detail="The local Supabase database is missing migration 015. Apply it, then retry registration.")
        if error_code == "P0001" and "registration data" in str(error_payload.get("message") or ""):
            raise HTTPException(status_code=422, detail="Account registration data is invalid")
        raise HTTPException(status_code=502, detail="Could not create the account and starting coin balance atomically")
    try:
        result = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="The account database returned an invalid registration result") from exc
    if isinstance(result, list):
        result = result[0] if result else {}
    if not isinstance(result, dict) or result.get("student_id") != student_id:
        raise HTTPException(status_code=502, detail="The account database returned an incomplete registration result")
    return {"student_id": student_id, "username": username, "student_number": student_number,
            "token": _issue_session(student_id)}


@app.post("/api/auth/login")
async def login_account(req: LoginRequest) -> dict:
    base, key, httpx = await _account_db()
    value = req.student_number.strip().upper()
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    async with httpx.AsyncClient(timeout=15) as client:
        response = await _account_request(client, httpx, "GET", f"{base}/rest/v1/app_accounts", headers=headers,
            params={"select": "student_id,username,password_hash", "student_number": f"eq.{value}", "limit": "1"})
    if not response.is_success:
        if response.status_code == 404:
            raise HTTPException(status_code=503, detail="Account tables are unavailable. Apply the account-auth Supabase migration.")
        raise HTTPException(status_code=502, detail="The account database rejected the login lookup.")
    try:
        rows = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="The account database returned an invalid response.") from exc
    if not rows or not _password_matches(req.password, rows[0]["password_hash"]):
        raise HTTPException(status_code=401, detail="Student number or password is incorrect")
    account = rows[0]
    return {"student_id": account["student_id"], "username": account["username"],
            "token": _issue_session(account["student_id"])}


@app.post("/api/sync/batch")
async def sync_batch(req: SyncBatchRequest, authorization: str | None = Header(default=None)) -> dict:
    """Write offline-first client batches using the server-only service key."""
    base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not service_key:
        raise HTTPException(status_code=503, detail="Server-side database sync is not configured")
    owner = _require_participant(authorization)

    allowed = {
        "students": {"student_id", "created_at"},
        "levels": {
            "level_id", "student_id", "week", "level_index", "difficulty_assigned",
            "stage_number",
            "difficulty_served", "game_type", "game_id", "game_title", "primary_mechanic",
            "learning_topic", "region_id", "region_name", "map_id", "sprite_ids",
            "fingerprint", "verification_result", "pool_status", "generated_at",
            "template_id", "template_version", "variation_id", "variation_seed",
        },
        "level_attempts": {
            "attempt_id", "level_id", "student_id", "attempt_number", "is_replay",
            "score", "accuracy", "in_activity_attempts", "error_count",
            "completion_time_sec", "hint_count", "activity_retries", "completed",
            "started_at", "ended_at", "status", "restart_count",
            "question_retry_count", "origin", "template_id", "template_version",
            "variation_id", "variation_seed",
        },
        "events": {
            "event_id", "level_id", "attempt_id", "student_id", "event_type",
            "t_ms_since_start", "entity_id", "rule_id", "payload", "created_at",
        },
        "coin_transactions": {
            "transaction_id", "student_id", "amount", "reason", "source",
            "level_id", "attempt_id", "event_id", "actor_id", "created_at",
        },
        "difficulty_decisions": {
            "decision_id", "student_id", "previous_level_id", "next_level_id",
            "difficulty_before", "difficulty_selected", "difficulty_served",
            "inputs", "rule_version", "reason", "decided_at", "created_at",
        },
    }
    for row in req.rows:
        if not isinstance(row, dict) or set(row) - allowed[req.table]:
            raise HTTPException(status_code=422, detail=f"Invalid columns in {req.table} batch")
        if str(row.get("student_id", "")) != owner:
            raise HTTPException(status_code=403, detail="Sync rows must belong to the signed-in participant")
        if req.table == "levels":
            stage_number = row.get("stage_number")
            if stage_number is not None and (
                isinstance(stage_number, bool) or not isinstance(stage_number, int)
                or not 1 <= stage_number <= 10
            ):
                raise HTTPException(status_code=422, detail="Level stage number must be an integer from 1 to 10")
        elif req.table == "level_attempts":
            if row.get("status") is None:
                row["status"] = "completed" if row.get("completed") is True else "failed"
            for field in ("score", "accuracy"):
                value = row.get(field)
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1:
                    raise HTTPException(status_code=422, detail=f"Attempt {field} must be between 0 and 1")
            if row.get("status") not in {"completed", "failed", "incomplete", "abandoned", "restarted"}:
                raise HTTPException(status_code=422, detail="Attempt status is invalid")
            if not isinstance(row.get("completed"), bool) or (row["status"] == "completed") != row["completed"]:
                raise HTTPException(status_code=422, detail="Attempt completion and status disagree")
            if not isinstance(row.get("is_replay"), bool):
                raise HTTPException(status_code=422, detail="Attempt replay status must be a boolean")
            for field in ("attempt_number", "in_activity_attempts", "error_count", "hint_count", "activity_retries", "restart_count", "question_retry_count"):
                value = row.get(field, 0)
                if isinstance(value, bool) or not isinstance(value, int) or value < 0 or (field == "attempt_number" and value < 1):
                    raise HTTPException(status_code=422, detail=f"Attempt {field} must be a non-negative integer")
            duration = row.get("completion_time_sec")
            if duration is not None and (isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration < 0):
                raise HTTPException(status_code=422, detail="Attempt duration must be non-negative")
        elif req.table == "difficulty_decisions":
            if row.get("difficulty_selected") not in DIFFICULTIES or not isinstance(row.get("inputs", {}), dict):
                raise HTTPException(status_code=422, detail="Difficulty selection or decision inputs are invalid")
            for field in ("difficulty_selected", "difficulty_served"):
                value = row.get(field)
                if value is not None and value not in DIFFICULTIES:
                    raise HTTPException(status_code=422, detail=f"{field} is not a supported difficulty")
        elif req.table == "events":
            if not isinstance(row.get("event_type"), str) or not 1 <= len(row["event_type"]) <= 100 \
                    or not isinstance(row.get("payload", {}), dict):
                raise HTTPException(status_code=422, detail="Gameplay event type or payload is invalid")
            elapsed = row.get("t_ms_since_start")
            if isinstance(elapsed, bool) or not isinstance(elapsed, int) or not 0 <= elapsed <= 2_147_483_647:
                raise HTTPException(status_code=422, detail="Gameplay event elapsed time is invalid")
    if req.table == "coin_transactions":
        await _apply_coin_rows(base_url, service_key, req.rows)
        return {"ok": True, "table": req.table, "stored": len(req.rows)}

    conflict = {"students": "student_id", "levels": "level_id", "level_attempts": "attempt_id",
                "events": "event_id", "coin_transactions": "transaction_id",
                "difficulty_decisions": "decision_id"}[req.table]
    url = f"{base_url}/rest/v1/{req.table}?on_conflict={conflict}"
    # Retried outbox jobs can carry the same primary ID more than once. Send
    # one row per ID so PostgreSQL never updates one conflict twice in a batch.
    primary = PRIMARY_KEYS.get(req.table, "student_id")
    rows_to_store = list({str(row.get(primary)): dict(row) for row in req.rows}.values())
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=" + ("merge-duplicates" if req.table == "difficulty_decisions" else "ignore-duplicates") + ",return=minimal",
    }
    import httpx
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            await validate_sync_ownership(client, base_url, headers, req.table, rows_to_store, owner)
            if req.table == "difficulty_decisions":
                for row in rows_to_store:
                    if row.get('rule_version')==STAGE_RULE_VERSION:
                        # v2 decisions are created by resolve/start only. Sync
                        # can acknowledge an identical cached copy, never forge
                        # or edit server-owned evidence/served history.
                        response=await client.get(f'{base_url}/rest/v1/difficulty_decisions',headers=headers,
                            params={'select':'*','decision_id':f'eq.{row["decision_id"]}','student_id':f'eq.{owner}'})
                        existing=response.json() if response.is_success else None
                        if not isinstance(existing,list) or not existing or any(row.get(k)!=existing[0].get(k) for k in
                            ('previous_level_id','next_level_id','difficulty_selected','difficulty_served','inputs','rule_version')):
                            raise HTTPException(409,'Authoritative difficulty decisions must be resolved and started through the server.')
                        continue
                    inputs = dict(row.get("inputs") or {})
                    validation = {"status": "unverified", "rule_version": row.get("rule_version")}
                    previous_level = row.get("previous_level_id")
                    if row.get("rule_version") != "cp1-60-v1":
                        validation["reason"] = "No server rule is registered for this version."
                    elif previous_level:
                        attempts_response = await client.get(
                            f"{base_url}/rest/v1/level_attempts",
                            headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
                            params={
                                "select": "attempt_number,accuracy,completed,error_count",
                                "student_id": f"eq.{owner}",
                                "level_id": f"eq.{previous_level}",
                                "order": "attempt_number.asc,started_at.asc",
                                "limit": "1000",
                            },
                        )
                        if attempts_response.is_success:
                            attempts = attempts_response.json()
                            first = next((item for item in attempts if item.get("attempt_number") == 1), None)
                            if first and isinstance(first.get("accuracy"), (int, float)):
                                completed_any = False
                                full_replays = 0
                                for attempt in attempts:
                                    if completed_any and attempt.get("completed") is True:
                                        full_replays += 1
                                    if attempt.get("completed") is True:
                                        completed_any = True
                                errors = sum(max(0, int(item.get("error_count") or 0)) for item in attempts)
                                expected = next_difficulty(float(first["accuracy"]), full_replays, errors)
                                validation = {
                                    "status": "verified" if row.get("difficulty_selected") == expected else "mismatch",
                                    "expected_selection": expected,
                                    "first_attempt_accuracy": float(first["accuracy"]),
                                    "full_level_replays": full_replays,
                                    "total_errors": errors,
                                    "verified_at": datetime.now(timezone.utc).isoformat(),
                                }
                            else:
                                validation["reason"] = "The first completed/attempt row is not synchronized yet."
                        else:
                            validation["reason"] = f"Attempt lookup returned HTTP {attempts_response.status_code}."
                    else:
                        validation["reason"] = "Decision has no previous level reference."
                    # Retain the selected and served values exactly as sent;
                    # store the server comparison beside the client inputs.
                    inputs["server_verification"] = validation
                    row["inputs"] = inputs
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
            for row in rows_to_store:
                grouped_rows.setdefault(tuple(sorted(row)), []).append(row)
            for group in grouped_rows.values():
                if req.table == "difficulty_decisions":
                    # Filter updates by the authenticated owner, then insert
                    # missing records with conflict-ignore. A concurrent insert
                    # can never reassign another learner's decision to this one.
                    for row in group:
                        if row.get('rule_version')==STAGE_RULE_VERSION:continue
                        existing_response=await client.get(f'{base_url}/rest/v1/difficulty_decisions',headers=headers,
                            params={'select':'*','decision_id':f'eq.{row["decision_id"]}','student_id':f'eq.{owner}'})
                        if not existing_response.is_success:raise HTTPException(503,'Could not check the saved difficulty history.')
                        previous_rows=existing_response.json()
                        previous=previous_rows[0] if previous_rows else None
                        if previous and previous.get('difficulty_served'):
                            if any(row.get(k)!=previous.get(k) for k in ('previous_level_id','next_level_id','difficulty_selected','difficulty_served','rule_version')):
                                raise HTTPException(409,'A served difficulty decision is immutable.')
                            continue
                        if row.get('difficulty_served'):
                            # Old offline clients may upload provisional choices,
                            # but cannot mint a new "historically served" choice
                            # that would bypass the authoritative start endpoint.
                            raise HTTPException(409,'Refresh the application and confirm the stage through the server before recording a served difficulty.')
                        update_headers = {**headers, "Prefer": "return=representation"}
                        response = await client.patch(
                            f"{base_url}/rest/v1/difficulty_decisions",
                            headers=update_headers,
                            params={"decision_id": f"eq.{row['decision_id']}", "student_id": f"eq.{owner}"},
                            json={field: value for field, value in row.items() if field not in {"decision_id", "student_id"}},
                        )
                        if not response.is_success:
                            raise HTTPException(status_code=502, detail="Could not update the participant difficulty decision")
                        if not response.json():
                            response = await client.post(url,
                                headers={**headers, "Prefer": "resolution=ignore-duplicates,return=minimal"}, json=[row])
                            if not response.is_success:
                                raise HTTPException(status_code=502, detail="Could not save the participant difficulty decision")
                            await validate_sync_ownership(client, base_url, headers, req.table, [row], owner)
                    continue
                response = await client.post(url, headers=headers, json=group)
                if not response.is_success:
                    detail = response.text.replace("\n", " ")[:320]
                    print(f"[sync] PostgREST rejected table={req.table} status={response.status_code}: {detail}")
                    raise HTTPException(status_code=502, detail=f"Database rejected {req.table} batch ({response.status_code}): {detail}")
            if req.table == "levels":
                # Older clients may already have stored a level row without a
                # stage number. Fill only that missing field; never overwrite a
                # stage already assigned to this level.
                for row in rows_to_store:
                    if row.get("stage_number") is None:
                        continue
                    response = await client.patch(
                        f"{base_url}/rest/v1/levels",
                        headers={**headers, "Prefer": "return=minimal"},
                        params={
                            "level_id": f"eq.{row['level_id']}",
                            "student_id": f"eq.{owner}",
                            "stage_number": "is.null",
                        },
                        json={"stage_number": row["stage_number"]},
                    )
                    if not response.is_success:
                        raise HTTPException(status_code=502, detail="Could not add the stage number to an existing level record")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Database sync request failed") from exc
    return {"ok": True, "table": req.table, "stored": len(req.rows)}


@app.post("/api/coins/spend-hint")
async def spend_hint_coins(req: HintSpendRequest, authorization: str | None = Header(default=None)) -> dict:
    """Atomically validate and charge the fixed six-coin hint cost on the server."""
    owner = _require_participant(authorization)
    base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not service_key:
        raise HTTPException(status_code=503, detail="Server-side coin ledger is not configured")
    results = await _apply_coin_rows(base_url, service_key, [{
        "transaction_id": req.transaction_id,
        "student_id": owner,
        "amount": -6,
        "reason": "hint_used",
        "source": "gameplay",
        "level_id": req.level_id,
        "attempt_id": None,
    }])
    return {"ok": True, "balance": results[0].get("balance") if results else None,
            "duplicate": bool(results and results[0].get("duplicate"))}


@app.get("/api/coins/balance")
async def participant_coin_balance(authorization: str | None = Header(default=None)) -> JSONResponse:
    """Read the signed-in participant's synchronized ledger without changing it."""
    owner = _require_participant(authorization)
    base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not service_key:
        raise HTTPException(status_code=503, detail="Server-side coin ledger is not configured")
    import httpx
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(f"{base_url}/rest/v1/v_admin_coin_summary", headers={
                "apikey": service_key, "Authorization": f"Bearer {service_key}",
            }, params={
                "select": "student_id,coin_balance,coins_earned,coins_spent",
                "student_id": f"eq.{owner}", "limit": "1",
            })
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="The coin ledger cannot be reached. Try again when the database is available.") from exc
    if not response.is_success:
        raise HTTPException(status_code=502, detail="The database could not provide the coin balance. Check the coin-summary view and server database permissions.")
    try:
        rows = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="The coin ledger returned an invalid balance response") from exc
    if rows == []:
        raise HTTPException(status_code=503, detail="The synchronized coin balance is unavailable for this participant. Complete account setup or synchronize and try again.")
    if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict) or rows[0].get("student_id") != owner:
        raise HTTPException(status_code=502, detail="The coin ledger returned an invalid balance response")
    row = rows[0]
    values = [row.get(name) for name in ("coin_balance", "coins_earned", "coins_spent")]
    # Preserve integer values exactly in the browser. Missing values and
    # malformed summaries must never reset an existing local wallet to zero.
    if any(isinstance(value, bool) or not isinstance(value, int) or abs(value) > 9007199254740991 for value in values):
        raise HTTPException(status_code=502, detail="The coin ledger returned invalid balance totals")
    balance, earned, spent = values
    if earned < 0 or spent < 0 or balance != earned - spent:
        raise HTTPException(status_code=502, detail="The coin ledger totals are inconsistent and need reconciliation")
    return JSONResponse({"ok": True, "student_id": owner, "balance": balance,
        "coins_earned": earned, "coins_spent": spent}, headers={"Cache-Control": "no-store"})


@app.get("/api/progress/stages")
async def participant_stage_progress(
    week: int = Query(ge=1, le=9),
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    """Return only the authenticated learner's explicit, synchronized stage progress."""
    owner = _require_participant(authorization)
    stage_count = len(course_lesson(week).get('stages', [])) or (2 if week == 1 else 10)
    base, key, httpx = await _account_db()
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            levels_response = await client.get(f"{base}/rest/v1/levels", headers=headers, params={
                "select": "level_id,stage_number",
                "student_id": f"eq.{owner}",
                "week": f"eq.{week}",
                "stage_number": "not.is.null",
                "limit": "1000",
            })
            if not levels_response.is_success:
                raise HTTPException(status_code=502, detail="Could not load synchronized stage progress")
            try:
                level_rows = levels_response.json()
            except ValueError as exc:
                raise HTTPException(status_code=502, detail="The database returned invalid stage progress") from exc
            if not isinstance(level_rows, list) or any(not isinstance(row, dict) for row in level_rows):
                raise HTTPException(status_code=502, detail="The database returned invalid stage progress")

            staged_levels = {
                str(row["level_id"]): row["stage_number"]
                for row in level_rows
                if row.get("level_id")
                and isinstance(row.get("stage_number"), int)
                and not isinstance(row.get("stage_number"), bool)
                and 1 <= row["stage_number"] <= stage_count
            }
            completed_stages: set[int] = set()
            attempt_request_limit = asyncio.Semaphore(25)
            async def fetch_completed_stage(level_id: str, stage_number: int) -> int | None:
                async with attempt_request_limit:
                    attempt_response = await client.get(f"{base}/rest/v1/level_attempts", headers=headers, params={
                        "select": "level_id",
                        "student_id": f"eq.{owner}",
                        "level_id": f"eq.{level_id}",
                        "completed": "eq.true",
                        "limit": "1",
                    })
                if not attempt_response.is_success:
                    raise HTTPException(status_code=502, detail="Could not load completed stage attempts")
                try:
                    attempt_rows = attempt_response.json()
                except ValueError as exc:
                    raise HTTPException(status_code=502, detail="The database returned invalid completed attempts") from exc
                if not isinstance(attempt_rows, list) or any(not isinstance(row, dict) for row in attempt_rows):
                    raise HTTPException(status_code=502, detail="The database returned invalid completed attempts")
                return stage_number if any(str(row.get("level_id")) == level_id for row in attempt_rows) else None

            if staged_levels:
                completed_results = await asyncio.gather(*(
                    fetch_completed_stage(level_id, stage_number)
                    for level_id, stage_number in staged_levels.items()
                ))
                completed_stages = {stage for stage in completed_results if stage is not None}

            started_stages = {
                int(row["stage_number"]) for row in level_rows
                if isinstance(row.get("stage_number"), int)
                and not isinstance(row.get("stage_number"), bool)
                and 1 <= row["stage_number"] <= stage_count
            }
            active_stages = started_stages - completed_stages
            active_stage = max(active_stages) if active_stages else None
            next_stage = next((stage for stage in range(1, stage_count + 1) if stage not in completed_stages), None)
            current_stage = active_stage or next_stage or stage_count
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Stage progress is temporarily unavailable") from exc

    return JSONResponse({
        "ok": True,
        "week": week,
        "started_stages": sorted(started_stages),
        "completed_stages": sorted(completed_stages),
        "active_stage": active_stage,
        "next_stage": next_stage,
        "current_stage": current_stage,
        "study_complete": len(completed_stages) == stage_count,
    }, headers={"Cache-Control": "no-store"})


@app.post("/api/sync/status")
async def sync_device_status(req: SyncStatusRequest, authorization: str | None = Header(default=None)) -> dict:
    """Report per-device queue health for the admin synchronization dashboard."""
    owner = _require_participant(authorization)
    base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not service_key:
        raise HTTPException(status_code=503, detail="Server-side database sync is not configured")
    import httpx
    now = datetime.now(timezone.utc).isoformat()
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    device = {
        "sync_device_id": str(__import__("uuid").uuid5(
            __import__("uuid").NAMESPACE_URL, f"logicade-sync:{owner}:{req.device_id}")),
        "student_id": owner,
        "device_id": req.device_id,
        "last_seen_at": now,
        "last_sync_at": req.last_sync_at.isoformat() if req.last_sync_at else None,
        "pending_records": req.pending_records,
        "failed_records": req.failed_records,
        "last_error": req.last_error,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # The status row has a student FK. Reconcile the authenticated
            # participant parent just as the batch sync path does.
            parent = await client.post(
                f"{base_url}/rest/v1/students?on_conflict=student_id",
                headers=headers, json={"student_id": owner},
            )
            if not parent.is_success:
                raise HTTPException(status_code=502, detail="Could not register the sync participant")
            response = await client.post(
                f"{base_url}/rest/v1/sync_devices?on_conflict=student_id,device_id",
                headers=headers, json=device,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not save device synchronization status") from exc
    if not response.is_success:
        print(f"[sync] device status rejected status={response.status_code}: {response.text[:240]}")
        raise HTTPException(status_code=502, detail="Database rejected device synchronization status")
    return {"ok": True, "pending_records": req.pending_records, "failed_records": req.failed_records}


@app.get("/api/admin/analytics")
async def admin_analytics(x_admin_key: str | None = Header(default=None)) -> dict:
    _require_admin_auth(x_admin_key)
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
    if x_admin_key and x_admin_key.startswith("Bearer "):
        claims = _session_claims(x_admin_key)
        if claims.get("role") == "admin": return
        raise HTTPException(status_code=403, detail="Administrator session required")
    expected = os.environ.get("LOGICADE_ADMIN_KEY", "")
    if not expected or not x_admin_key or not hmac.compare_digest(expected, x_admin_key):
        raise HTTPException(status_code=401, detail="Admin key is missing or invalid")


@app.post("/api/admin/login")
async def admin_login(req: AdminLoginRequest) -> dict:
    expected_email = os.environ.get("LOGICADE_ADMIN_EMAIL", "kohnqui@gmail.com").strip().lower()
    expected_password = os.environ.get("LOGICADE_ADMIN_KEY", "")
    if not expected_password or not hmac.compare_digest(req.email.strip().lower(), expected_email) \
            or not hmac.compare_digest(req.password, expected_password):
        raise HTTPException(status_code=401, detail="Administrator email or password is incorrect")
    base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if base_url and service_key:
        await _record_admin_audit(base_url, service_key, "admin.login", expected_email,
            {"method": "email_password"}, target_type="administrator", actor_id=expected_email)
    return {"token": _issue_session(expected_email, "admin"), "email": expected_email}


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
        "canvas_replacements": _canvas_replacement_worker.status() if _canvas_replacement_worker else {'enabled':False},
        "generation_logs": "Generation history is recorded best-effort when the migration is applied.",
        "notes": ["Pool and LLM counts are process-local and reset when the server restarts.",
                  "Canvas replacement jobs are durable, run in the background, and retain the existing pool when generation fails."],
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


@app.get("/api/admin/study-metrics")
async def admin_study_metrics(x_admin_key: str | None = Header(default=None)) -> dict:
    base, key = _check_admin_key(x_admin_key)
    try:
        rows, _ = await _admin_rows(base, key, "v_admin_study_metrics", limit=1)
        metrics = dict(rows[0]) if rows else {}
        # The historical view counts replay entries, including abandoned ones.
        # A full-level replay requires a completed run after an earlier clear.
        _, completed_replays = await _admin_rows(base, key, "level_attempts", params={
            "is_replay": "eq.true", "completed": "eq.true", "status": "eq.completed",
        }, limit=1)
        metrics["replay_attempts_started"] = metrics.get("recorded_full_level_replays")
        metrics["recorded_full_level_replays"] = completed_replays
        return {"available": True, "metrics": metrics}
    except HTTPException as exc:
        if exc.status_code == 503:
            return {"available": False, "metrics": {}, "note": "Apply migration 009_admin_dashboard_metrics.sql to enable complete study totals."}
        raise


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



def _admin_audit_actor(x_admin_key: str | None) -> str:
    if x_admin_key and x_admin_key.startswith("Bearer "):
        claims = _session_claims(x_admin_key)
        return str(claims.get("sub") or "admin")[:160]
    return os.environ.get("LOGICADE_ADMIN_EMAIL", "admin").strip().lower()[:160]


async def _record_admin_audit(
    base_url: str, service_key: str, action: str, target_id: str, details: dict,
    *, target_type: str = "report", outcome: str = "success", actor_id: str = "admin", required: bool = False,
) -> None:
    import httpx
    record = {
        "audit_id": str(__import__("uuid").uuid4()), "actor_id": actor_id[:160],
        "action": action, "target_type": target_type, "target_id": target_id,
        "outcome": outcome, "details": details,
    }
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}",
               "Content-Type": "application/json", "Prefer": "return=minimal"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(f"{base_url}/rest/v1/audit_logs", headers=headers, json=record)
        if not response.is_success:
            print(f"[admin-audit] write failed status={response.status_code}: {response.text[:180]}")
            if required:
                raise HTTPException(status_code=503, detail="The export could not be recorded in the audit log. Please try again.")
    except httpx.HTTPError as exc:
        print(f"[admin-audit] write failed: {type(exc).__name__}: {exc}")
        if required:
            raise HTTPException(status_code=503, detail="The export could not be recorded in the audit log. Please try again.") from exc


def _research_pseudonym(student_id: str) -> str:
    """Stable export identifier; never expose stored student IDs in research files."""
    secret = os.environ.get("LOGICADE_PSEUDONYM_KEY") or os.environ.get("LOGICADE_ADMIN_KEY", "")
    if not secret:
        raise HTTPException(status_code=503, detail="Configure LOGICADE_PSEUDONYM_KEY before exporting participant data")
    digest = hmac.new(secret.encode(), student_id.encode(), "sha256").hexdigest()[:16].upper()
    return f"LC-{digest}"


async def _export_rows(base: str, key: str, resource: str, order: str, filters: dict | None = None) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while offset < 20000:
        params = {"order": order, **(filters or {})}
        batch, total = await _admin_rows(base, key, resource, params=params, limit=1000, offset=offset)
        if not batch:
            break
        rows.extend(dict(row) for row in batch)
        offset += len(batch)
        if total is not None and offset >= total:
            break
    if offset >= 20000:
        if total is None:
            extra, _ = await _admin_rows(base, key, resource, params=params, limit=1, offset=offset)
            exceeds_limit = bool(extra)
        else:
            exceeds_limit = total > offset
        if exceeds_limit:
            raise HTTPException(status_code=413, detail="Export exceeds 20,000 rows; apply filters and export a smaller dataset")
    for row in rows:
        if "student_id" in row:
            student_id = row.pop("student_id")
            row["participant_id"] = _research_pseudonym(str(student_id)) if student_id else None
    return rows


def _export_value(value):
    """Preserve zero/False and serialize structured cells consistently."""
    if value is None:
        return ""
    return json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value


def _spreadsheet_value(value):
    value = _export_value(value)
    if isinstance(value, str):
        value = _report_text(value)
        stripped = value.lstrip()
        if value[:1] in ("\t", "\r", "\n") or (stripped and stripped[0] in "=+-@"):
            return "'" + value
    return value


def _report_text(value) -> str:
    text = str(_export_value(value))
    # Office XML cannot contain these controls. Render a reversible escape
    # instead of failing the export or silently deleting the source character.
    return "".join(f"\\u{ord(char):04x}" if ord(char) < 32 and char not in "\t\r\n" else char for char in text)


def _export_filters(dataset: str, date_from: str | None, date_to: str | None,
                    week: int | None, difficulty: str | None, stratum: str | None,
                    include_incomplete: bool) -> tuple[dict, dict]:
    from datetime import date, timedelta
    date_fields = {"participants": "created_at", "levels": "generated_at", "attempts": "started_at",
                   "events": "created_at", "coins": "created_at", "difficulty": "decided_at", "audit": "created_at"}
    filters: dict[str, str] = {}
    applied: dict = {"include_incomplete": include_incomplete} if dataset == "attempts" else {}
    try:
        start = date.fromisoformat(date_from) if date_from else None
        end = date.fromisoformat(date_to) if date_to else None
        if (start and start.isoformat() != date_from) or (end and end.isoformat() != date_to):
            raise ValueError("Dates must use YYYY-MM-DD")
        if start and end and start > end:
            raise ValueError("The start date must be on or before the end date")
        # Use an exclusive next-day boundary, including the final day's
        # fractional seconds. An AND expression retains both bounds.
        next_day = end + timedelta(days=1) if end else None
    except (TypeError, ValueError, OverflowError) as exc:
        raise HTTPException(status_code=422, detail="Use a valid YYYY-MM-DD date range with start on or before end") from exc
    if start or end:
        timestamp = date_fields.get(dataset)
        if not timestamp:
            raise HTTPException(status_code=422, detail=f"Date filtering is unavailable for the precomputed {dataset} dataset")
        bounds = []
        if start:
            bounds.append(f"{timestamp}.gte.{start.isoformat()}T00:00:00Z")
            applied["date_from"] = start.isoformat()
        if next_day:
            bounds.append(f"{timestamp}.lt.{next_day.isoformat()}T00:00:00Z")
            applied["date_to"] = end.isoformat()
        filters["and"] = "(" + ",".join(bounds) + ")"
    if week is not None:
        if isinstance(week, bool) or not isinstance(week, int) or not 1 <= week <= 9:
            raise HTTPException(status_code=422, detail="Study week must be between 1 and 9")
        field = "current_week" if dataset == "participants" else "week" if dataset in {"levels", "weekly", "mechanics"} else None
        if field is None:
            raise HTTPException(status_code=422, detail=f"Week filtering is unavailable for the {dataset} dataset; clear that filter")
        filters[field] = f"eq.{week}"
        applied["week"] = week
    if difficulty:
        if difficulty not in DIFFICULTIES:
            raise HTTPException(status_code=422, detail="Unsupported export difficulty")
        field = {"levels": "difficulty_served", "difficulty": "difficulty_selected"}.get(dataset)
        if field is None:
            raise HTTPException(status_code=422, detail=f"Difficulty filtering is unavailable for the {dataset} dataset; clear that filter")
        filters[field] = f"eq.{difficulty}"
        applied["difficulty"] = difficulty
    if stratum:
        if stratum not in {"Knowledgeable", "Moderate", "Minimal"}:
            raise HTTPException(status_code=422, detail="Unsupported research stratum")
        if dataset != "participants":
            raise HTTPException(status_code=422, detail=f"Stratum filtering is unavailable for the {dataset} dataset; clear that filter")
        filters["stratum"] = f"eq.{stratum}"
        applied["stratum"] = stratum
    if not include_incomplete and dataset == "attempts":
        filters["status"] = "not.in.(incomplete,abandoned,restarted)"
    return filters, applied


def _render_export(file_format: str, dataset: str, rows: list[dict], details: dict) -> tuple[bytes, str]:
    columns = sorted({column for row in rows for column in row})
    title = f"LogiCade {dataset.title()} Report"
    metadata = [
        ("Generated (UTC)", details["generated_at"]), ("Dataset", dataset),
        ("Source", details["source"]), ("Records", len(rows)),
        ("Unique participants in selected records", details["sample_size"] if details["sample_size"] is not None else "Unavailable in this dataset"),
        ("Applied filters", details["filters"] or "All available records"),
        ("Missing values", "Blank cells represent missing values; zero and False are retained."),
        ("Metric definitions", "Gameplay scores are separate from formal assessment outcomes. Totals describe only the selected synchronized records."),
        ("Identifiers", "Participant IDs are stable pseudonyms where present; administrative actors remain identified in audit exports."),
    ]
    if file_format == "csv":
        output = io.StringIO(newline="")
        writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore", lineterminator="\r\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({column: _spreadsheet_value(row.get(column)) for column in columns})
        return ("\ufeff" + output.getvalue()).encode("utf-8"), "text/csv; charset=utf-8"
    if file_format == "xlsx":
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill
        book = Workbook()
        sheet = book.active
        sheet.title = dataset[:31]
        sheet.append(columns or ["No records"])
        for cell in sheet[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="24563A")
        for row in rows:
            sheet.append([_spreadsheet_value(row.get(column)) for column in columns])
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        info = book.create_sheet("Report Details")
        for key, value in metadata:
            info.append([key, _spreadsheet_value(value)])
        info.column_dimensions["A"].width = 42
        info.column_dimensions["B"].width = 100
        output = io.BytesIO()
        book.save(output)
        return output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if file_format == "docx":
        from docx import Document
        from docx.shared import Inches
        document = Document()
        section = document.sections[0]
        section.page_width, section.page_height = Inches(11), Inches(8.5)
        section.left_margin = section.right_margin = Inches(0.5)
        document.add_heading(title, 0)
        for key, value in metadata:
            document.add_paragraph(f"{key}: {_report_text(value)}")
        if not rows:
            document.add_paragraph("No records match the selected filters.")
        for start in range(0, len(columns), 6):
            band = columns[start:start + 6]
            if len(columns) > 6:
                document.add_heading(f"Fields {start + 1}–{start + len(band)}", 2)
            table = document.add_table(rows=1, cols=len(band) + 1)
            table.style = "Light Shading Accent 1"
            for cell, column in zip(table.rows[0].cells, ["Report row", *band]):
                cell.text = column
            for number, row in enumerate(rows, 1):
                cells = table.add_row().cells
                cells[0].text = str(number)
                for cell, column in zip(cells[1:], band):
                    cell.text = _report_text(row.get(column))
        output = io.BytesIO()
        document.save(output)
        return output.getvalue(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    from xml.sax.saxutils import escape
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape, letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet
    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=landscape(letter), title=title)
    style = getSampleStyleSheet()
    cell_style = style["BodyText"].clone("ExportCell", fontSize=7, leading=9, spaceAfter=0)
    paragraph = lambda value, selected_style=cell_style: Paragraph(escape(_report_text(value)).replace("\n", "<br/>"), selected_style)
    story = [Paragraph(escape(title), style["Title"])]
    story.extend(paragraph(f"{key}: {_report_text(value)}", style["BodyText"]) for key, value in metadata)
    story.append(Spacer(1, 12))
    if not rows:
        story.append(paragraph("No records match the selected filters.", style["BodyText"]))
    for start in range(0, len(columns), 6):
        band = columns[start:start + 6]
        if len(columns) > 6:
            story.append(paragraph(f"Fields {start + 1}–{start + len(band)}", style["Heading2"]))
        data = [[paragraph(column) for column in ["Report row", *band]]]
        data.extend([[paragraph(number), *[paragraph(row.get(column)) for column in band]] for number, row in enumerate(rows, 1)])
        table = Table(data, colWidths=[40] + [(doc.width - 40) / len(band)] * len(band), repeatRows=1, splitInRow=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DDECE2")),
            ("GRID", (0, 0), (-1, -1), .25, colors.grey), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.extend([table, Spacer(1, 12)])
    doc.build(story)
    return output.getvalue(), "application/pdf"


@app.get("/api/admin/report.{file_format}")
async def admin_export_document(
    file_format: str, x_admin_key: str | None = Header(default=None), dataset: str = "participants",
    date_from: str | None = None, date_to: str | None = None, week: int | None = Query(default=None, ge=1, le=9),
    difficulty: str | None = None, stratum: str | None = None, include_incomplete: bool = True,
) -> Response:
    base, key = _check_admin_key(x_admin_key)
    resources = {
        "participants": ("v_admin_participants", "created_at.desc,student_id.asc"),
        "levels": ("levels", "generated_at.desc,level_id.asc"),
        "attempts": ("level_attempts", "started_at.desc,attempt_id.asc"),
        "events": ("events", "created_at.desc,event_id.asc"),
        "coins": ("coin_transactions", "created_at.desc,transaction_id.asc"),
        "difficulty": ("difficulty_decisions", "decided_at.desc,decision_id.asc"),
        "audit": ("audit_logs", "created_at.desc,audit_id.asc"),
        "mechanics": ("v_admin_mechanics", "total_attempts.desc,week.asc,mechanic.asc"),
        "weekly": ("v_admin_weekly", "week.asc"),
    }
    if dataset not in resources or file_format not in {"csv", "xlsx", "pdf", "docx"}:
        raise HTTPException(status_code=422, detail="Unsupported export format or dataset")
    resource, order = resources[dataset]
    filters, applied = _export_filters(dataset, date_from, date_to, week, difficulty, stratum, include_incomplete)
    rows = await _export_rows(base, key, resource, order, filters)
    participants = {row["participant_id"] for row in rows if row.get("participant_id")}
    details = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "filters": applied, "source": f"Synchronized Supabase records: {resource}",
        "sample_size": len(participants) if participants else (0 if not rows else None),
    }
    try:
        body, media = _render_export(file_format, dataset, rows, details)
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=f"{file_format.upper()} export requires its optional document library on the server") from exc
    await _record_admin_audit(base, key, f"report.export.{file_format}", dataset,
        {"row_count": len(rows), "format": file_format, "pseudonymous": True,
         "filters": applied, "source": resource, "sample_size": details["sample_size"],
         "generated_at": details["generated_at"]},
        actor_id=_admin_audit_actor(x_admin_key), required=True)
    return Response(body, media_type=media, headers={"Content-Disposition": f'attachment; filename="logicade_{dataset}.{file_format}"', "Cache-Control": "no-store"})


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
    """Legacy URL; route through the pseudonymous export implementation."""
    return await admin_export_document("csv", x_admin_key, dataset,
        date_from=None, date_to=None, week=None, difficulty=None, stratum=None, include_incomplete=True)


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
async def serve(req: ServeRequest, authorization: str | None = Header(default=None)) -> dict:
    """Choose a matching fallback and reserve a fresh objective for this learner."""
    owner = _require_participant(authorization, req.student_id)
    if req.week == 1 and req.level > 2:
        raise HTTPException(status_code=404, detail="The opening region contains only its welcome video and flowchart stage")
    await _enforce_stage_difficulty(owner,req.week,req.level,req.difficulty)
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
        native_enabled = os.getenv("LOGICADE_NATIVE_CANVAS", "1").lower() not in {"0", "false", "no"}
        if native_enabled:
            if not _canvas_games:
                raise HTTPException(status_code=503, detail="The owned Canvas game library is unavailable")
            selected_id = await _reserve_canvas_description(owner, req, candidates)
        else:
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
        # Every study week uses the owned Canvas models. Curriculum availability
        # is reported independently from the game runtime and its difficulty.
        if native_enabled and not _canvas_games:
            raise HTTPException(status_code=503, detail="The owned Canvas game library is unavailable")
        if native_enabled:
            game = _find_canvas_game(str(spec.get("file_id") or ""))
            if game is None:
                raise HTTPException(status_code=503, detail="The selected fallback has no mirrored Canvas game definition")
            if (game.week, game.level, game.difficulty) != (req.week, req.level, req.difficulty):
                raise HTTPException(status_code=409, detail="Canvas game metadata does not match the selected level")
            description = describe_canvas_game(game, spec)
            meta = {"verification_result": "catalogue", "source_path": spec["source_path"],
                    "used": False, "generated": False, "week": req.week, "level": req.level,
                    "difficulty": req.difficulty, "generated_game": game.public_info(),
                    "game_description": description}
            meta['consumption_token']=_canvas_consumption_token(owner,game.file_id,game.content_revision)
            return {"spec": spec, "meta": meta}
        if not _generated_games:
            raise HTTPException(status_code=503, detail="The OpenCode game library is unavailable")
        async with _opencode_usage_lock:
            used_variations = _opencode_used_by_student.setdefault(owner, set())
            prior_used = set(used_variations)
            prior_last = _opencode_last_by_student.get(owner)
            all_variations = {
                game.variation_id
                for variations in _generated_games.values()
                for game in variations
            }
            if all_variations and all_variations.issubset(used_variations):
                previous = _opencode_last_by_student.get(owner)
                used_variations.clear()
                if previous in all_variations:
                    used_variations.add(previous)
                print(f"[serve] OpenCode variation cycle completed for student={owner}; starting a new cycle")
            generated_game = select_game(spec, _generated_games, excluded_ids=used_variations)
            if generated_game is None:
                raise HTTPException(status_code=503, detail="No OpenCode variation is available")
            # Reserve at level-node selection so a second click, Cancel, or a
            # concurrent tab cannot receive the same variation for this learner.
            used_variations.add(generated_game.variation_id)
            _opencode_last_by_student[owner] = generated_game.variation_id
            try:
                _save_opencode_usage()
            except OSError as exc:
                used_variations.clear()
                used_variations.update(prior_used)
                if prior_last:
                    _opencode_last_by_student[owner] = prior_last
                else:
                    _opencode_last_by_student.pop(owner, None)
                raise HTTPException(status_code=503, detail="Could not reserve a unique OpenCode game") from exc
        meta = {
            "verification_result": "catalogue",
            "source_path": spec["source_path"],
            "used": False,
            "generated": False,
            "week": req.week,
            "level": req.level,
            "difficulty": req.difficulty,
        }
        meta["generated_game"] = generated_game.public_info()
        meta["game_description"] = description_for_level(generated_game, spec)
        print(f"[serve] reserved OpenCode game {generated_game.slug}/{generated_game.variation_id} for student={owner}")
        return {"spec": spec, "meta": meta}


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
        if is_canvas_source(template):
            return None, {'fallback':True, 'generated':False, 'retryable':False,
                          'verification_result':'canvas_runtime_verification_required',
                          'error':'Native Canvas replacement requires the parameter proposal and runtime builder; legacy narrative generation is blocked'}
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
            _meta = {}
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
            if _meta.get('retryable') is False:
                print('[llm] background retry stopped: this source needs the Canvas authoring pipeline')
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
async def regenerate_game(req: RegenerateGameRequest, authorization: str | None = Header(default=None)) -> dict:
    """Explicit replay action: try three times, then retry every five minutes."""
    _require_participant(authorization)
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
        if is_canvas_source(original):
            raise HTTPException(status_code=409, detail='Canvas games use the verified stage pool. Native LLM replacement awaits parameter compilation and runtime verification; legacy prose generation is blocked.')

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
async def mark_game_used(req: MarkUsedRequest, authorization: str | None = Header(default=None)) -> dict:
    """Pop a used OpenCode ZIP and persist its variation in the learner's history."""
    owner = _require_participant(authorization)
    selected = _registry.get_by_id(req.file_id) if _registry else None
    if selected is None:
        raise HTTPException(status_code=404, detail="Used game was not found")
    filename = Path(str((selected or {}).get("source_path") or req.file_id)).name
    popped_package = False
    generated_game = None
    if req.generated_game_id:
        generated_game = _find_canvas_game(req.generated_game_id) or find_generated_game(req.generated_game_id, _generated_games)
        if generated_game is None:
            raise HTTPException(status_code=404, detail="Generated game variation is unavailable")
    native=_find_canvas_game(req.file_id)
    if native is not None:
        if req.generated_game_id and (generated_game is None or generated_game.file_id!=req.file_id):
            raise HTTPException(status_code=409,detail='Consumed Canvas variation does not match this game')
        revision=req.content_revision
        if not revision or not req.consumption_token:
            return {'ok':True,'file_id':req.file_id,'used':True,'package_popped':False,
                    'replacement':{'queued':False,'reason':'issued_revision_required_refresh_client'}}
        _check_canvas_consumption(req.consumption_token,owner,req.file_id,revision)
        lock=_game_package_locks.setdefault(req.file_id,asyncio.Lock())
        async with lock:
            native=_find_canvas_game(req.file_id)
            if native.content_revision==revision:
                _mark_generated_served({'file_id':req.file_id})
                popped_package=await asyncio.to_thread(_pop_opencode_sidecars,_source_path_for_game(selected),native.variation_id)
        replacement=await _enqueue_canvas_replacement(native,revision)
        print(f'[pool] consumed Canvas JSON: {filename}; revision={revision[:12]}; replacement queued={replacement["queued"]}')
        return {'ok':True,'file_id':req.file_id,'used':True,'package_popped':popped_package,'replacement':replacement}
    _mark_generated_served({"file_id": req.file_id})
    if generated_game is not None:
        if not generated_game.variation_id.startswith("canvas_"):
            async with _opencode_usage_lock:
                used_variations = _opencode_used_by_student.setdefault(owner, set())
                used_variations.add(generated_game.variation_id)
                _opencode_last_by_student[owner] = generated_game.variation_id
                try:
                    _save_opencode_usage()
                except OSError as exc:
                    raise HTTPException(status_code=503, detail="Could not save consumed game history") from exc
        if selected is not None:
            source_path = _source_path_for_game(selected)
            package_lock = _game_package_locks.setdefault(req.file_id, asyncio.Lock())
            async with package_lock:
                popped_package = await asyncio.to_thread(
                    _pop_opencode_sidecars, source_path, generated_game.variation_id,
                )
        print(f"[pool] popped used game: {generated_game.variation_id}; source JSON: {filename}")
    else:
        print(f"[pool] popped used JSON: {filename} (file_id={req.file_id})")
    return {"ok": True, "file_id": req.file_id, "used": True, "package_popped": popped_package}


@app.post("/api/games/consume-and-regenerate")
async def consume_and_regenerate(req: ConsumeGameRequest, authorization: str | None = Header(default=None)) -> dict:
    """Pop a lost game and replace its JSON in the matching fallback-pool folder."""
    _require_participant(authorization)
    registry = _registry
    if registry is None:
        raise HTTPException(status_code=503, detail="Game catalogue is unavailable")
    selected = registry.get_by_id(req.file_id)
    if selected is None:
        raise HTTPException(status_code=404, detail="Used game was not found")
    raw_source = str(selected.get("source_path") or "")
    source_path = (REPO_ROOT / raw_source).resolve()
    allowed_roots = [(REPO_ROOT / "data" / "fallback_pool").resolve()]
    if (source_path.suffix.lower() != ".json" or not source_path.is_file()
            or not any(source_path.is_relative_to(root) for root in allowed_roots)):
        raise HTTPException(status_code=409, detail="The used game has no valid JSON source")
    template = json.loads(source_path.read_text(encoding='utf-8'))
    if is_canvas_source(template):
        raise HTTPException(status_code=409, detail='Canvas games must use the stage pool and mark-used endpoint. Legacy prose generation cannot replace a verified Canvas challenge.')
    print(f"[pool] popped used JSON: {source_path.name} (file_id={req.file_id})")
    _mark_generated_served({"file_id": req.file_id})

    cached = _regeneration_results.get(req.request_id)
    if cached is not None:
        return cached
    lock = _regenerate_locks.setdefault(f"replacement:{req.file_id}", asyncio.Lock())
    async with lock:
        cached = _regeneration_results.get(req.request_id)
        if cached is not None:
            return cached
        template = json.loads(source_path.read_text(encoding="utf-8"))
        for attempt in range(1, 4):
            filename = source_path.name
            print(f"[{attempt}/3] Generating new JSON: {filename} replacement for JSON: {filename}")
            started = time.perf_counter()
            meta: dict = {}
            try:
                generated, meta = await _require_client().generate_template_game(
                    int(template["week"]), int(template["level"]), str(template["difficulty"]),
                    template_spec=template,
                )
                if meta.get("fallback") or meta.get("verification_result") != "llm_template":
                    raise ValueError(meta.get("error") or "LLM output did not pass game verification")
                file_id = str(template.get("file_id") or req.file_id)
                difficulty_key = str(template["difficulty"]).strip().lower().replace("-", " ").replace("_", " ")
                difficulty_dir = {"needs support": "needs_support", "need assistance": "needs_support",
                                  "standard": "standard", "advanced": "advanced", "advance": "advanced"}.get(difficulty_key)
                if not difficulty_dir:
                    raise ValueError(f"Unsupported difficulty folder: {template.get('difficulty')}")
                destination = (REPO_ROOT / "data" / "fallback_pool" / f"week_{int(template['week'])}"
                               / f"level{int(template['level'])}" / difficulty_dir / source_path.name)
                generated.update({"file_id": file_id, "game_id": file_id,
                                  "unique_identity_key": template.get("unique_identity_key"),
                                  "source_path": destination.relative_to(REPO_ROOT).as_posix()})
                entry = {**selected, "file_id": file_id, "game_id": file_id,
                         "unique_identity_key": template.get("unique_identity_key"),
                         "mission_type": generated.get("mission_type")}
                invalid = validate_game_definition(entry, generated)
                if invalid:
                    raise ValueError(f"Generated game failed validation: {invalid}")
                _write_json_atomically(destination, generated)
                selected.update(generated)
                selected["id"] = file_id
                selected["source_path"] = generated["source_path"]
                selected["metadata"] = {**selected.get("metadata", {}), "week": generated["week"],
                    "level": generated["level"], "difficulty": generated["difficulty"],
                    "mechanic": generated.get("primary_mechanic"), "mission_type": generated.get("mission_type")}
                elapsed_ms = int((time.perf_counter() - started) * 1000)
                await _persist_generation_log(file_id=file_id, source_path=destination,
                    attempt_label=f"{attempt}/3", outcome="verified_saved", duration_ms=elapsed_ms,
                    meta=meta, spec=generated)
                print(f"Generation JSON: {destination.name} is Complete sent to {destination}")
                result = {"spec": generated, "meta": {**meta, "generated": True,
                          "source_path": generated["source_path"], "replaces_file_id": req.file_id}}
                return _cache_regeneration_result(req.request_id, result)
            except Exception as exc:
                elapsed_ms = int((time.perf_counter() - started) * 1000)
                print(f"Generation {filename} failed: {type(exc).__name__}: {exc}")
                await _persist_generation_log(file_id=req.file_id, source_path=source_path,
                    attempt_label=f"{attempt}/3", outcome="generation_failed", duration_ms=elapsed_ms,
                    meta=meta, error=f"{type(exc).__name__}: {exc}", spec=template)
        print(f"Generation {source_path.name} failed, Generating again after 5mins")
        # Never hold a player's Repeat request open forever. Keep the existing
        # source playable while the replacement is retried in the background.
        task = _generation_retry_tasks.get(req.file_id)
        if task is None or task.done():
            _generation_retry_tasks[req.file_id] = asyncio.create_task(
                _retry_generation_until_success(req.file_id)
            )
        original_spec = {**template, "source_path": source_path.relative_to(REPO_ROOT).as_posix()}
        result = {
            "spec": original_spec,
            "meta": {**meta, "source_path": original_spec["source_path"],
                     "generated": False, "retrying": True, "attempts": 3},
        }
        return _cache_regeneration_result(req.request_id, result)


@app.post("/warm_pool")
async def warm_pool(req: WarmPoolRequest, x_admin_key: str | None = Header(default=None)) -> dict:
    _require_admin_auth(x_admin_key)
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
async def reset_pools(req: ResetPoolsRequest | None = None, x_admin_key: str | None = Header(default=None)) -> dict:
    _require_admin_auth(x_admin_key)
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


class MidtermSubmission(BaseModel):
    model_config = {"extra": "forbid"}
    attempt_token: str = Field(min_length=20, max_length=4096)
    answers: dict[str, object] = Field(max_length=50)


@app.get("/api/course/midterm")
async def start_cp1_midterm(authorization: str | None = Header(default=None)) -> dict:
    owner = _require_participant(authorization)
    bank = course_assessments.load_bank(CP1_MIDTERM_BANK_PATH)
    return {"bank": course_assessments.public_bank(bank),
            "attempt_token": course_assessments.issue_attempt(owner, bank, _session_secret())}


@app.post("/api/course/midterm")
async def submit_cp1_midterm(req: MidtermSubmission, authorization: str | None = Header(default=None)) -> dict:
    owner = _require_participant(authorization)
    bank = course_assessments.load_bank(CP1_MIDTERM_BANK_PATH)
    claims = course_assessments.verify_attempt(req.attempt_token, owner, bank, _session_secret())
    result = course_assessments.grade(bank, req.answers)
    base, key, httpx = await _account_db()
    completed = datetime.now(timezone.utc).isoformat()
    row = {"assessment_id": claims["assessment_id"], "student_id": owner,
           "instrument": f"cp1_midterm:{bank['id']}:{bank['version']}", "phase": "other",
           "score": result["score"], "maximum_score": result["maximum_score"], "completed_at": completed,
           "metadata": {"kind": "cp1_midterm", "bank_hash": claims["bank_hash"], "answers": req.answers,
                        "curriculum_version": course_lesson(9).get("curriculum_version"),
                        "result": result, "formal_assessment": True,
                        "audit": {"actor": owner, "action": "assessment.submitted", "timestamp": completed}}}
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
               "Prefer": "resolution=ignore-duplicates,return=representation"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(f"{base}/rest/v1/assessments", params={"on_conflict": "assessment_id"}, headers=headers, json=row)
            if not response.is_success:
                raise HTTPException(503, "The assessment could not be stored. Keep this session and retry.")
            rows = response.json()
            if rows == []:
                response = await client.get(f"{base}/rest/v1/assessments", headers=headers,
                    params={"assessment_id": f"eq.{claims['assessment_id']}", "student_id": f"eq.{owner}", "select": "*", "limit": "1"})
                if not response.is_success: raise HTTPException(503, "Could not confirm the saved assessment. Retry this submission.")
                rows = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(503, "Assessment storage is unavailable. Keep your answers and retry.") from exc
    if not isinstance(rows, list) or len(rows) != 1 or rows[0].get("student_id") != owner:
        raise HTTPException(503, "Could not confirm the saved assessment")
    saved = rows[0]
    await _record_admin_audit(base, key, "assessment.midterm.submitted", saved["assessment_id"],
        {"bank": bank["id"], "version": bank["version"], "score": saved["score"]},
        target_type="assessment", actor_id=owner)
    # The immutable assessment row contains its own atomic submission audit;
    # audit_logs is an additional operational projection, not the sole trail.
    stored = saved.get("metadata", {}).get("result", {})
    return {"assessment_id": saved["assessment_id"], "score": saved["score"],
            "maximum_score": saved["maximum_score"], "passed": stored.get("passed"),
            "formal_assessment": True, "grading_basis": "item_answers_only"}


@app.post("/api/admin/course/midterm-bank")
async def configure_cp1_midterm(bank: dict, x_admin_key: str | None = Header(default=None)) -> dict:
    base, key = _check_admin_key(x_admin_key)
    validated = course_assessments.validate_bank(bank)
    CP1_MIDTERM_BANK_PATH.parent.mkdir(parents=True, exist_ok=True)
    archive = CP1_MIDTERM_BANK_PATH.parent / "midterm_bank_versions" / validated["id"] / (validated["version"] + ".json")
    archive.parent.mkdir(parents=True, exist_ok=True)
    try:
        with archive.open("x", encoding="utf-8") as stream:
            json.dump(validated, stream, ensure_ascii=False, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
    except FileExistsError:
        try:
            existing = json.loads(archive.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise HTTPException(503, "The bank version is being saved; retry shortly") from exc
        if course_assessments.digest(existing) != course_assessments.digest(validated):
            raise HTTPException(409, "This bank version already exists. Use a new version for changed content or approval.")
    _write_json_atomically(CP1_MIDTERM_BANK_PATH, validated)
    await _record_admin_audit(base, key, "course.midterm_bank.updated", validated["id"],
        {"version": validated["version"], "approved": validated["approved"], "item_count": len(validated["items"])},
        target_type="course_config", actor_id=_admin_audit_actor(x_admin_key))
    return {"ok": True, "id": validated["id"], "version": validated["version"], "approved": validated["approved"]}


@app.get("/api/admin/course/midterm-bank")
async def cp1_midterm_bank_status(x_admin_key: str | None = Header(default=None)) -> dict:
    _check_admin_key(x_admin_key)
    try:
        bank = course_assessments.validate_bank(json.loads(CP1_MIDTERM_BANK_PATH.read_text(encoding="utf-8")))
    except (OSError, ValueError, HTTPException):
        return {"configured": False, "approved": False}
    return {"configured": True, "id": bank["id"], "version": bank["version"], "approved": bank["approved"], "item_count": len(bank["items"])}
