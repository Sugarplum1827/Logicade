"""Validate optional study telemetry without requiring it in older uploads."""

from datetime import datetime
from uuid import UUID

from fastapi import HTTPException

MAX_TIMING_MS = 86_400_000


def _int(value, limit: int) -> bool:
    return type(value) is int and 0 <= value <= limit


def validate_research_metrics(metrics) -> None:
    if metrics is None:
        return
    count_fields = ('scored_submissions', 'correct_submissions', 'response_sample_count')
    text_fields = ('objective_id', 'accuracy_basis')
    session_fields = ('session_duration_ms', 'session_inactive_ms')
    if not isinstance(metrics, dict) or set(metrics) - {*count_fields, *text_fields, *session_fields, 'session_id', 'active_play_ms', 'response_total_ms'}:
        raise HTTPException(422, 'Invalid attempt research metrics')
    for field in count_fields:
        if metrics.get(field) is not None and not _int(metrics[field], 2500):
            raise HTTPException(422, f'Invalid research {field}')
    for field in text_fields:
        if metrics.get(field) is not None and (not isinstance(metrics[field], str) or not 1 <= len(metrics[field]) <= 120):
            raise HTTPException(422, f'Invalid research {field}')
    try:
        if metrics.get('session_id') is not None:
            UUID(metrics['session_id'])
    except (TypeError, ValueError, AttributeError) as exc:
        raise HTTPException(422, 'Invalid learner session ID') from exc
    scored, correct, timed = (metrics.get(field) for field in count_fields)
    response = metrics.get('response_total_ms')
    active = metrics.get('active_play_ms')
    duration, inactive = (metrics.get(field) for field in session_fields)
    if ((scored is None) != (correct is None) or (scored is not None and not 0 <= correct <= scored)
        or (timed is None) != (response is None)
        or (timed is not None and (not 1 <= timed <= (scored or 0) or not _int(response, timed * MAX_TIMING_MS)))
        or (active is not None and not _int(active, MAX_TIMING_MS))
        or (duration is None) != (inactive is None)
        or (duration is not None and (metrics.get('session_id') is None or not _int(duration, 2_147_483_647) or not _int(inactive, duration)))):
        raise HTTPException(422, 'Inconsistent attempt research metrics')


def validate_session_checkpoint(row: dict) -> None:
    try:
        started = datetime.fromisoformat(row['started_at'])
        if started.utcoffset() is None:
            raise ValueError('timezone required')
    except (KeyError, TypeError, ValueError, OverflowError) as exc:
        raise HTTPException(422, 'Learner session requires a timestamp with a timezone') from exc
    duration, active, inactive = (row.get(field) for field in ('duration_ms', 'active_ms', 'inactive_ms'))
    if not all(_int(value, 2_147_483_647) for value in (duration, active, inactive)) or active + inactive > duration:
        raise HTTPException(422, 'Invalid learner session timing')


def validate_submission(payload: dict) -> None:
    target = payload.get('target')
    response = payload.get('response_ms')
    if (payload.get('kind') not in ('question', 'activity') or not isinstance(target, str) or not 1 <= len(target) <= 120
        or type(payload.get('correct')) is not bool or (response is not None and not _int(response, MAX_TIMING_MS))):
        raise HTTPException(422, 'Invalid scored submission')
