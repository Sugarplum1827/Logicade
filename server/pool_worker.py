"""Self-replenishing pre-generation pool (§12) — LILO / FIFO variant."""

from __future__ import annotations

import asyncio
import copy
import json
import random
import re
from collections import deque
from pathlib import Path
from typing import Awaitable, Callable

from .llm_client import _load_fallback
from .shuffler import build_brief
from .verifier import compute_fingerprint, verify

REPO_ROOT = Path(__file__).resolve().parent.parent
DIVERSE_DIR = REPO_ROOT / "data" / "fallback_pool"

POOL_DEPTH = 10
DIFFICULTIES = ("needs_support", "standard", "advanced")

Generator = Callable[
    [dict, int, str, list[str]],
    Awaitable[tuple[dict, dict]],
]


# ── Diversity helpers ────────────────────────────────────────────────

def _load_diverse_for_week(week: int, difficulty: str) -> list[dict]:
    """Load diverse fallback games, stamped for THIS pool's week + difficulty.

    The base games were generated with their own week/difficulty/map. We
    rewrite only those top-level metadata fields so the verifier accepts
    them in any pool. The RULES stay untouched — that's the diversity.
    """
    from .grammar import load_week, load_registry

    games: list[dict] = []
    if not DIVERSE_DIR.exists():
        return games

    registry = load_registry()
    week_cfg = load_week(week)
    valid_maps = [
        m["id"] for m in registry["tilemaps"]
        if week in m["allowed_contexts"]
    ]
    if not valid_maps:
        return games

    for f in sorted(DIVERSE_DIR.glob("game_*.json")):
        try:
            spec = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue

        spec["week"] = week
        spec["difficulty"] = difficulty
        spec["concept"] = week_cfg["concept"]
        spec["ilo"] = week_cfg["ilo"][0]

        if spec.get("map") not in valid_maps:
            spec["map"] = valid_maps[0]

        games.append(spec)

    return games

def _perturb_win(spec: dict, seen: set[str]) -> dict:
    """Return a copy with a unique fingerprint, capped to a reachable win."""
    if compute_fingerprint(spec) not in seen:
        return spec

    # Compute the maximum score achievable given the rules
    max_score = 0
    for rule in spec.get("rules", []):
        for e in rule.get("then", []):
            em = re.match(r"score\s*\+=\s*(\d+)", str(e))
            if em:
                max_score += int(em.group(1))

    if max_score == 0:
        return copy.deepcopy(spec)

    # Perturb only within [1, max_score]
    for op in (">=", "==", ">"):
        for n in range(1, max_score + 1):
            variant = copy.deepcopy(spec)
            if op == ">":
                variant["win"] = f"score > {max(1, n - 1)}"
            else:
                variant["win"] = f"score {op} {n}"
            if compute_fingerprint(variant) in seen:
                continue
            # Re-verify before accepting
            week = spec.get("week", 1)
            difficulty = spec.get("difficulty", "standard")
            try:
                if verify(variant, week, difficulty)["pass"]:
                    return variant
            except Exception:
                continue

    return copy.deepcopy(spec)


# ── Single pool per (student, week, difficulty) ──────────────────────

