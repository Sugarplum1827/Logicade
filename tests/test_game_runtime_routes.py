"""Check the real sandbox resource routes without opening a listening port."""

import asyncio
import json
import shutil
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

from server import main
from server.generated_games import discover_games


def package_app(monkeypatch, tmp_path):
    # These fixtures exercise the explicitly optional legacy runtime. Native
    # Canvas is the production default and has its own package-flow suite.
    monkeypatch.setenv("LOGICADE_NATIVE_CANVAS", "0")
    library = main.GENERATED_GAMES_ROOT
    original = main.REPO_ROOT / "data/fallback_pool/week_1/level1/standard/game_week1_level1_difficulty(Standard)_1.json"
    source = tmp_path / "data/fallback_pool/week_1/level1/standard" / original.name
    source.parent.mkdir(parents=True)
    shutil.copyfile(original, source)
    spec = json.loads(source.read_text(encoding="utf-8"))
    selected = {**spec, "source_path": source.relative_to(tmp_path).as_posix()}

    class Catalog:
        def get(self, *_args):
            return [selected]

        def get_by_id(self, file_id):
            return selected if file_id == spec["file_id"] else None

    cache = tmp_path / "cache"
    cache.mkdir()
    monkeypatch.setattr(main, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(main, "GAME_BUILD_CACHE", cache)
    monkeypatch.setattr(main, "OPENCODE_PACKAGE_BACKUPS", tmp_path / "backups")
    monkeypatch.setattr(main, "OPENCODE_USAGE_PATH", tmp_path / "usage.json")
    monkeypatch.setattr(main, "_registry", Catalog())
    monkeypatch.setattr(main, "_generated_games", discover_games(library))
    for name in ("_opencode_used_by_student", "_opencode_last_by_student", "_selection_queues", "_serve_locks", "_game_package_locks"):
        monkeypatch.setattr(main, name, {})
    monkeypatch.setattr(main, "_served_pool_ids", set())
    monkeypatch.setattr(main, "_opencode_usage_lock", asyncio.Lock())
    monkeypatch.setenv("LOGICADE_SESSION_SECRET", "test-only-session-secret")
    app = FastAPI()
    app.post("/serve")(main.serve)
    app.post("/api/games/prepare")(main.prepare_game)
    app.post("/api/games/release")(main.release_game)
    app.post("/api/games/mark-used")(main.mark_game_used)
    app.mount("/game-builds", CORSMiddleware(StaticFiles(directory=cache), allow_origins=["*"]))
    return app, source, spec


def test_shared_game_resources_are_available_to_an_opaque_sandbox():
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://logicade.test") as client:
            for path in (
                "/game-runtime/engine/play.js",
                "/game-runtime/engine/visuals.js",
                "/game-runtime/vendor/phaser.esm.min.js",
                "/game-runtime/public/data/asset_manifest.json",
            ):
                response = await client.get(path, headers={"Origin": "null"})
                assert response.status_code == 200, path
                assert response.headers.get("access-control-allow-origin") == "*", path
                assert response.content, path
    asyncio.run(run())


def test_participant_cannot_mint_another_starting_balance():
    with pytest.raises(HTTPException) as failure:
        asyncio.run(main._apply_coin_rows("https://database.invalid", "not-a-real-key", [{
            "transaction_id": str(uuid4()), "student_id": "A", "amount": 20,
            "reason": "starting_balance", "source": "gameplay", "level_id": str(uuid4()),
        }]))
    assert failure.value.status_code == 422


def test_sync_rejects_conflicting_completion_flags_before_database_access(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://database.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "not-a-real-key")
    monkeypatch.setenv("LOGICADE_SESSION_SECRET", "test-only-session-secret")
    token = main._issue_session("A")
    request = main.SyncBatchRequest(table="level_attempts", rows=[{
        "attempt_id": str(uuid4()), "level_id": str(uuid4()), "student_id": "A",
        "score": 0.5, "accuracy": 0.5, "completed": True, "status": "abandoned",
    }])
    with pytest.raises(HTTPException) as failure:
        asyncio.run(main.sync_batch(request, f"Bearer {token}"))
    assert failure.value.status_code == 422


def test_level_selection_package_launch_pop_and_release(monkeypatch, tmp_path):
    app, source, spec = package_app(monkeypatch, tmp_path)
    original = source.read_bytes()

    async def run():
        headers = {"Authorization": f"Bearer {main._issue_session('A')}"}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://logicade.test", headers=headers) as client:
            request = {"student_id": "A", "week": 1, "level": 1, "difficulty": "standard"}
            selected = await client.post("/serve", json=request)
            another = await client.post("/serve", json=request)
            assert selected.status_code == another.status_code == 200
            first_id = selected.json()["meta"]["generated_game"]["variation_id"]
            assert first_id != another.json()["meta"]["generated_game"]["variation_id"]
            package_request = {"file_id": spec["file_id"], "generated_game_id": first_id}
            prepared = await client.post("/api/games/prepare", json=package_request)
            assert prepared.status_code == 200, prepared.text
            package = prepared.json()
            assert package["runtime"] == "html5_package"
            response = await client.get(package["launch_url"], headers={"Origin": "null"})
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == "*"
            assert '/game-runtime/engine/play.js' in response.text
            base = package["launch_url"].rsplit("/", 1)[0]
            variation = await client.get(f"{base}/variation.json", headers={"Origin": "null"})
            assert variation.json()["variation_id"] == first_id
            assert variation.json()["question_bank"] == "./questions.json"
            assert (await client.get(f"{base}/questions.json")).json()["questions"]
            assert len(list((main.GAME_BUILD_CACHE / package["package_id"]).rglob('*'))) == 5
            popped = await client.post("/api/games/mark-used", json=package_request)
            assert popped.status_code == 200 and popped.json()["package_popped"]
            assert not source.with_suffix('.zip').exists()
            assert (await client.get(package["launch_url"])).status_code == 200
            first = await client.post("/api/games/release", json={"package_id": package["package_id"]})
            second = await client.post("/api/games/release", json={"package_id": package["package_id"]})
            assert first.json() == {"ok": True, "removed": True}
            assert second.json() == {"ok": True, "removed": False}
            assert (await client.get(package["launch_url"])).status_code == 404
    asyncio.run(run())
    assert source.read_bytes() == original


def test_concurrent_previews_keep_private_extracted_leases(monkeypatch, tmp_path):
    app, source, spec = package_app(monkeypatch, tmp_path)
    variations = [game.variation_id for games in main._generated_games.values() for game in games][:2]

    async def run():
        headers = {"Authorization": f"Bearer {main._issue_session('A')}"}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://logicade.test", headers=headers) as client:
            responses = await asyncio.gather(*[
                client.post("/api/games/prepare", json={"file_id": spec["file_id"], "generated_game_id": variations[i % 2]})
                for i in range(8)
            ])
            assert all(response.status_code == 200 for response in responses), [response.text for response in responses]
            leases = [response.json() for response in responses]
            assert len({lease['package_id'] for lease in leases}) == 8
            for i, lease in enumerate(leases):
                url = lease['launch_url'].rsplit('/', 1)[0] + '/variation.json'
                assert (await client.get(url)).json()['variation_id'] == variations[i % 2]
            await client.post('/api/games/release', json={'package_id': leases[0]['package_id']})
            remaining = await asyncio.gather(*[client.get(lease['launch_url']) for lease in leases[1:]])
            assert all(response.status_code == 200 for response in remaining)
    asyncio.run(run())


def test_admin_full_replay_metric_excludes_unfinished_replay_entries(monkeypatch):
    monkeypatch.setattr(main, "_check_admin_key", lambda _value: ("https://database.invalid", "test-key"))

    async def rows(_base, _key, resource, **kwargs):
        if resource == "v_admin_study_metrics":
            return [{"recorded_full_level_replays": 5}], 1
        assert kwargs["params"] == {"is_replay": "eq.true", "completed": "eq.true", "status": "eq.completed"}
        return [{}], 2

    monkeypatch.setattr(main, "_admin_rows", rows)
    result = asyncio.run(main.admin_study_metrics("unused"))
    assert result["metrics"]["recorded_full_level_replays"] == 2
    assert result["metrics"]["replay_attempts_started"] == 5
