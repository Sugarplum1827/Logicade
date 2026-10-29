# Difficulty assignment repair — 30 October 2026

The approved threshold table is unchanged: below 60% selects Needs Support; 60%–below 80% selects Standard with fewer than two completed full-level replays, otherwise Needs Support; at least 80% selects Advanced with fewer than two replays, otherwise Standard. Errors remain recorded but unused by this table. The LLM cannot choose the category.

## Evidence policy

New decisions use `cp1-60-v2`. The input is the first **evaluated** attempt: a completed or failed run. Abandoned, restarted and incomplete runs remain in the underlying data but cannot establish a scored-zero adaptation signal. A failed evaluated attempt remains the first input even if a later attempt succeeds perfectly. Partial exits now retain observed answer accuracy rather than always recording zero.

The decision records the source attempt ID/number and `evidence_policy: first_evaluated_attempt`. Attempt numbering, rather than device clock order, determines the first evaluated run within a stage identity. Missing numbered attempts block a new assignment until synchronization recovers them. Full-level replays still count only additional completed runs after the first completion; unfinished restarts and question retries do not count.

Existing raw attempt rows and immutable historical summary fields are not rewritten. Their original first-recorded-attempt values can differ from the new explicitly identified first-evaluated input. Historical verified served decisions are preserved rather than retroactively changing a game already played. Unserved choices can be superseded with a new decision ID and a `supersedes_decision_id` link.

## Initial stages and region boundaries

- Week 1 Stage 1 remains the welcome video. Its score is not adaptation evidence.
- Week 1 Stage 2 is the initial Standard learning stage for new histories.
- Week 2 Stage 1 uses Week 1 Stage 2's evaluated performance.
- Weeks 3–9 Stage 1 use Stage 10 of the preceding week.
- Other stages use the preceding stage in their region.

## Server authority

`GET /api/difficulty/resolve?week=<week>&level=<stage>` reads the authenticated participant's synchronized levels, attempts and decisions. It calculates or recovers the category and returns the owned records needed by a fresh device. New stage identities are deterministic per participant/week/stage; existing identities are recovered. Queries are paginated and bounded rather than silently truncating evidence.

Both `/serve` and `/api/games/prepare` enforce the resolved category. A changed request or stale preview is rejected instead of silently serving another category. Missing or unavailable history produces a recovery message, never an invented Standard assignment.

`POST /api/difficulty/start` confirms a start using the canonical level ID and an issued, current game-revision token. It saves selected and actual served values independently and freezes the served decision. Retries reuse the same identity and conditional updates cannot silently replace an already served choice. Previewing a mission does not freeze its difficulty.

The sync endpoint acknowledges matching cached v2 decisions but cannot create or edit them. Older clients may upload provisional choices, but cannot promote a new legacy choice into an authoritative served record. They must refresh and use the server start route. Requests remain owner scoped; one participant cannot recover or assign another participant's records.

The existing single-API-process deployment remains the supported configuration. Per-participant server locks serialize assignment/start operations, and database writes are idempotent with conditional served updates. A failed confirmation blocks game launch and is recoverable by retrying Start; no new database transaction RPC or schema migration was introduced.

## Client recovery and persistence

The client waits for the active synchronization drain before requesting an online assignment. Multiple drain callers now await the same upload sequence, including a requested follow-up pass, rather than returning while uploads are still in progress.

Recovered server records populate IndexedDB and stage-ID mappings without queuing them back for upload. Pending local attempts are protected, and local level metadata is retained when server fields are missing. Account/session checks prevent late responses from changing a newer session. Local offline estimates are labeled `cp1-60-v2-local`; online serving and starting still require server confirmation.

Level persistence accepts `assignedDifficulty` separately from the actual game difficulty. The server start record also writes `difficulty_assigned` and `difficulty_served` separately. An outdated prepared mission is rejected if its assignment or revision changed before Start.

## Verification and limits

- 132 client tests passed, including partial performance, skipped unfinished evidence, region carryover, fresh-device recovery, pending-data protection, independent assigned/served fields and awaiting an active upload.
- 136 affected server checks passed across the policy, authentication/ownership, progress, threshold table, package compilation and replacement suites. The final policy suite includes 27 checks for cross-region assignments, first-attempt ordering, missing data, immutable starts, historical compatibility, issued revisions and request tampering.
- Production React build passed. The existing large-bundle warning remains.
- Tests use isolated records/database simulators. They do not rewrite participant records or validate the availability of a particular deployed Supabase instance.

The server enforces transitions from stored gameplay evidence. It does not newly attest or independently grade every client-uploaded gameplay result; the existing result-upload model is unchanged. Difficulty assignment for a new stage needs synchronized evidence and an available API. These changes do not introduce offline downloading of the entire game pool.

Evidence: `artifacts/difficulty-client-tests.txt`, `artifacts/difficulty-server-tests.txt`, and `artifacts/difficulty-policy-tests.txt`.
