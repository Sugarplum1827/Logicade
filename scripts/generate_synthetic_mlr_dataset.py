#!/usr/bin/env python3
"""Generate a clearly synthetic dataset to exercise the LogiCade MLR pipeline.

These rows are simulated from rubric-shaped scenarios. They are not learner
records, expert annotations, study findings, or suitable for live difficulty
selection. See docs/MLR_DIFFICULTY_TRAINING.md.
"""
from __future__ import annotations

import argparse
import csv
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path


LABELS = ("needs_support", "standard", "advanced")
OBJECTIVES = (
    "flowchart_sequence", "flowchart_decisions", "flowchart_loops",
    "algorithm_tracing", "c_variable_declaration", "c_assignment",
    "c_arithmetic", "c_local_global_scope",
)
DIFFICULTIES = ("needs_support", "standard", "advanced")
COLUMNS = [
    "decision_id", "participant_id", "decided_at", "target_week", "target_stage",
    "objective_id", "target_objective_id", "difficulty_before", "prior_attempt_count",
    "mistakes", "scored_submissions", "mistakes_per_submission", "hint_count_observed",
    "hint_opportunities", "hints_for_model", "completion_time_ms", "level_run_attempts",
    "accuracy", "accuracy_scored_checks", "first_try_success", "failure_rate_last_five",
    "failure_rate_evaluated_runs", "retries", "topic_mastery", "topic_mastery_task_count",
    "response_time_median_ms", "response_time_sample_count", "session_duration_context_ms",
    "inactivity_context_ms", "expert_label", "label_source", "synthetic",
]


def between(rng: random.Random, span: tuple[float, float], digits: int = 3) -> float:
    return round(rng.uniform(*span), digits)


