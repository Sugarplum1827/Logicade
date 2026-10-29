"""Deterministic difficulty engine — §10.

The LLM NEVER chooses difficulty. The engine is a pure function of exactly
three inputs: first_attempt_accuracy, full_level_replays, total_errors.

The table below is AUTHORITATIVE (60% boundary). The methodology narrative
pseudocode uses 0.50; we implement the table, not the pseudocode, and
document the reconciliation in the README.

    First-attempt accuracy | Full-level replays | Next difficulty
    -----------------------+--------------------+----------------
    < 60%                  | Any                | needs_support
    60% – <80%             | ≥ 2                | needs_support
    60% – <80%             | 0–1                | standard
    ≥ 80%                  | ≥ 2                | standard
    ≥ 80%                  | 0–1                | advanced

Notes:
  • All students begin Level 1 at 'standard' — the caller enforces this by
    not calling next_difficulty for level 1, or by seeding the first
    level's assigned difficulty to 'standard' explicitly.
  • Difficulty is fixed for the entire next level — no mid-level changes.
  • First-attempt score is retained as the signal; replays never overwrite.
  • A full-level replay = restarting/replaying the whole level after the
    first successful completion, and completing that replay. Individual
    activity/question retries do NOT count.
  • Stratum is never an input.

The `total_errors` parameter is part of the public signature for parity with
§10's "exactly three inputs" wording, but the authoritative table does not
read it. Callers should still pass it; it is reserved for a future
revision and is logged in `difficulty_divergence.client_inputs` (§14.10).

The v2 stage policy uses the first evaluated (completed or failed) run as
accuracy evidence. Abandoned/restarted/incomplete runs remain in raw history
and never become scored-zero evidence. Thresholds are unchanged.
"""

from __future__ import annotations

DIFFICULTIES = ("needs_support", "standard", "advanced")


def next_difficulty(
    first_attempt_accuracy: float,
    full_level_replays: int,
    total_errors: int = 0,
) -> str:
    """Return the next level's difficulty (§10 authoritative table)."""
    if not (0.0 <= first_attempt_accuracy <= 1.0):
        raise ValueError("first_attempt_accuracy must be in [0, 1]")
    if full_level_replays < 0:
        raise ValueError("full_level_replays must be >= 0")

    if first_attempt_accuracy < 0.60:
        return "needs_support"

    if first_attempt_accuracy < 0.80:
        return "needs_support" if full_level_replays >= 2 else "standard"

    # first_attempt_accuracy >= 0.80
    return "standard" if full_level_replays >= 2 else "advanced"
