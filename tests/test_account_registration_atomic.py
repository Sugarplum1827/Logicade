"""Account registration delegates participant, wallet and account creation to one RPC."""

import asyncio
import json

import httpx
import pytest
from fastapi import FastAPI

from server import main


REAL_CLIENT = httpx.AsyncClient


@pytest.fixture
def register_client(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://database.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-only-service-key")
    monkeypatch.setenv("LOGICADE_SESSION_SECRET", "test-only-session-secret")
    app = FastAPI()
    app.post("/api/auth/register")(main.register_account)

    def run(handler):
        calls = []

        def database(request):
            calls.append(request)
            return handler(request)

        monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: REAL_CLIENT(transport=httpx.MockTransport(database), **kwargs))

        async def request():
            async with REAL_CLIENT(transport=httpx.ASGITransport(app=app), base_url="http://logicade.test") as client:
                return await client.post("/api/auth/register", json={
                    "username": "learner_1", "student_number": "234-0001", "password": "long-password",
                })

        return asyncio.run(request()), calls

    return run


def test_registration_uses_one_atomic_rpc_and_returns_a_session(register_client):
    def success(request):
        payload = json.loads(request.content)
        return httpx.Response(200, json={
            "student_id": payload["p_student_id"], "username": "learner_1",
            "student_number": "234-0001", "balance": 20,
        })

    response, calls = register_client(success)
    assert response.status_code == 200
    assert response.json()["username"] == "learner_1"
    assert response.json()["student_number"] == "234-0001"
    assert response.json()["token"]
    assert len(calls) == 1
    assert calls[0].method == "POST"
    assert calls[0].url.path == "/rest/v1/rpc/register_app_account_atomic"
    payload = calls[0].read().decode()
    assert '"p_student_number":"234-0001"' in payload
    assert '"p_username":"learner_1"' in payload
    assert '"p_password_hash":"pbkdf2_sha256$310000$' in payload
    assert "long-password" not in payload


@pytest.mark.parametrize("body,status,detail", [
    ({"code": "23505", "message": "private unique detail"}, 409, "already registered"),
    ({"code": "PGRST202", "message": "private schema detail"}, 503, "migration 015"),
])
def test_registration_maps_database_conflict_and_missing_migration_without_leaking_details(
    register_client, body, status, detail,
):
    response, calls = register_client(lambda _: httpx.Response(409 if status == 409 else 404, json=body))
    assert response.status_code == status
    assert detail in response.json()["detail"]
    assert "private" not in response.text
    assert len(calls) == 1


def test_registration_rejects_an_unexpected_rpc_result(register_client):
    response, _ = register_client(lambda _: httpx.Response(200, json={"student_id": "P-OTHER"}))
    assert response.status_code == 502

