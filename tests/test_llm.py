"""Phase 3 acceptance tests — §17 criteria 1, 2, 3, 5, 7.

All tests carry `@pytest.mark.ollama` and are skipped cleanly if Ollama
is unreachable. Criterion 5 and 7 use dependency-injected fakes (no
LLM round trips) so they are fast and deterministic. Criteria 1, 2, 3
exercise the real client against qwen2.5:3b.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio

from server.llm_client import LLMClient, _load_fallback
from server.pool_worker import PoolWorker
from server.shuffler import build_brief
from server.verifier import compute_fingerprint, verify


# ── Fixtures ─────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client() -> AsyncIterator[LLMClient]:
    c = LLMClient.from_env()
    if not await c.probe():
        await c.close()
        pytest.skip(
            f"Ollama not reachable at {c.host} or model {c.model} not pulled"
        )
    yield c
    await c.close()


# ══════════════════════════════════════════════════════════════════════
# Criterion 1 — generate a Week 3 / standard spec via Ollama
# ══════════════════════════════════════════════════════════════════════

@pytest.mark.ollama
@pytest.mark.asyncio
async def test_criterion_1_generate(client):
    brief = build_brief(week=3, difficulty="standard")
    spec, meta = await client.generate(brief, 3, "standard", [])
    print(f"\nverification_result={meta['verification_result']}")
    if meta.get("raw_llm_response"):
        print(f"raw_llm_response[:500]={meta['raw_llm_response']!r}")
    if meta.get("errors"):
        print(f"errors={meta['errors']}")
    assert spec["week"] == 3
    assert spec["difficulty"] == "standard"
    assert spec["rules"], "spec has no rules"
    assert spec["entities"], "spec has no entities"


# ══════════════════════════════════════════════════════════════════════
# Criterion 2 — run all 7 verifier checks, print pass/fail
# ══════════════════════════════════════════════════════════════════════

@pytest.mark.ollama
@pytest.mark.asyncio
async def test_criterion_2_verify(client):
    brief = build_brief(week=3, difficulty="standard")
    spec, _ = await client.generate(brief, 3, "standard", [])
    result = verify(spec, 3, "standard", [])
    print("\n── criterion 2: verifier output ──")
    print(f"pass={result['pass']} errors={result['errors']}")
    # The generated spec should be valid; fallbacks are valid by construction
    assert result["pass"], result["errors"]


# ══════════════════════════════════════════════════════════════════════
# Criterion 3 — fingerprint duplicate rejection
# ══════════════════════════════════════════════════════════════════════

@pytest.mark.ollama
@pytest.mark.asyncio
async def test_criterion_3_duplicate_rejection(client):
    brief = build_brief(week=3, difficulty="standard")
    spec1, meta1 = await client.generate(brief, 3, "standard", [])
    fp1 = compute_fingerprint(spec1)
    print(f"\n── criterion 3: first fp={fp1} "
          f"verification={meta1['verification_result']} ──")
    if meta1.get("raw_llm_response"):
        print(f"   raw[1]={meta1['raw_llm_response']!r}")

    # Force the client to see fp1 as recent — a subsequent generation
    # must produce a DIFFERENT fingerprint (rejection + regen).
    spec2, meta2 = await client.generate(brief, 3, "standard", [fp1])
    fp2 = compute_fingerprint(spec2)
    print(f"── criterion 3: second fp={fp2} "
          f"verification={meta2['verification_result']} ──")
    if meta2.get("raw_llm_response"):
        print(f"   raw[2]={meta2['raw_llm_response']!r}")
    assert fp2 != fp1, (
        f"regenerated spec shares fingerprint {fp1} with previous"
    )


# ══════════════════════════════════════════════════════════════════════
# Criterion 5 — force 3 consecutive failures → fallback served
# ══════════════════════════════════════════════════════════════════════

class _AlwaysFailLLM(LLMClient):
    """Stub client whose Ollama call always returns unusable JSON."""

    def __init__(self) -> None:
        super().__init__("stub", "stub", timeout_s=1.0)
        self.model_tag = "stub"
        self.model_digest = "000000000000"
        self._calls = 0

    async def _call_ollama(self, prompt: str) -> str:  # type: ignore[override]
        self._calls += 1
        self._last_raw = "not json at all"
        return "not json at all"

    async def probe(self) -> bool:  # type: ignore
        return True


@pytest.mark.ollama
@pytest.mark.asyncio
async def test_criterion_5_fallback_after_three_failures():
    stub = _AlwaysFailLLM()
    brief = build_brief(week=3, difficulty="standard")
    spec, meta = await stub.generate(brief, 3, "standard", [])

    print("\n── criterion 5: fallback ──")
    print(f"verification_result={meta['verification_result']}")
    print(f"attempts={stub._calls}")
    print(json.dumps(spec, indent=2))

    # MAX_RETRIES=2 → 1 initial + 2 retries = 3 total attempts
    assert stub._calls == 3, f"expected 3 attempts, got {stub._calls}"
    assert meta["verification_result"] == "fallback"
    assert meta["fallback"] is True
    # The served spec is the fallback template, which must itself be valid
    assert verify(spec, 3, "standard", [])["pass"]


# ══════════════════════════════════════════════════════════════════════
# Criterion 7 — pool pre-gen, pop, refill, empty-pool fallback
# ══════════════════════════════════════════════════════════════════════

async def _stub_gen(brief: dict, week: int, difficulty: str,
                    recent: list[str]) -> tuple[dict, dict]:
    spec = _load_fallback(week, difficulty, recent)
    return spec, {
        "verification_result": "pass",
        "model_tag": "stub",
        "model_digest": "000000000000",
    }


@pytest.mark.ollama
@pytest.mark.asyncio
async def test_criterion_7_pool():
    pool = PoolWorker(_stub_gen, pool_depth=3)

    # Pre-generate 9 specs (3 pools × 3 specs) for one student/week
    await pool.build_week("stu-001", week=3)
    await pool.drain_background()

    print("\n── criterion 7: pools filled ──")
    for d, s in pool.get_stats("stu-001", 3).items():
        print(f"  {d}: {s}")

    # Pop all 3 from 'standard'
    served = []
    for _ in range(3):
        spec, meta = await pool.serve("stu-001", 3, "standard")
        served.append(spec["fingerprint"])
        assert meta["pool_status"] == "served"
    print(f"  served 3: fingerprints={served}")

    # Wait for async refill
    await asyncio.sleep(0.2)
    await pool.drain_background()

    stats = pool.get_stats("stu-001", 3)["standard"]
    assert stats["served"] == 3
    print(f"  after refill: {stats}")

    # Force empty-pool condition: drain faster than refill can keep up
    for _ in range(10):
        _, meta = await pool.serve("stu-001", 3, "standard")
    # Some of those should have hit exhausted
    stats = pool.get_stats("stu-001", 3)["standard"]
    print(f"  after drain: {stats}")
    assert stats["exhausted"] >= 1, (
        "expected at least one exhausted serve; none observed"
    )

    # Empty-pool serve must never raise and must return a valid spec
    spec, meta = await pool.serve("stu-001", 3, "standard")
    assert meta["pool_status"] in ("served", "exhausted")
    assert verify(spec, 3, "standard", [])["pass"]

# ══════════════════════════════════════════════════════════════════════
# Fallback perturbation — deterministic, no Ollama
# ══════════════════════════════════════════════════════════════════════

def test_fallback_perturbation_on_fp_collision():
    """Fallback must be perturbed when its fingerprint is in recent history.

    This is the pure-function check that would have caught the criterion-3
    failure immediately. It does not touch Ollama.
    """
    from server.llm_client import _load_fallback
    from server.verifier import compute_fingerprint

    base = _load_fallback(3, "standard", [])
    fp_base = compute_fingerprint(base)

    perturbed = _load_fallback(3, "standard", [fp_base])
    fp_pert = compute_fingerprint(perturbed)

    print(f"\n  base fp={fp_base} win={base['win']!r}")
    print(f"  perturbed fp={fp_pert} win={perturbed['win']!r}")

    assert fp_pert != fp_base, (
        f"perturbation did not change fingerprint; "
        f"base win={base['win']!r}, perturbed win={perturbed['win']!r}"
    )
    # The perturbed spec must still verify
    assert verify(perturbed, 3, "standard", [])["pass"]