# Canvas JSON creation repair — 30 October 2026

## Failures identified

The supplied server log showed repeated fixed-binding and parameter-key failures, interleaved with an empty `NotImplementedError`.

1. `LLMClient.propose_canvas_challenge` sent Ollama `format: "json"`. That asks for valid JSON syntax but does not enforce the required fields, types, or fixed lesson values. The strict server validator correctly rejected those responses.
2. `verify_candidate` used `asyncio.create_subprocess_exec`. Windows Uvicorn reload workers use a Selector event loop, which does not implement this subprocess operation. A valid proposal could therefore fail before its reference solution was checked.

## Changes

- `canvas_response_schema` builds a response schema from the server-owned lesson context. All binding fields are fixed to their expected values, including canonical difficulty and nullable required C type. Parameter objects require every allowed field, forbid additional fields, and specify numeric/array bounds. Archive questions are restricted to approved IDs and available combinations.
- Canvas authoring sends that schema in Ollama's `format` field. The model still chooses the bounded problem parameters. The existing independent validator, novelty check, trusted builder and runtime verification remain required. There is no response coercion or silent correction of lesson fields.
- Parameter rejection messages now list the expected, missing and unexpected keys.
- Runtime verification runs `subprocess.run` in a worker thread. This avoids the Windows event-loop limitation without changing the server's event-loop policy or blocking gameplay requests. Node remains memory limited, the subprocess has a 12-second deadline, and timeouts kill/reap the subprocess. Cancellation stops the awaiting publication task; an already running verification thread may take up to its deadline to finish, and cannot publish on its own.
- The isolated live pipeline script accepts week, level, difficulty, trial and `--selector-loop` options for reproducible regression checks.

Ollama's official schema-output documentation: https://ollama.com/blog/structured-outputs

## Verification

110 automated checks passed across prompting/schema validation, Windows subprocess compatibility, package compilation, candidate replacement/publication and stage objectives. This includes generating executable reference candidates for all 243 playable generation-stage/difficulty bindings. A dedicated regression runs verification under a Selector event loop with async subprocess creation explicitly unavailable, and another confirms verification does not block the event loop.

Four real local `qwen2.5:3b` runs each published a verified replacement on their first attempt under `_WindowsSelectorEventLoop`:

| Case | Isolated evidence directory |
| --- | --- |
| Week 1, Level 2, Standard, slot 3 | `artifacts/canvas-pipeline-live/20261029T175204-5877f5` |
| Week 2, Level 6, Advanced, slot 1 | `artifacts/canvas-pipeline-live/20261029T175341-803840` |
| Week 7, Level 7, Standard, slot 1 — float/C nodes | `artifacts/canvas-pipeline-live/20261029T175630-55006b` |
| Week 4, Level 1, Standard, slot 1 — archive questions | `artifacts/canvas-pipeline-live/20261029T175814-bbf65d` |

Directory timestamps are UTC. Each directory contains `report.json`, the generated JSON, mirrored game definition, ZIP, description and manifest. Every report confirms its original source pool file was unchanged. Tests did not create participant records or alter study rules.

## Running the repair

Restart the existing FastAPI server once if its reloader has not already loaded the changes. The durable queue is preserved: queued jobs resume and retry jobs run at their stored retry times. No migration, model download or deletion of pool JSON files is required. Genuine invalid, repeated or unverifiable candidates continue to be rejected, retaining the last verified game and the existing three-attempt/five-minute retry behavior.
