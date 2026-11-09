#!/usr/bin/env python3
"""Build a leakage-safe, pseudonymous MLR difficulty training CSV.

Input files are CSV exports from LogiCade Reports and Exports:
  research_attempts, difficulty, levels, and optionally events.
Instructor labels are kept separate in a CSV keyed by decision_id.

This script never invents missing measurements or labels. It only uses
attempts/events timestamped before each decision. See docs/MLR_DIFFICULTY_TRAINING.md.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
from typing import Any


LABELS = {"needs support": "needs_support", "needs_support": "needs_support",
          "need_help": "needs_support", "need help": "needs_support",
          "standard": "standard", "advance": "advanced", "advanced": "advanced",
          "insufficient evidence": "insufficient_evidence",
          "insufficient_evidence": "insufficient_evidence"}
EVALUATED = {"completed", "failed"}
DIFFICULTY_ALIASES = {"needsupport": "needs_support", "needassistance": "needs_support",
                      "standard": "standard", "advance": "advanced", "advanced": "advanced"}


def read_csv(path: Path | None) -> list[dict[str, str]]:
    if path is None:
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def num(row: dict, *keys: str) -> float | None:
    for key in keys:
        value = row.get(key)
        if value is None or str(value).strip() == "":
            continue
        try:
            result = float(value)
        except (TypeError, ValueError):
            continue
        if math.isfinite(result):
            return result
    return None


def integer(row: dict, *keys: str) -> int | None:
    value = num(row, *keys)
    return int(value) if value is not None and value >= 0 and value.is_integer() else None


def parse_json(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, json.JSONDecodeError):
        return {}


def timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return None  # timezone-free timestamps are unsafe for temporal cutoffs
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return None


def ratio(numerator: int | float | None, denominator: int | float | None) -> float | None:
    if numerator is None or denominator is None or denominator <= 0:
        return None
    return numerator / denominator


def canonical_difficulty(value: Any) -> str | None:
    text = re.sub(r"[ _-]", "", str(value or "").strip().lower())
    return DIFFICULTY_ALIASES.get(text)


def first_evaluated(rows: list[dict]) -> dict | None:
    evaluated = [r for r in rows if str(r.get("status", "")).lower() in EVALUATED]
    evaluated.sort(key=lambda r: (integer(r, "attempt_number") or 10**9,
                                 timestamp(r.get("started_at")) or datetime.max.replace(tzinfo=timezone.utc),
                                 str(r.get("attempt_id", ""))))
    return evaluated[0] if evaluated else None


def labels_by_decision(path: Path | None) -> dict[str, str]:
    result: dict[str, str] = {}
    for row in read_csv(path):
        decision_id = str(row.get("decision_id", "")).strip()
        raw = row.get("adjudicated_label") or row.get("expert_label") or ""
        if not decision_id:
            continue
        if decision_id in result:
            raise ValueError(f"Duplicate decision_id in labels file: {decision_id}")
        label = LABELS.get(str(raw).strip().lower())
        if raw and label is None:
            raise ValueError(f"Unsupported expert label {raw!r} for decision {decision_id}")
        if label:
            result[decision_id] = label
    return result


def build_event_responses(events: list[dict]) -> dict[str, list[tuple[datetime, str, float]]]:
    by_attempt: dict[str, list[tuple[datetime, str, float]]] = defaultdict(list)
    for event in events:
        if event.get("event_type") != "scored_submission":
            continue
        at = timestamp(event.get("created_at"))
        attempt_id = str(event.get("attempt_id", "")).strip()
        payload = parse_json(event.get("payload"))
        response_ms = num(payload, "response_ms")
        target = str(payload.get("target") or event.get("entity_id") or "").strip()
        if at and attempt_id and target and response_ms is not None and response_ms >= 0:
            by_attempt[attempt_id].append((at, target, response_ms))
    for values in by_attempt.values():
        values.sort(key=lambda item: item[0])
    return by_attempt


def get_attempt_time(row: dict) -> datetime | None:
    return timestamp(row.get("ended_at")) or timestamp(row.get("started_at"))


def make_features(decision: dict, attempts: list[dict], levels_by_id: dict[str, dict],
                  responses: dict[str, list[tuple[datetime, str, float]]], decision_at: datetime) -> dict:
    participant = str(decision.get("participant_id") or decision.get("student_id") or "").strip()
    inputs = parse_json(decision.get("inputs"))
    previous_level_id = str(decision.get("previous_level_id") or "").strip()
    target_level_id = str(decision.get("next_level_id") or "").strip()
    target_level = levels_by_id.get(target_level_id, {})
    prior_level = levels_by_id.get(previous_level_id, {})

    prior = [r for r in attempts if participant == str(r.get("participant_id") or r.get("student_id") or "").strip()
             and previous_level_id and str(r.get("level_id") or "").strip() == previous_level_id
             and (get_attempt_time(r) is not None and get_attempt_time(r) < decision_at)]
    prior.sort(key=lambda r: (integer(r, "attempt_number") or 10**9,
                              timestamp(r.get("started_at")) or datetime.max.replace(tzinfo=timezone.utc),
                              str(r.get("attempt_id", ""))))
    attempts_until_clear: list[dict] = []
    for row in prior:
        attempts_until_clear.append(row)
        if str(row.get("status", "")).lower() == "completed":
            break
    comparable_objectives = {str(r.get("objective_id") or "").strip() for r in prior if r.get("objective_id")}
    earlier = [r for r in attempts if participant == str(r.get("participant_id") or r.get("student_id") or "").strip()
               and (get_attempt_time(r) is not None and get_attempt_time(r) < decision_at)]
    comparable = [r for r in earlier if comparable_objectives and
                  str(r.get("objective_id") or "").strip() in comparable_objectives]

    # Aggregate the preceding stage. Keep exposure denominators for the model.
    measured = [r for r in prior if integer(r, "scored_submissions") is not None
                and integer(r, "correct_submissions") is not None]
    scored = sum(integer(r, "scored_submissions") or 0 for r in measured) if measured else None
    correct = sum(integer(r, "correct_submissions") or 0 for r in measured) if measured else None
    mistakes = (scored - correct) if scored is not None and correct is not None else None
    first = first_evaluated(prior)
    accuracy = num(first or {}, "submission_accuracy")
    if accuracy is None and first:
        accuracy = ratio(integer(first, "correct_submissions"), integer(first, "scored_submissions"))
    completion_rows = [r for r in prior if str(r.get("status", "")).lower() == "completed"
                       and num(r, "completion_time_ms", "active_play_ms") is not None]
    completion_rows.sort(key=lambda r: (integer(r, "attempt_number") or 10**9,
                                       timestamp(r.get("ended_at")) or datetime.max.replace(tzinfo=timezone.utc)))
    completion_ms = num(completion_rows[0], "completion_time_ms", "active_play_ms") if completion_rows else None

    evaluated_comparable = [r for r in comparable if str(r.get("status", "")).lower() in EVALUATED]
    evaluated_comparable.sort(key=lambda r: (get_attempt_time(r) or datetime.min.replace(tzinfo=timezone.utc),
                                             integer(r, "attempt_number") or 0))
    last_five = evaluated_comparable[-5:]
    fail_rate = (sum(str(r.get("status", "")).lower() == "failed" for r in last_five) / len(last_five)
                 if len(last_five) >= 3 else None)

    # Topic mastery follows the rubric's first-try successes / distinct relevant tasks.
    task_rows: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in comparable:
        if row.get("week") and row.get("stage_number"):
            task_rows[(str(row.get("week")), str(row.get("stage_number")))].append(row)
    task_firsts = [first_evaluated(group) for group in task_rows.values()]
    task_firsts = [r for r in task_firsts if r]
    mastery = (sum(str(r.get("status", "")).lower() == "completed" for r in task_firsts) / len(task_firsts)
               if len(task_firsts) >= 3 else None)

    # Response time uses the first measured submission per attempt and target.
    allowed_attempt_ids = {str(r.get("attempt_id")) for r in comparable if r.get("attempt_id")}
    response_values: list[float] = []
    for attempt_id in allowed_attempt_ids:
        seen_targets: set[str] = set()
        for at, target, response_ms in responses.get(attempt_id, []):
            if at >= decision_at:
                continue
            if target in seen_targets:
                continue
            seen_targets.add(target)
            response_values.append(response_ms)
    response_median = median(response_values) if response_values else None

    # Hint opportunities are not currently present in the research-attempt export.
    # Preserve observed counts separately; only publish model-eligible hints when
    # an export explicitly supplies a positive opportunities/available count.
    observed_hints = sum(integer(r, "hint_count") or 0 for r in prior) if prior else None
    opportunities_values = [integer(r, "hint_opportunities", "hints_available") for r in prior]
    opportunities_values = [v for v in opportunities_values if v is not None]
    opportunities = sum(opportunities_values) if opportunities_values else None
    hints_for_model = observed_hints if opportunities is not None and opportunities > 0 else None

    retries_parts = [integer(r, "question_retry_count") for r in prior]
    retries_parts += [integer(r, "activity_retry_count", "activity_retries") for r in prior]
    retry_values = [v for v in retries_parts if v is not None]
    retries = sum(retry_values) if retry_values else None

    # Session fields are retained for audit/context, never used by the trainer.
    session_duration = max((num(r, "session_duration_so_far_ms") for r in prior
                            if num(r, "session_duration_so_far_ms") is not None), default=None)
    inactivity = max((num(r, "session_inactive_so_far_ms") for r in prior
                      if num(r, "session_inactive_so_far_ms") is not None), default=None)
    difficulty_before = canonical_difficulty(decision.get("difficulty_before")) or canonical_difficulty(
        prior[0].get("difficulty_served") if prior else None)

    target_objective = (target_level.get("learning_objective_id") or target_level.get("objective_id")
                        or target_level.get("learning_topic") or "")
    return {
        "decision_id": decision.get("decision_id", ""),
        "participant_id": participant,
        "decided_at": decision_at.isoformat(),
        "target_week": integer(inputs, "selected_week") or integer(target_level, "week"),
        "target_stage": integer(inputs, "selected_level") or integer(target_level, "stage_number"),
        "objective_id": next(iter(comparable_objectives), "") if len(comparable_objectives) == 1 else "",
        "target_objective_id": str(target_objective),
        "difficulty_before": difficulty_before or "",
        "prior_attempt_count": len(prior) if prior else None,
        "mistakes": mistakes,
        "scored_submissions": scored,
        "mistakes_per_submission": ratio(mistakes, scored),
        "hint_count_observed": observed_hints,
        "hint_opportunities": opportunities,
        "hints_for_model": hints_for_model,
        "completion_time_ms": completion_ms,
        "level_run_attempts": len(attempts_until_clear) if attempts_until_clear else None,
        "accuracy": accuracy,
        "accuracy_scored_checks": integer(first or {}, "scored_submissions"),
        "first_try_success": (1 if str(first.get("status", "")).lower() == "completed" else 0) if first else None,
        "failure_rate_last_five": fail_rate,
        "failure_rate_evaluated_runs": len(last_five) if len(last_five) >= 3 else None,
        "retries": retries,
        "topic_mastery": mastery,
        "topic_mastery_task_count": len(task_firsts) if len(task_firsts) >= 3 else None,
        "response_time_median_ms": response_median,
        "response_time_sample_count": len(response_values) if response_values else None,
        "session_duration_context_ms": session_duration,
        "inactivity_context_ms": inactivity,
        "expert_label": "",
    }


def write_csv(path: Path, rows: list[dict], columns: list[str] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = columns or list(rows[0].keys()) if rows else columns or []
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--attempts", required=True, type=Path, help="Pseudonymous research_attempts CSV export")
    parser.add_argument("--decisions", required=True, type=Path, help="Pseudonymous difficulty CSV export")
    parser.add_argument("--levels", required=True, type=Path, help="Pseudonymous levels CSV export")
    parser.add_argument("--events", type=Path, help="Optional events CSV; needed for response-time medians")
    parser.add_argument("--labels", type=Path, help="Adjudicated instructor labels CSV keyed by decision_id")
    parser.add_argument("--out", type=Path, default=Path("data/mlr/difficulty_training.csv"))
    parser.add_argument("--labels-template", type=Path, default=Path("data/mlr/expert_labels_template.csv"))
    args = parser.parse_args()
    try:
        attempts, decisions, levels = read_csv(args.attempts), read_csv(args.decisions), read_csv(args.levels)
        events = read_csv(args.events)
        labels = labels_by_decision(args.labels)
        levels_by_id = {str(r.get("level_id", "")).strip(): r for r in levels if r.get("level_id")}
        responses = build_event_responses(events)
        output: list[dict] = []
        old_template = {str(r.get("decision_id", "")).strip(): r for r in read_csv(args.labels_template)
                        if str(r.get("decision_id", "")).strip()} if args.labels_template.exists() else {}
        labels_template: list[dict] = []
        seen: set[str] = set()
        skipped = 0
        for decision in decisions:
            decision_id = str(decision.get("decision_id", "")).strip()
            at = timestamp(decision.get("decided_at"))
            if not decision_id or not at:
                skipped += 1
                continue
            if decision_id in seen:
                raise ValueError(f"Duplicate decision_id in decisions export: {decision_id}")
            seen.add(decision_id)
            features = make_features(decision, attempts, levels_by_id, responses, at)
            features["expert_label"] = labels.get(decision_id, "")
            output.append(features)
            previous_label = old_template.get(decision_id, {})
            labels_template.append({"decision_id": decision_id,
                                    "expert_label": previous_label.get("expert_label", ""),
                                    "evidence_note": previous_label.get("evidence_note", "")})
        if not output:
            raise ValueError("No valid decision rows found. Export decisions with decision_id and timezone-aware decided_at.")
        write_csv(args.out, output)
        write_csv(args.labels_template, labels_template,
                  ["decision_id", "expert_label", "evidence_note"])
        print(f"Wrote {len(output)} decision rows to {args.out}")
        print(f"Wrote blank instructor-label template to {args.labels_template}")
        print(f"Skipped {skipped} decisions with missing IDs/timestamps; labeled {sum(bool(r['expert_label']) for r in output)} rows")
        print("Pseudonymous IDs only. Review measurement coverage and adjudicate labels before training.")
        return 0
    except (OSError, ValueError, csv.Error) as exc:
        print(f"dataset build failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
