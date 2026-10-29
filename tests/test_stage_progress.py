"""Cross-device stage progress is derived from authenticated Supabase rows."""

import asyncio
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI

from server import main


REAL_CLIENT = httpx.AsyncClient
LEVEL_ONE = str(uuid4())
LEVEL_TWO = str(uuid4())


@pytest.fixture
def progress_client(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://database.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-only-service-key")
    monkeypatch.setenv("LOGICADE_SESSION_SECRET", "test-only-session-secret")
    app = FastAPI()
    app.get("/api/progress/stages")(main.participant_stage_progress)

    def run(handler, *, token="participant", extra_query="", week=1):
        calls = []

        def database(request):
            calls.append(request)
            return handler(request)

        monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: REAL_CLIENT(transport=httpx.MockTransport(database), **kwargs))

        async def request():
            auth = {} if token is None else {"Authorization": "Bearer " + (
                main._issue_session("A") if token == "participant"
                else main._issue_session("admin", "admin") if token == "admin" else token
            )}
            async with REAL_CLIENT(transport=httpx.ASGITransport(app=app), base_url="http://logicade.test") as client:
                return await client.get(f"/api/progress/stages?week={week}" + extra_query, headers=auth)

        return asyncio.run(request()), calls

    return run


def test_progress_is_owner_and_week_scoped_and_reports_incomplete_stage(progress_client):
    def database(request):
        if request.url.path.endswith("/levels"):
            assert request.url.params["student_id"] == "eq.A"
            assert request.url.params["week"] == "eq.1"
            assert request.url.params["stage_number"] == "not.is.null"
            return httpx.Response(200, json=[
                {"level_id": LEVEL_ONE, "stage_number": 1},
                {"level_id": LEVEL_TWO, "stage_number": 2},
            ])
        assert request.url.path.endswith("/level_attempts")
        assert request.url.params["student_id"] == "eq.A"
        level_id = request.url.params["level_id"]
        return httpx.Response(200, json=[{"level_id": LEVEL_ONE}] if level_id == f"eq.{LEVEL_ONE}" else [])

    response, calls = progress_client(database, extra_query="&student_id=OTHER")
    assert response.status_code == 200
    assert response.json() == {
        "ok": True, "week": 1, "started_stages": [1, 2], "completed_stages": [1],
        "active_stage": 2, "next_stage": 2, "current_stage": 2, "study_complete": False,
    }
    assert len(calls) == 3
    assert response.headers["cache-control"] == "no-store"


def test_empty_progress_starts_at_stage_one(progress_client):
    response, calls = progress_client(lambda _: httpx.Response(200, json=[]))
    assert response.status_code == 200
    assert response.json()["completed_stages"] == []
    assert response.json()["current_stage"] == 1
    assert response.json()["next_stage"] == 1
    assert calls and len(calls) == 1


def test_kingdom_finishes_after_two_stages_and_never_recommends_retired_stage_three(progress_client):
    def database(request):
        if request.url.path.endswith('/levels'):
            return httpx.Response(200,json=[{'level_id':LEVEL_ONE,'stage_number':1},
                {'level_id':LEVEL_TWO,'stage_number':2},{'level_id':'retired','stage_number':3}])
        assert request.url.params['level_id']!='eq.retired'
        return httpx.Response(200,json=[{'level_id':request.url.params['level_id'][3:]}])
    response,_=progress_client(database)
    data=response.json()
    assert data['completed_stages']==[1,2] and data['started_stages']==[1,2]
    assert data['study_complete'] is True
    assert data['current_stage']==2 and data['next_stage'] is None and data['active_stage'] is None


def test_later_weeks_require_all_ten_stages_and_recommend_a_missing_stage(progress_client):
    def database(request):
        if request.url.path.endswith('/levels'):
            return httpx.Response(200,json=[{'level_id':LEVEL_TWO,'stage_number':2}])
        return httpx.Response(200,json=[{'level_id':LEVEL_TWO}])
    response,_=progress_client(database,week=2)
    data=response.json()
    assert data['study_complete'] is False and data['next_stage']==1


@pytest.mark.parametrize("token,status", [(None, 401), ("broken", 401), ("admin", 403)])
def test_progress_requires_participant_session_before_database_access(progress_client, token, status):
    response, calls = progress_client(lambda _: pytest.fail("unauthenticated progress must not query the database"), token=token)
    assert response.status_code == status
    assert calls == []