def one_row(rng: random.Random, participant_index: int, decision_index: int,
            label: str, base_time_ms: int, base_date: datetime) -> dict:
    # Correlated signals are intentional: the training pipeline must evaluate
    # mixed features rather than assuming a single band determines the label.
    if label == "needs_support":
        mistakes = rng.randint(3, 6)
        hints_opportunities = rng.randint(3, 7)
        hints = rng.randint(3, min(6, hints_opportunities))
        time_ratio = between(rng, (1.27, 1.85))
        runs = rng.randint(3, 5)
        accuracy = between(rng, (.25, .59))
        first_try = rng.choice([0, 0, 0, 1])
        failures_n = rng.randint(3, 5)
        failure_rate = between(rng, (.55, .90))
        retries = rng.randint(3, 6)
        mastery = between(rng, (.20, .48))
        response_ratio = between(rng, (1.28, 1.90))
    elif label == "advanced":
        mistakes = rng.randint(0, 1)
        hints_opportunities = rng.randint(2, 6)
        hints = rng.randint(0, min(1, hints_opportunities))
        time_ratio = between(rng, (.55, .74))
        runs = 1
        accuracy = between(rng, (.82, 1.0))
        first_try = 1
        failures_n = rng.randint(3, 5)
        failure_rate = 0.0
        retries = rng.randint(0, 1)
        mastery = between(rng, (.82, 1.0))
        response_ratio = between(rng, (.55, .74))
    else:
        mistakes = rng.randint(1, 2)
        hints_opportunities = rng.randint(2, 6)
        hints = rng.randint(1, min(2, hints_opportunities))
        time_ratio = between(rng, (.80, 1.20))
        runs = 2
        accuracy = between(rng, (.62, .78))
        first_try = rng.choice([0, 0, 1, 1])
        failures_n = rng.randint(3, 5)
        failure_rate = between(rng, (.10, .48))
        retries = rng.randint(1, 2)
        mastery = between(rng, (.53, .77))
        response_ratio = between(rng, (.80, 1.20))

    # Inject limited feature noise so the model sees mixed signals, not a perfect
    # one-feature lookup. Expert labels remain synthetic scenario labels.
    if rng.random() < .16:
        mistakes = max(0, mistakes + rng.choice([-2, -1, 1, 2]))
    if rng.random() < .16:
        accuracy = min(1.0, max(0.0, accuracy + rng.choice([-.20, -.12, .10, .18])))
    if rng.random() < .14:
        hints = max(0, hints + rng.choice([-2, -1, 1, 2]))
        hints = min(hints, hints_opportunities)
    if rng.random() < .12:
        retries = max(0, retries + rng.choice([-2, -1, 1, 2]))
    if rng.random() < .12:
        response_ratio = max(.3, response_ratio + rng.choice([-.35, -.18, .2, .4]))

    scored = max(mistakes + rng.randint(1, 4), rng.randint(4, 9))
    correct = max(0, min(scored, round(accuracy * scored)))
    measured_accuracy = correct / scored
    week = 2 + ((participant_index + decision_index) % 8)
    stage = 1 + ((participant_index * 3 + decision_index) % 10)
    objective = OBJECTIVES[(week + stage + decision_index) % len(OBJECTIVES)]
    prior_difficulty = DIFFICULTIES[(participant_index + decision_index) % len(DIFFICULTIES)]
    target_objective = OBJECTIVES[(OBJECTIVES.index(objective) + 1) % len(OBJECTIVES)]
    completion_ms = int(base_time_ms * time_ratio)
    response_ms = int(18000 * response_ratio)
    decision_time = base_date + timedelta(minutes=participant_index * 17 + decision_index * 11)

    # Realistic missingness and denominators: missing is never converted to zero.
    accuracy_checks = scored if rng.random() > .04 else ""
    accuracy_value = measured_accuracy if accuracy_checks != "" else ""
    failure_eval_count = failures_n if rng.random() > .06 else ""
    failure_value = failure_rate if failure_eval_count != "" else ""
    mastery_tasks = rng.randint(3, 6) if rng.random() > .08 else ""
    mastery_value = mastery if mastery_tasks != "" else ""
    response_count = rng.randint(2, 8) if rng.random() > .14 else ""
    response_value = response_ms if response_count != "" else ""
    hints_enabled = rng.random() > .08
    hint_opportunities_value = hints_opportunities if hints_enabled else ""
    hints_value = hints if hints_enabled else ""
    accuracy_first_try = first_try if rng.random() > .05 else ""

    identity = f"SYNTH-P-{participant_index + 1:04d}"
    return {
        "decision_id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"logicade-synthetic:{identity}:{decision_index + 1}")),
        "participant_id": identity,
        "decided_at": decision_time.isoformat(),
        "target_week": week,
        "target_stage": stage,
        "objective_id": objective,
        "target_objective_id": target_objective,
        "difficulty_before": prior_difficulty,
        "prior_attempt_count": runs,
        "mistakes": mistakes,
        "scored_submissions": scored,
        "mistakes_per_submission": round(mistakes / scored, 4),
        "hint_count_observed": hints_value,
        "hint_opportunities": hint_opportunities_value,
        "hints_for_model": hints_value,
        "completion_time_ms": completion_ms,
        "level_run_attempts": runs,
        "accuracy": accuracy_value,
        "accuracy_scored_checks": accuracy_checks,
        "first_try_success": accuracy_first_try,
        "failure_rate_last_five": failure_value,
        "failure_rate_evaluated_runs": failure_eval_count,
        "retries": retries,
        "topic_mastery": mastery_value,
        "topic_mastery_task_count": mastery_tasks,
        "response_time_median_ms": response_value,
        "response_time_sample_count": response_count,
        "session_duration_context_ms": rng.randint(90_000, 1_800_000),
        "inactivity_context_ms": rng.randint(0, 300_000),
        "expert_label": label,
        "label_source": "synthetic_scenario_not_human_review",
        "synthetic": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("data/mlr/synthetic_demo_difficulty_training.csv"))
    parser.add_argument("--participants-per-class", type=int, default=40)
    parser.add_argument("--decisions-per-participant", type=int, default=5)
    parser.add_argument("--seed", type=int, default=20261108)
    args = parser.parse_args()
    if args.participants_per_class < 4 or args.decisions_per_participant < 1:
        parser.error("Use at least 4 participants per class and one decision per participant.")
    rng = random.Random(args.seed)
    base_date = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows = []
    participant_index = 0
    for label in LABELS:
        for _ in range(args.participants_per_class):
            base_time = rng.choice([90_000, 120_000, 180_000, 240_000])
            for decision_index in range(args.decisions_per_participant):
                rows.append(one_row(rng, participant_index, decision_index, label, base_time, base_date))
            participant_index += 1
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=COLUMNS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} SYNTHETIC demo decisions from {participant_index} synthetic participants: {args.out}")
    print("Labels are generated scenario labels, not instructor judgments or real LogiCade outcomes.")
    print("Do not use this dataset or its trained model for research findings or live learner difficulty.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
