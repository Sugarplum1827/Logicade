// §14.2 Atomic write + §14.5 student initialization + shared persistence.
//
// `persistAttempt()` is the single source of truth for turning a completed
// level into local rows + sync jobs. Both GameScene._finish and
// MissionScene._finish call it, so level persistence is identical whether
// the spec came from the LLM pool, the manifest, or a fallback template.

window.LogiCadeWrite = (function () {
  async function ensureStudent(studentId) {
    const db = await LogiCadeDB.openDB();
    const existing = await new Promise((resolve, reject) => {
      const tx = db.transaction('students', 'readonly');
      const req = tx.objectStore('students').get(studentId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (existing) return;

    const studentRow = {
      student_id: studentId,
      created_at: new Date().toISOString(),
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(['students', 'sync_queue'], 'readwrite');
      tx.objectStore('students').put(studentRow);
      tx.objectStore('sync_queue').put({
        job_id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        table: 'students',
        op: 'upsert',
        payload: studentRow,
        status: 'pending',
        attempts: 0,
        last_error: null,
        next_retry_at: null,
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function recordAttempt(attempt, eventRows = []) {
    const db = await LogiCadeDB.openDB();

    // Strip columns not in the Supabase `level_attempts` schema (§14.5)
    const syncPayload = { ...attempt };
    delete syncPayload.week;
    delete syncPayload.level_index;
    delete syncPayload.content_revision;
    delete syncPayload.content_origin;
    delete syncPayload.learning_objective_id;

    const jobs = [{
      job_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      table: 'level_attempts',
      op: 'upsert',
      payload: syncPayload,
      status: 'pending',
      attempts: 0,
      last_error: null,
      next_retry_at: null,
    }, ...eventRows.map((event) => ({
      job_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      table: 'events',
      op: 'upsert',
      payload: event,
      status: 'pending',
      attempts: 0,
      last_error: null,
      next_retry_at: null,
    }))];

    await new Promise((resolve, reject) => {
      const tx = db.transaction(['attempts', 'events', 'sync_queue'], 'readwrite');
      tx.objectStore('attempts').put(attempt);
      for (const event of eventRows) tx.objectStore('events').put(event);
      for (const job of jobs) tx.objectStore('sync_queue').put(job);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
    });

    await LogiCadeRollups.rebuildLocalRollups(db, attempt.student_id);
    return jobs[0].job_id;
  }

  async function recordCoinTransaction({
    studentId, amount, reason, levelId = null, attemptId = null, source = 'gameplay',
    requireServer = false,
  }) {
    if (!studentId || !Number.isInteger(amount) || amount === 0 || !reason) return null;
    const createdAt = new Date().toISOString();
    let serverBalance = null;
    const idempotencyKey = requireServer ? `logicade_hint_transaction_${studentId}_${levelId}` : null;
    const transactionId = requireServer
      ? (localStorage.getItem(idempotencyKey) || crypto.randomUUID())
      : crypto.randomUUID();
    if (requireServer && (reason !== 'hint_used' || amount !== -6 || !levelId)) {
      throw new Error('Only the approved six-coin hint transaction can use this server confirmation path.');
    }
    if (requireServer && navigator.onLine) {
      // Reuse the same id if the response or local write is interrupted after
      // the server committed; the ledger RPC makes retries idempotent.
      localStorage.setItem(idempotencyKey, transactionId);
      const response = await fetch('/api/coins/spend-hint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('logicade_session_token') || ''}`,
        },
        body: JSON.stringify({ transaction_id: transactionId, level_id: levelId }),
      });
      if (!response.ok) {
        let message = `Coin transaction was rejected (${response.status}).`;
        try {
          const payload = await response.json();
          message = typeof payload.detail === 'string' ? payload.detail : message;
        } catch { /* use the status message */ }
        throw new Error(message);
      }
      const result = await response.json();
      if (typeof result.balance === 'number' && Number.isFinite(result.balance)) serverBalance = result.balance;
    }
    const db = await LogiCadeDB.openDB();
    const row = {
      transaction_id: transactionId, student_id: studentId, amount, reason,
      source, level_id: levelId, attempt_id: attemptId, event_id: null,
      actor_id: null, created_at: createdAt,
    };
    const job = {
      job_id: crypto.randomUUID(), created_at: createdAt, table: 'coin_transactions',
      op: 'upsert', payload: row, status: serverBalance !== null ? 'done' : 'pending', attempts: 0,
      last_error: null, next_retry_at: null,
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['coin_transactions', 'sync_queue'], 'readwrite');
      tx.objectStore('coin_transactions').put(row);
      tx.objectStore('sync_queue').put(job);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('coin transaction save aborted'));
    });
    if (requireServer) localStorage.removeItem(idempotencyKey);
    window.LogiCadeSync?.drainQueue().catch(() => {});
    return serverBalance === null ? row : { ...row, balance: serverBalance };
  }

  async function recordDifficultyDecision(decision) {
    if (!decision?.decision_id || !decision?.student_id || !decision?.difficulty_selected) return null;
    const db = await LogiCadeDB.openDB();
    const createdAt = decision.created_at || new Date().toISOString();
    const row = {
      decision_id: decision.decision_id,
      student_id: decision.student_id,
      previous_level_id: decision.previous_level_id || null,
      next_level_id: decision.next_level_id || null,
      difficulty_before: decision.difficulty_before || null,
      difficulty_selected: decision.difficulty_selected,
      difficulty_served: decision.difficulty_served || null,
      inputs: decision.inputs || {},
      rule_version: decision.rule_version || 'cp1-60-v1',
      reason: decision.reason || 'Applied the approved CP1 adaptive-difficulty rule.',
      decided_at: decision.decided_at || createdAt,
      created_at: createdAt,
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['difficulty_decisions', 'sync_queue'], 'readwrite');
      tx.objectStore('difficulty_decisions').put(row);
      const queue = tx.objectStore('sync_queue');
      const request = queue.getAll();
      request.onsuccess = () => {
        const existing = (request.result || []).find((job) =>
          job.table === 'difficulty_decisions' && job.payload?.decision_id === row.decision_id && ['pending', 'failed'].includes(job.status),
        );
        queue.put(existing ? {
          ...existing, payload: row, status: 'pending', next_retry_at: null,
          last_error: null,
        } : {
          job_id: crypto.randomUUID(), created_at: createdAt,
          table: 'difficulty_decisions', op: 'upsert', payload: row,
          status: 'pending', attempts: 0, last_error: null, next_retry_at: null,
        });
      };
      request.onerror = () => { tx.abort(); reject(request.error); };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('difficulty decision save aborted'));
    });
    window.LogiCadeSync?.drainQueue().catch(() => {});
    return row;
  }

  function gameProvenance(spec, meta) {
    const canvas = {
      template_id: meta?.generated_game?.game_id || null,
      variation_id: meta?.generated_game?.variation_id || null,
      seed: meta?.generated_game?.seed ?? null,
      template_version: meta?.generated_game?.template_version || null,
      content_revision: meta?.generated_game?.content_revision || null,
      content_origin: meta?.generated_game?.content_origin || null,
      learning_objective_id: meta?.generated_game?.learning_objective_id || spec.learning_objective_id || null,
    };
    return meta?.generated_game?.runtime === 'native_canvas'
      ? canvas : (spec.phaser_template || canvas);
  }

  // A started level must exist locally and in the outbox before a difficulty
  // decision or gameplay event can reference it, even if the player never ends.
  async function ensureLevel({
    studentId, levelId, week, difficulty,
    assignedDifficulty = difficulty, stageNumber, spec, meta,
  }) {
    if (!studentId || !levelId || !week) {
      throw new Error('Cannot save a level without its participant, level ID and study week.');
    }

    const db = await LogiCadeDB.openDB();
    await ensureStudent(studentId);

    // 1. Existing level?
    const existingLevel = await new Promise((res, rej) => {
      const tx = db.transaction('levels', 'readonly');
      const req = tx.objectStore('levels').get(levelId);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    if (existingLevel && existingLevel.student_id !== studentId) {
      throw new Error('This saved level belongs to a different participant.');
    }
    const rawStage = stageNumber ?? spec?.stage_number ?? spec?.level ?? spec?.level_number;
    const parsedStage = rawStage == null || rawStage === '' || typeof rawStage === 'boolean'
      ? null : Number(rawStage);
    const resolvedStage = Number.isInteger(parsedStage) && parsedStage >= 1 && parsedStage <= 10
      ? parsedStage : null;
    if (stageNumber != null && resolvedStage == null) {
      throw new Error('A stage number must be an integer from 1 to 10.');
    }
    if (resolvedStage != null && existingLevel?.stage_number != null
      && existingLevel.stage_number !== resolvedStage) {
      throw new Error('This saved level is already assigned to a different stage.');
    }

    // 3. Allocate the next unused per-participant index, preserving gaps and
    // the existing level's identity across replays.
    let levelIndex;
    if (existingLevel) {
      levelIndex = existingLevel.level_index ?? 0;
    } else {
      const allLevels = await new Promise((res, rej) => {
        const tx = db.transaction('levels', 'readonly');
        const req = tx.objectStore('levels').getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => rej(req.error);
      });
      levelIndex = Math.max(-1, ...allLevels.filter((l) => l.student_id === studentId)
        .map((l) => Number(l.level_index) || 0)) + 1;
    }

    // 4. Upsert level row + queue job (idempotent)
    const spriteIds = Array.isArray(spec.sprite_ids)
      ? spec.sprite_ids
      : Array.isArray(spec.entities)
      ? spec.entities.map((e) => e.sprite)
      : [];
    const template = gameProvenance(spec, meta);
    const levelRow = existingLevel ? { ...existingLevel } : {
      level_id: levelId,
      student_id: studentId,
      week,
      level_index: levelIndex,
      difficulty_assigned: assignedDifficulty,
      difficulty_served: difficulty,
      game_type: template.template_id || spec.game_type || spec.mission_type || spec.metadata?.mission_type || 'world',
      game_id: spec.game_id || spec.id || null,
      game_title: meta?.game_description?.title || spec.game_title || 'Untitled game',
      primary_mechanic: spec.metadata?.mechanic || spec.primary_mechanic || 'unknown',
      learning_topic: spec.topic || null,
      region_id: spec.region?.id || null,
      region_name: spec.region?.name || spec.metadata?.region || null,
      map_id: spec.map || spec.region?.id || 'unknown',
      sprite_ids: spriteIds,
      template_id: template.template_id || null,
      template_version: template.template_version || null,
      variation_id: template.variation_id || null,
      variation_seed: Number.isSafeInteger(template.seed) ? template.seed : null,
      fingerprint:
        spec.fingerprint || spec.unique_identity_key || '00000000',
      verification_result: meta?.verification_result || 'pass',
      pool_status: meta?.pool_status || 'served',
      generated_at: existingLevel?.generated_at || new Date().toISOString(),
    };
    if (resolvedStage != null && levelRow.stage_number == null) {
      levelRow.stage_number = resolvedStage;
    }

    await new Promise((res, rej) => {
      const tx = db.transaction(['levels', 'sync_queue'], 'readwrite');
      const levelStore = tx.objectStore('levels');
      const queueStore = tx.objectStore('sync_queue');
      levelStore.put(levelRow);
      const queueRequest = queueStore.getAll();
      queueRequest.onsuccess = () => {
        const queuedJobs = (queueRequest.result || []).filter(
          (job) => job.table === 'levels' && job.payload?.level_id === levelId,
        );
        const retryableJobs = queuedJobs.filter((job) => ['pending', 'failed', 'dead'].includes(job.status));
        if (retryableJobs.length) {
          for (const job of retryableJobs) {
            queueStore.put({
              ...job,
              payload: levelRow,
              status: 'pending',
              attempts: 0,
              last_error: null,
              next_retry_at: null,
              inflight_at: null,
            });
          }
        } else {
          queueStore.put({
            job_id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            table: 'levels',
            op: 'upsert',
            payload: levelRow,
            status: 'pending',
            attempts: 0,
            last_error: null,
            next_retry_at: null,
          });
        }
      };
      queueRequest.onerror = () => tx.abort();
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error || new Error('level save aborted'));
    });
    return levelRow;
  }

  // Capture this run's events before any asynchronous database work. A later
  // game may reset the global telemetry buffer while this run is being saved.
  async function persistAttempt({
    studentId, levelId, week, difficulty, stageNumber, spec, meta,
    score, accuracy, errorCount, hintCount, completionTimeSec, won, status, attemptId,
  }) {
    const eventSnapshot = window.Telemetry?.snapshot?.() || [];
    const session = window.Telemetry?.session?.() || {};
    const runAttemptId = attemptId || (session.studentId === studentId && session.levelId === levelId ? session.attemptId : null) || crypto.randomUUID();
    const levelRow = await ensureLevel({ studentId, levelId, week, difficulty, stageNumber, spec, meta });
    const db = await LogiCadeDB.openDB();
    const levelIndex = levelRow.level_index;
    const template = gameProvenance(spec, meta);

    // 5. Determine attempt_number from existing attempts for this level
    const existingAttempts = await new Promise((res, rej) => {
      const tx = db.transaction('attempts', 'readonly');
      const idx = tx.objectStore('attempts').index('level_id');
      const req = idx.getAll(levelId);
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
    const existingAttempt = existingAttempts.find((attempt) => attempt.attempt_id === runAttemptId);
    if (existingAttempt) return existingAttempt;
    const attemptNumber = Math.max(0, ...existingAttempts.map((attempt) => Number(attempt.attempt_number) || 0)) + 1;

    const endedAt = new Date();
    const startedAt = new Date(
      endedAt.getTime() - (completionTimeSec || 0) * 1000,
    );
    // Supabase constrains score and accuracy to [0, 1]. Some imported static
    // games report percentage or point totals in `score`; prefer their bounded
    // accuracy and only normalize score as a fallback.
    const bounded = (value) => value != null && value !== '' && Number.isFinite(Number(value))
      ? Math.max(0, Math.min(1, Number(value))) : null;
    const normalizedAccuracy = bounded(accuracy)
      ?? bounded(Number(score) > 1 ? Number(score) / 100 : score)
      ?? 0;
    const normalizedScore = Number(score) > 1
      ? (bounded(accuracy) ?? bounded(Number(score) / 100) ?? normalizedAccuracy)
      : (bounded(score) ?? normalizedAccuracy);
    const attemptStatus = ['completed', 'failed', 'incomplete', 'abandoned', 'restarted'].includes(status)
      ? status
      : (won ? 'completed' : 'failed');

    const attempt = {
      attempt_id: runAttemptId,
      level_id: levelId,
      student_id: studentId,
      attempt_number: attemptNumber,
      is_replay: existingAttempts.some((previous) => previous.completed === true),
      score: normalizedScore,
      accuracy: normalizedAccuracy,
      in_activity_attempts: 1,
      error_count: errorCount ?? 0,
      completion_time_sec: completionTimeSec ?? 0,
      hint_count: hintCount ?? 0,
      activity_retries: 0,
      completed: attemptStatus === 'completed' && !!won,
      status: attemptStatus,
      restart_count: attemptStatus === 'restarted' ? 1 : 0,
      question_retry_count: 0,
      origin: navigator.onLine ? 'online' : 'offline',
      template_id: template.template_id || null,
      template_version: template.template_version || null,
      variation_id: template.variation_id || null,
      variation_seed: Number.isSafeInteger(template.seed) ? template.seed : null,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      // Local-only fields — stripped before sync by recordAttempt()
      content_revision: template.content_revision || null,
      content_origin: template.content_origin || null,
      learning_objective_id: template.learning_objective_id || null,
      week,
      level_index: levelIndex,
    };

    const eventRows = eventSnapshot.map((event) => ({
      event_id: event.event_id || crypto.randomUUID(),
      level_id: levelId,
      attempt_id: attempt.attempt_id,
      student_id: studentId,
      event_type: event.event_type || 'unknown',
      t_ms_since_start: Math.max(0, Math.trunc(event.t_ms_since_start || 0)),
      entity_id: event.entity_id || null,
      rule_id: event.rule_id || null,
      payload: { ...(event.payload || {}), origin: event.origin || (navigator.onLine ? 'online' : 'offline'),
        ...(template.content_revision ? {content_revision:template.content_revision,content_origin:template.content_origin,
          learning_objective_id:template.learning_objective_id,source_file_id:spec.file_id || spec.game_id} : {}) },
      created_at: event.created_at || new Date(startedAt.getTime() + Math.max(0, Number(event.t_ms_since_start) || 0)).toISOString(),
    }));
    if (template.content_revision) eventRows.push({
      event_id: crypto.randomUUID(),level_id:levelId,attempt_id:attempt.attempt_id,student_id:studentId,
      event_type:'challenge_revision',t_ms_since_start:0,entity_id:null,rule_id:null,created_at:startedAt.toISOString(),
      payload:{content_revision:template.content_revision,content_origin:template.content_origin,
        learning_objective_id:template.learning_objective_id,source_file_id:spec.file_id || spec.game_id,
        origin:navigator.onLine ? 'online' : 'offline'},
    });
    await recordAttempt(attempt, eventRows);
    window.LogiCadeSync?.drainQueue().catch((error) => console.warn('[sync] attempt queued locally; upload will retry:', error));
    return attempt;
  }

  return { recordAttempt, ensureStudent, ensureLevel, persistAttempt, recordCoinTransaction, recordDifficultyDecision };
})();
