"""Validate participant ownership before privileged PostgREST writes."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException

PRIMARY_KEYS = {
    "levels": "level_id", "level_attempts": "attempt_id", "events": "event_id",
    "coin_transactions": "transaction_id", "difficulty_decisions": "decision_id",
}


def _uuid(value: object, field: str) -> str:
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid {field}") from exc


async def validate_sync_ownership(client, base: str, headers: dict, table: str, rows: list[dict], owner: str) -> None:
    """Check immutable row ownership and every supplied level/attempt link.

    RLS is bypassed by the server credential, so matching only the submitted
    student_id is insufficient: IDs might reference another learner's rows.
    """
    if any(row.get("student_id") != owner for row in rows):
        raise HTTPException(status_code=403, detail="Records must belong to the signed-in participant")
    if table == "students":
        return
    primary = PRIMARY_KEYS[table]
    ids = {_uuid(row.get(primary), primary) for row in rows}

    async def lookup(resource: str, key: str, values: set[str], columns: str) -> list[dict]:
        if not values:
            return []
        response = await client.get(f"{base}/rest/v1/{resource}", headers=headers, params={
            "select": columns, key: f"in.({','.join(sorted(values))})", "limit": "1000",
        })
        if not response.is_success:
            raise HTTPException(status_code=502, detail=f"Could not validate {resource} ownership")
        try:
            result = response.json()
        except ValueError as exc:
            raise HTTPException(status_code=502, detail="Database returned invalid ownership data") from exc
        if not isinstance(result, list) or any(not isinstance(row, dict) for row in result):
            raise HTTPException(status_code=502, detail="Database returned invalid ownership data")
        return result

    columns = f"{primary},student_id"
    if table == "levels":
        columns += ",stage_number"
    if table == "coin_transactions":
        columns += ",amount,reason,level_id,attempt_id"
    existing = await lookup(table, primary, ids, columns)
    if any(row.get("student_id") != owner for row in existing):
        raise HTTPException(status_code=403, detail="A record ID belongs to another participant")
    if table == "levels":
        original_stages = {str(row[primary]): row.get("stage_number") for row in existing}
        submitted_stages: dict[str, int] = {}
        for row in rows:
            stage_number = row.get("stage_number")
            if stage_number is None:
                continue
            level_id = _uuid(row.get(primary), primary)
            if level_id in submitted_stages and submitted_stages[level_id] != stage_number:
                raise HTTPException(status_code=409, detail="A level ID cannot be assigned to multiple stages")
            submitted_stages[level_id] = stage_number
            existing_stage = original_stages.get(level_id)
            if existing_stage is not None and existing_stage != stage_number:
                raise HTTPException(status_code=409, detail="A synchronized level cannot be reassigned to a different stage")
    if table == "coin_transactions":
        original = {str(row[primary]): row for row in existing}
        for row in rows:
            previous = original.get(_uuid(row[primary], primary))
            if previous and any(previous.get(key) != row.get(key) for key in ("amount", "reason", "level_id", "attempt_id")):
                raise HTTPException(status_code=409, detail="A coin transaction ID cannot be reused for a different purchase")

    level_fields = ("previous_level_id", "next_level_id") if table == "difficulty_decisions" else ("level_id",)
    level_ids = {
        _uuid(row[field], field)
        for row in rows for field in level_fields
        if table != "levels" and row.get(field) is not None
    }
    if table in {"level_attempts", "events"} and any(not row.get("level_id") for row in rows):
        raise HTTPException(status_code=422, detail="Gameplay records require a level ID")
    levels = await lookup("levels", "level_id", level_ids, "level_id,student_id")
    owned_levels = {str(row["level_id"]) for row in levels if row.get("student_id") == owner}
    if level_ids - owned_levels:
        raise HTTPException(status_code=409, detail="A referenced level is not synchronized for this participant")

    attempt_ids = {
        _uuid(row["attempt_id"], "attempt_id") for row in rows
        if table in {"events", "coin_transactions"} and row.get("attempt_id") is not None
    }
    attempts = await lookup("level_attempts", "attempt_id", attempt_ids, "attempt_id,level_id,student_id")
    owned_attempts = {str(row["attempt_id"]): row for row in attempts if row.get("student_id") == owner}
    if attempt_ids - owned_attempts.keys():
        raise HTTPException(status_code=409, detail="A referenced attempt is not synchronized for this participant")
    for row in rows:
        if table in {"events", "coin_transactions"} and row.get("attempt_id"):
            attempt = owned_attempts[_uuid(row["attempt_id"], "attempt_id")]
            if row.get("level_id") and str(attempt.get("level_id")) != _uuid(row["level_id"], "level_id"):
                raise HTTPException(status_code=422, detail="The event or coin transaction references a different attempt level")
