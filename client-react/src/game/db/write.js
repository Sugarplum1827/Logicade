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
  }) {
    if (!studentId || !Number.isInteger(amount) || amount === 0 || !reason) return null;
    const db = await LogiCadeDB.openDB();
    const createdAt = new Date().toISOString();
    const row = {
      transaction_id: crypto.randomUUID(), student_id: studentId, amount, reason,
      source, level_id: levelId, attempt_id: attemptId, event_id: null,
      actor_id: null, created_at: createdAt,
    };
    const job = {
      job_id: crypto.randomUUID(), created_at: createdAt, table: 'coin_transactions',
      op: 'upsert', payload: row, status: 'pending', attempts: 0,
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
    window.LogiCadeSync?.drainQueue().catch(() => {});
    return row;
  }

  // ── Shared high-level persistence — call from any scene's _finish() ──
  async function persistAttempt({
    studentId, levelId, week, difficulty,
    spec, meta,
    score, accuracy, errorCount, hintCount,
    completionTimeSec, won,
  }) {
    if (!studentId || !levelId || !week) {
      console.warn('[persistAttempt] missing registry keys', {
        studentId, levelId, week,
      });
      return null;
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

    // 2. Existing queue job?
    const queue = await new Promise((res, rej) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const req = tx.objectStore('sync_queue').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
    const hasLevelJob = queue.some(
      (j) => j.table === 'levels' && j.payload?.level_id === levelId,
    );

    // 3. Compute global level_index per student.
    //    Matches the `unique(student_id, level_index)` DB constraint and
    //    the sync worker's `on_conflict=student_id,level_index` — so
    //    week transitions never collide (a student's first level of week 2
    //    just gets level_index 11, not 1).
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
      levelIndex = allLevels.filter((l) => l.student_id === studentId).length;
    }

    // 4. Upsert level row + queue job (idempotent)
    const spriteIds = Array.isArray(spec.entities)
      ? spec.entities.map((e) => e.sprite)
      : [];
    const levelRow = {
      level_id: levelId,
      student_id: studentId,
      week,
      level_index: levelIndex,
      difficulty_assigned: difficulty,
      difficulty_served: difficulty,
      game_type: spec.game_type || spec.mission_type || spec.metadata?.mission_type || 'world',
      game_id: spec.game_id || spec.id || null,
      game_title: spec.game_title || 'Untitled game',
      primary_mechanic: spec.metadata?.mechanic || spec.primary_mechanic || 'unknown',
      learning_topic: spec.topic || null,
      region_id: spec.region?.id || null,
      region_name: spec.region?.name || spec.metadata?.region || null,
      map_id: spec.map || spec.region?.id || 'unknown',
      sprite_ids: spriteIds,
      fingerprint:
        spec.fingerprint || spec.unique_identity_key || '00000000',
      verification_result: meta?.verification_result || 'pass',
      pool_status: meta?.pool_status || 'served',
      generated_at: existingLevel?.generated_at || new Date().toISOString(),
    };

    await new Promise((res, rej) => {
      const stores = hasLevelJob ? ['levels'] : ['levels', 'sync_queue'];
      const tx = db.transaction(stores, 'readwrite');
      tx.objectStore('levels').put(levelRow);
      if (!hasLevelJob) {
        tx.objectStore('sync_queue').put({
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
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });

    // 5. Determine attempt_number from existing attempts for this level
    const existingAttempts = await new Promise((res, rej) => {
      const tx = db.transaction('attempts', 'readonly');
      const idx = tx.objectStore('attempts').index('level_id');
      const req = idx.getAll(levelId);
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
    const attemptNumber = existingAttempts.length + 1;

    const endedAt = new Date();
    const startedAt = new Date(
      endedAt.getTime() - (completionTimeSec || 0) * 1000,
    );

    const attempt = {
      attempt_id: crypto.randomUUID(),
      level_id: levelId,
      student_id: studentId,
      attempt_number: attemptNumber,
      is_replay: attemptNumber > 1,
      score: score ?? 0,
      accuracy: accuracy ?? 0,
      in_activity_attempts: 1,
      error_count: errorCount ?? 0,
      completion_time_sec: completionTimeSec ?? 0,
      hint_count: hintCount ?? 0,
      activity_retries: 0,
      completed: !!won,
      status: won ? 'completed' : 'failed',
      restart_count: 0,
      question_retry_count: 0,
      origin: navigator.onLine ? 'online' : 'offline',
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      // Local-only fields — stripped before sync by recordAttempt()
      week,
      level_index: levelIndex,
    };

    const eventRows = (window.Telemetry?.snapshot?.() || []).map((event) => ({
      event_id: event.event_id || crypto.randomUUID(),
      level_id: levelId,
      attempt_id: attempt.attempt_id,
      student_id: studentId,
      event_type: event.event_type || 'unknown',
      t_ms_since_start: Math.max(0, Math.trunc(event.t_ms_since_start || 0)),
      entity_id: event.entity_id || null,
      rule_id: event.rule_id || null,
      payload: event.payload || {},
      created_at: endedAt.toISOString(),
    }));
    await recordAttempt(attempt, eventRows);
    await window.LogiCadeSync.drainQueue();
    return attempt;
  }

  return { recordAttempt, ensureStudent, persistAttempt, recordCoinTransaction };
})();
