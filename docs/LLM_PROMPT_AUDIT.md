# LLM prompting audit — 29 October 2026

## Findings

The active Canvas flow selects existing stage-bound challenges. Its Repeat action calls `/serve` again, and its Oracle reads the selected challenge's stored hint. Neither action currently asks the LLM to author a new Canvas problem.

The previous `generate_template_game` prompt targeted the older narrative/game-template format. It requested changes to mechanics, objectives and mission type. Its merger accepted same-typed fields from the model, including settings that its own prompt said to preserve. Its tutorial instruction also assumed step objects even when the source used strings. A schema-valid prose rewrite was not evidence that the corresponding Canvas model had changed or was solvable.

## Implemented prompt boundary

The native authoring instructions are in `server/prompts/canvas_authoring.txt`, with context and validation in `server/canvas_prompting.py`. `LLMClient.propose_canvas_challenge` uses this contract.

The context comes from the current mirrored Canvas definition and authoritative curriculum. It fixes the week, stage, source lesson, objective ID, curriculum version, difficulty, mechanic family and required C type. Week 9 uses its explicit source-level mapping. The welcome video and unavailable historical Week 1 stages are excluded from authoring.

The model can propose bounded numeric problem parameters or choose three distinct question IDs from the assigned archive topic. It cannot supply renderer code, C programs, expressions, files, paths, assets, reward changes, assessment changes, arbitrary commands or extra JSON fields. The existing engines and authored lesson rules remain server-owned.

Validation rejects:

- A different level, topic identity, difficulty, mechanic family or required C type.
- Extra keys, duplicate JSON keys, malformed types, booleans used as numbers and out-of-range values.
- Archive question IDs from another subtopic or repeated IDs.
- Reused parameter fingerprints, including proposals that change only the layout seed or reorder the same archive questions.

Repairs retain the original binding and receive server validation errors. The previous model response is not inserted as a new instruction block. After three unsuccessful attempts, the method returns a rejected proposal and leaves the existing pool unchanged.

No account details, student IDs, credentials or study outcomes are added to native prompt context. Server-owned reference data is explicitly labeled as data rather than instructions.

## Legacy protection

Legacy presentation rewriting is limited to title, concept description, hint and tutorial. Other fields must be omitted or exactly match the source. Tutorial entry types and step identifiers are preserved. The metadata explicitly describes this as legacy presentation/schema checking, not runtime verification.

Native Canvas sources are blocked from the legacy prose merger and generator. The legacy regeneration endpoints return a conflict before consuming a Canvas game or scheduling retries. Any old background retry that encounters a native source stops rather than trying forever. The normal Canvas `/serve`, prepare, mark-used and release flow continues unchanged.

## Remaining integration

**Completed by the subsequent [Canvas replacement integration](CANVAS_LLM_REPLACEMENTS.md).** The paragraph below records the original prompting-only boundary; the live worker now builds and verifies proposals before publishing them. The standalone `propose_canvas_challenge` method still returns proposals and never writes game files by itself.

An accepted native response is a **parameter proposal**, not a verified or published game. Metadata records `runtime_verified: false` and `published: false`. The proposal method does not overwrite a fallback, mirror, ZIP, description or manifest.

The remaining phase is to implement a bounded parameter-to-challenge builder, execute the resulting reference through the actual game model, verify semantic novelty and stage alignment, and publish the source/mirror/package consistently. That worker can then be connected to consumption events. Automatic background pool replacement and live LLM Oracle hints are not enabled by this prompting change.

## Review and validation

Run `python -m scripts.audit_llm_prompts --week 7 --level 7 --difficulty standard` to export the exact prompt and context. Add `--probe` to check local Ollama or `--try-model` to request parameters without publishing a game. Output defaults to `artifacts/llm-prompts/`.

The prompt tests exercise all 243 authorable stage/difficulty combinations and include wrong-type, changed-study-rule, injection-field, duplicate-data, stale-binding and no-write checks. Existing package, lesson and selection regressions are run alongside them. Actual model availability and the model-trial outcome are recorded in the exported audit JSON; deterministic tests do not pretend to establish model obedience.

Validation result: all 104 affected tests passed. A real local `qwen2.5:3b` trial for Week 7 Level 7 returned valid float-stage parameters on attempt 2 after repair. Its saved result is `artifacts/llm-prompts/week7-level7-standard.audit.json`. It remained unpublished and no game or learner record was changed. One successful trial is not a guarantee of future model compliance; every response must continue through validation.