class SelfReplenishingPool:
    def __init__(self, student_id: str, week: int, difficulty: str,
                 generator: Generator):
        self.student_id = student_id
        self.week = week
        self.difficulty = difficulty
        self._gen = generator
        self._queue: deque[dict] = deque()
        self._used: set[str] = set()
        self._served: deque[str] = deque(maxlen=10)   # only served fingerprints
        self._lock = asyncio.Lock()
        self._refill_in_flight = 0
        self._served_count = 0
        self._llm_served = 0
        self._fallback_served = 0
        self._bootstrap()

    # ── Bootstrap ────────────────────────────────────────────────────
    def _bootstrap(self) -> None:
        """Load POOL_DEPTH items into the queue (shuffled diverse fallbacks)."""
        diverse = _load_diverse_for_week(self.week, self.difficulty)
        # If we don't have enough diverse games for this week, fill with
        # perturbed copies of the canonical week-difficulty fallback.
        if len(diverse) < POOL_DEPTH:
            canonical = _load_fallback(self.week, self.difficulty, [])
            while len(diverse) < POOL_DEPTH:
                variant = copy.deepcopy(canonical)
                # Slight structural perturbation so fingerprints differ
                for i, rule in enumerate(variant.get("rules", [])):
                    if "collision(" in rule.get("on", "") and i > 0:
                        rule["on"] = rule["on"].replace(
                            "coin", f"coin_{len(diverse)}_{i}"
                        )
                # Keep win reachable
                max_score = 0
                for rule in variant.get("rules", []):
                    for e in rule.get("then", []):
                        em = re.match(r"score\s*\+=\s*(\d+)", str(e))
                        if em:
                            max_score += int(em.group(1))
                variant["win"] = f"score >= {min(max_score, 2 + len(diverse) % 5)}"
                diverse.append(variant)

        random.shuffle(diverse)

        for spec in diverse[:POOL_DEPTH]:
            unique = _perturb_win(spec, self._used)
            # Re-verify before enqueueing
            try:
                result = verify(unique, self.week, self.difficulty)
                if not result["pass"]:
                    print(f"[pool] ⚠️ Bootstrap rejected invalid spec: {result['errors'][:2]}")
                    continue
            except Exception as e:
                print(f"[pool] ⚠️ Bootstrap verify error: {e}")
                continue
            self._queue.append(unique)
            self._used.add(compute_fingerprint(unique))

        print(f"[pool] Bootstrapped week={self.week} diff={self.difficulty} "
              f"with {len(self._queue)} shuffled items")

    # ── Serve ────────────────────────────────────────────────────────
    async def serve(self) -> tuple[dict, dict]:
        async with self._lock:
            self._served_count += 1
            if self._queue:
                spec = self._queue.popleft()       # LILO — oldest first
                fp = compute_fingerprint(spec)
                self._served.append(fp)
                self._fallback_served += 1
                source = "pooled"
            else:
                spec = _load_fallback(self.week, self.difficulty,
                                      list(self._served))
                fp = compute_fingerprint(spec)
                self._served.append(fp)
                self._fallback_served += 1
                source = "emergency"
                print(f"[pool] ⚠️ EMERGENCY fallback week={self.week}")
            queue_size = len(self._queue)

        self._kick_refill()

        return spec, {
            "verification_result": source,
            "pool_status": "served",
            "pool_size": queue_size,
            "served_count": self._served_count,
            "llm_served": self._llm_served,
            "fallback_served": self._fallback_served,
        }

    # ── Refill ───────────────────────────────────────────────────────
    def _kick_refill(self) -> None:
        if self._refill_in_flight >= 2:
            return
        self._refill_in_flight += 1
        task = asyncio.create_task(self._refill())
        task.add_done_callback(
            lambda _: setattr(self, "_refill_in_flight",
                              self._refill_in_flight - 1)
        )

    async def _refill(self) -> None:
        async with self._lock:
            if len(self._queue) >= POOL_DEPTH:
                return
            snapshot = list(self._served)   # ⭐ only served fingerprints

        # ── Try LLM ──
        try:
            brief = build_brief(self.week, self.difficulty, recent_levels=None)
            spec, meta = await self._gen(
                brief, self.week, self.difficulty, snapshot
            )
            if meta.get("verification_result") == "fallback":
                raise RuntimeError("LLM returned fallback")

            fp = compute_fingerprint(spec)
            if fp in self._used:
                raise RuntimeError(f"LLM returned duplicate fp={fp}")

            async with self._lock:
                self._queue.append(spec)           # LILO — append to back
                self._used.add(fp)
                self._llm_served += 1
                qsize = len(self._queue)
            print(f"[pool] ✅ LLM refill week={self.week} fp={fp} queue={qsize}")
            return
        except Exception as e:
            print(f"[pool] LLM refill failed week={self.week}: {e}")

        # ── Fallback refill ──
        async with self._lock:
            if len(self._queue) >= POOL_DEPTH:
                return
            base = _load_fallback(self.week, self.difficulty,
                                  list(self._served))
            unique = _perturb_win(base, self._used)
            self._queue.append(unique)
            self._used.add(compute_fingerprint(unique))
            qsize = len(self._queue)
        print(f"[pool] fallback refill week={self.week} queue={qsize}")


# ── Pool worker managing one pool per (student, week, difficulty) ────

class PoolWorker:
    def __init__(self, generator: Generator):
        self._gen = generator
        self._pools: dict[tuple[str, int, str], SelfReplenishingPool] = {}
        self.stats: dict[tuple[str, int, str], dict] = {}

    async def build_week(self, student_id: str, week: int) -> None:
        for diff in DIFFICULTIES:
            self._get_pool(student_id, week, diff)

    async def serve(self, student_id: str, week: int,
                    difficulty: str) -> tuple[dict, dict]:
        pool = self._get_pool(student_id, week, difficulty)
        return await pool.serve()

    def forget_week(self, student_id: str, week: int) -> None:
        for diff in DIFFICULTIES:
            self._pools.pop((student_id, week, diff), None)

    def reset_all(self) -> None:
        count = len(self._pools)
        self._pools.clear()
        print(f"[pool] Reset all pools ({count} cleared) — fresh shuffle next login")

    def get_stats(self, student_id: str, week: int) -> dict:
        out = {}
        for d in DIFFICULTIES:
            p = self._pools.get((student_id, week, d))
            if p:
                out[d] = {
                    "queue_size": len(p._queue),
                    "served": p._served_count,
                    "llm_served": p._llm_served,
                    "fallback_served": p._fallback_served,
                }
        return out

    def _get_pool(self, student_id: str, week: int,
                  difficulty: str) -> SelfReplenishingPool:
        key = (student_id, week, difficulty)
        if key not in self._pools:
            self._pools[key] = SelfReplenishingPool(
                student_id, week, difficulty, self._gen
            )
        return self._pools[key]