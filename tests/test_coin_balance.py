"""Read-only wallet endpoint checks with a fake PostgREST transport."""

import asyncio

import httpx
import pytest
from fastapi import FastAPI

from server import main


REAL_CLIENT = httpx.AsyncClient
LEDGER_ROW = {"student_id": "A", "coin_balance": 20, "coins_earned": 32, "coins_spent": 12}


@pytest.fixture
def balance_client(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://database.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-only-service-key")
    monkeypatch.setenv("LOGICADE_SESSION_SECRET", "test-only-session-secret")
    app = FastAPI()
    app.get("/api/coins/balance")(main.participant_coin_balance)

    def run(handler, *, token="participant", query=""):
        calls = []

        def database(request):
            calls.append(request)
            return handler(request)

        monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: REAL_CLIENT(transport=httpx.MockTransport(database), **kwargs))

        async def request():
            auth = {} if token is None else {"Authorization": "Bearer " + (
                main._issue_session("A") if token == "participant" else main._issue_session("admin", "admin") if token == "admin" else token)}
            async with REAL_CLIENT(transport=httpx.ASGITransport(app=app), base_url="http://logicade.test") as client:
                return await client.get("/api/coins/balance" + query, headers=auth)

        return asyncio.run(request()), calls

    return run


def test_balance_uses_only_the_signed_in_owner_and_preserves_real_totals(balance_client):
    response, calls = balance_client(lambda _: httpx.Response(200, json=[LEDGER_ROW]), query="?student_id=B")
    assert response.status_code == 200
    assert response.json() == {"ok": True, "student_id": "A", "balance": 20, "coins_earned": 32, "coins_spent": 12}
    assert response.headers["cache-control"] == "no-store"
    assert len(calls) == 1 and calls[0].method == "GET"
    request = calls[0]
    assert request.url.path == "/rest/v1/v_admin_coin_summary"
    assert dict(request.url.params) == {
        "select": "student_id,coin_balance,coins_earned,coins_spent", "student_id": "eq.A", "limit": "1",
    }
    assert request.headers["Authorization"] == "Bearer test-only-service-key"
    assert "test-only-service-key" not in response.text


@pytest.mark.parametrize("token,status", [(None, 401), ("broken-token", 401), ("admin", 403)])
def test_unauthorized_calls_never_reach_the_database(balance_client, token, status):
    response, calls = balance_client(lambda _: pytest.fail("unauthorized database request"), token=token)
    assert response.status_code == status
    assert calls == []


def test_unconfigured_ledger_is_unavailable_without_fabricating_coins(balance_client, monkeypatch):
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY")
    response, calls = balance_client(lambda _: pytest.fail("unconfigured database request"))
    assert response.status_code == 503 and "configured" in response.json()["detail"]
    assert "balance" not in response.json() and calls == []


def test_empty_ledger_is_unavailable_instead_of_resetting_the_wallet(balance_client):
    response, _ = balance_client(lambda _: httpx.Response(200, json=[]))
    assert response.status_code == 503 and "unavailable" in response.json()["detail"]
    assert "balance" not in response.json()


@pytest.mark.parametrize("data", [
    None, {}, {"coin_balance": 20}, [None], [LEDGER_ROW, LEDGER_ROW],
    [{**LEDGER_ROW, "student_id": "B"}], [{**LEDGER_ROW, "coin_balance": None}],
    [{**LEDGER_ROW, "coin_balance": True}], [{**LEDGER_ROW, "coin_balance": 20.0}],
    [{**LEDGER_ROW, "coins_earned": "32"}], [{**LEDGER_ROW, "coins_spent": -12}],
    [{**LEDGER_ROW, "coins_earned": -32}], [{**LEDGER_ROW, "coin_balance": 19}],
    [{**LEDGER_ROW, "coins_earned": 9007199254740992}],
])
def test_malformed_or_foreign_ledger_data_does_not_leak_or_fabricate_a_wallet(balance_client, data):
    response, _ = balance_client(lambda _: httpx.Response(200, json=data))
    assert response.status_code == 502
    assert set(response.json()) == {"detail"}
    assert "student_id" not in response.text and "coins_earned" not in response.text


def test_invalid_json_is_reported_without_an_internal_error(balance_client):
    response, _ = balance_client(lambda _: httpx.Response(200, content=b"not json"))
    assert response.status_code == 502


def test_upstream_rejection_is_useful_and_does_not_expose_database_details(balance_client):
    response, _ = balance_client(lambda _: httpx.Response(404, json={"code": "PGRST205", "details": "private database detail"}))
    assert response.status_code == 502 and "coin-summary view" in response.json()["detail"]
    assert "private database detail" not in response.text


def test_unreachable_database_is_reported_as_unavailable(balance_client):
    def unavailable(request):
        raise httpx.ConnectError("test-only network unavailable", request=request)

    response, _ = balance_client(unavailable)
    assert response.status_code == 503 and "cannot be reached" in response.json()["detail"]


def test_zero_ledger_is_a_real_balance_and_is_returned_unchanged(balance_client):
    response, _ = balance_client(lambda _: httpx.Response(200, json=[{
        "student_id": "A", "coin_balance": 0, "coins_earned": 20, "coins_spent": 20,
    }]))
    assert response.status_code == 200 and response.json()["balance"] == 0
