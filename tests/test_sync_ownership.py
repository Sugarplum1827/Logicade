"""Exercise privileged sync checks against a fake PostgREST transport."""

import asyncio
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException

from server.sync_validation import PRIMARY_KEYS, validate_sync_ownership


LEVEL = str(uuid4())
OTHER_LEVEL = str(uuid4())
ATTEMPT = str(uuid4())
EVENT = str(uuid4())
TRANSACTION = str(uuid4())


def validate(table, rows, records=None):
    calls = []
    records = records or {}

    def handler(request):
        calls.append(request)
        resource = request.url.path.rsplit("/", 1)[-1]
        primary = PRIMARY_KEYS[resource]
        requested = request.url.params[primary][4:-1].split(",")
        return httpx.Response(200, json=[row for row in records.get(resource, []) if row[primary] in requested])

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await validate_sync_ownership(client, "https://database.invalid", {}, table, rows, "A")

    asyncio.run(run())
    return calls


def test_foreign_primary_id_cannot_be_reassigned():
    with pytest.raises(HTTPException) as failure:
        validate("levels", [{"level_id": LEVEL, "student_id": "A"}], {
            "levels": [{"level_id": LEVEL, "student_id": "B"}],
        })
    assert failure.value.status_code == 403


def test_level_stage_assignment_cannot_be_changed_after_sync():
    with pytest.raises(HTTPException) as failure:
        validate("levels", [{"level_id": LEVEL, "student_id": "A", "stage_number": 2}], {
            "levels": [{"level_id": LEVEL, "student_id": "A", "stage_number": 1}],
        })
    assert failure.value.status_code == 409


def test_legacy_level_without_stage_can_receive_first_stage_assignment():
    validate("levels", [{"level_id": LEVEL, "student_id": "A", "stage_number": 1}], {
        "levels": [{"level_id": LEVEL, "student_id": "A", "stage_number": None}],
    })


def test_duplicate_level_rows_cannot_assign_different_stages():
    with pytest.raises(HTTPException) as failure:
        validate("levels", [
            {"level_id": LEVEL, "student_id": "A", "stage_number": 1},
            {"level_id": LEVEL, "student_id": "A", "stage_number": 2},
        ])
    assert failure.value.status_code == 409


def test_attempt_cannot_reference_another_participants_level():
    with pytest.raises(HTTPException) as failure:
        validate("level_attempts", [{"attempt_id": ATTEMPT, "level_id": LEVEL, "student_id": "A"}], {
            "levels": [{"level_id": LEVEL, "student_id": "B"}],
        })
    assert failure.value.status_code == 409


def test_event_requires_its_attempt_and_level_to_match():
    with pytest.raises(HTTPException) as failure:
        validate("events", [{"event_id": EVENT, "student_id": "A", "level_id": LEVEL, "attempt_id": ATTEMPT}], {
            "levels": [{"level_id": LEVEL, "student_id": "A"}],
            "level_attempts": [{"attempt_id": ATTEMPT, "student_id": "A", "level_id": OTHER_LEVEL}],
        })
    assert failure.value.status_code == 422


def test_valid_event_ownership_chain_is_accepted():
    calls = validate("events", [{"event_id": EVENT, "student_id": "A", "level_id": LEVEL, "attempt_id": ATTEMPT}], {
        "levels": [{"level_id": LEVEL, "student_id": "A"}],
        "level_attempts": [{"attempt_id": ATTEMPT, "student_id": "A", "level_id": LEVEL}],
    })
    assert len(calls) == 3


def test_coin_id_cannot_be_reused_for_a_different_purchase():
    with pytest.raises(HTTPException) as failure:
        validate("coin_transactions", [{
            "transaction_id": TRANSACTION, "student_id": "A", "level_id": LEVEL,
            "amount": -6, "reason": "hint_used", "attempt_id": None,
        }], {"coin_transactions": [{
            "transaction_id": TRANSACTION, "student_id": "A", "level_id": OTHER_LEVEL,
            "amount": -6, "reason": "hint_used", "attempt_id": None,
        }]})
    assert failure.value.status_code == 409


def test_malformed_parent_uuid_is_rejected_before_postgrest_filtering():
    with pytest.raises(HTTPException) as failure:
        validate("events", [{"event_id": EVENT, "student_id": "A", "level_id": "x),student_id.eq.B"}])
    assert failure.value.status_code == 422
