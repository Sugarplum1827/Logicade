// §14.4 Sync worker. Drains the sync_queue in batches of up to 50 per table,
// applying exponential backoff on failure and marking dead after 20 attempts.
// Never silently drops — dead jobs are surfaced for admin review in Phase 7.
//
// Trigger modes (§14.4 authoritative):
//   'menu'       — drains only when the player returns to the main menu (default)
//   'interval'   — drains every 30s while online
//   'level_end'  — drains immediately after each level
//
// FIX: Tables are now processed in strict priority order (students → levels
// → level_attempts → events) so PostgreSQL foreign key constraints never fail
// because a child row arrived before its parent.

window.LogiCadeSync = (function () {
    const syncTriggerMode = 'interval'; // also drains immediately after level completion
    const BACKOFF_SECONDS = [2, 10, 60, 300, 900];
    const MAX_ATTEMPTS = 20;
    const BATCH_SIZE = 50;
    const MAX_PARENT_RECOVERIES = 2;
    const DEAD_RECOVERY_REVISION = 'logicade_sync_dead_recovery_v3';

    // Tables in dependency order — parents must sync before children
    const TABLE_ORDER = ['students', 'levels', 'level_attempts', 'events', 'coin_transactions', 'difficulty_decisions'];

    let draining = false;
    let activeDrain = null;
    let rerunRequested = false;
    let initialized = false;

    function sessionContext() {
        return {
            participant: localStorage.getItem('logicade_current_user') || '',
            token: localStorage.getItem('logicade_session_token') || '',
        };
    }

    function sessionMatches(context) {
        const current = sessionContext();
        return current.participant === context.participant && current.token === context.token;
    }

    function drainQueue() {
        if (activeDrain) { rerunRequested = true; return activeDrain; }
        activeDrain = (async () => {
            do { rerunRequested = false; await runDrainQueue(); } while (rerunRequested);
        })().finally(() => { activeDrain = null; });
        return activeDrain;
    }

    async function runDrainQueue() {
        const context = sessionContext();
        if (draining) { rerunRequested = true; return; }
        if (!navigator.onLine || !context.token || !context.participant) return;
        draining = true;
        const uploadedTables = new Set();
        try {
            const db = await LogiCadeDB.openDB();
            const jobs = await new Promise((resolve, reject) => {
                const tx = db.transaction('sync_queue', 'readonly');
                const req = tx.objectStore('sync_queue').getAll();
                req.onsuccess = () => resolve((req.result || []).filter(
                    (job) => job.payload?.student_id === context.participant,
                ));
                req.onerror = () => reject(req.error);
            });

            // Requeue known schema/FK failures once for this client revision.
            // This lets rows rejected by a just-applied migration recover in
            // dependency order, while permanently dead jobs no longer hit the
            // API every 30 seconds forever.
            const participant = context.participant;
            const recoveryKey = `${DEAD_RECOVERY_REVISION}_${participant}`;
            let recoveryIds = new Set();
            if (!localStorage.getItem(recoveryKey)) {
                const recoverable = jobs.filter((job) => job.status === 'dead'
                    && /23503|foreign key constraint|PGRST204|PGRST102|schema cache|column .* not found/i.test(job.last_error || ''));
                recoveryIds = new Set(recoverable.map((job) => job.job_id));
                await Promise.all(recoverable.map((job) => _updateJob(db, {
                    ...job, status: 'pending', attempts: 0, inflight_at: null,
                    next_retry_at: null,
                })));
                localStorage.setItem(recoveryKey, new Date().toISOString());
            }

            const now = Date.now();
            const abandoned = jobs.filter((j) => j.status === 'inflight' &&
                (!j.inflight_at || now - Date.parse(j.inflight_at) > 90_000));
            await Promise.all(abandoned.map((j) => _updateJob(db, {
                ...j, status: 'failed', inflight_at: null,
                last_error: 'Recovered an interrupted sync after app restart.',
                next_retry_at: null,
            })));
            const recoveredIds = new Set([...abandoned.map((j) => j.job_id), ...recoveryIds]);
            const recoveredById = new Map();
            for (const job of jobs) {
                if (recoveryIds.has(job.job_id)) {
                    recoveredById.set(job.job_id, {
                        ...job, status: 'pending', attempts: 0, inflight_at: null,
                        next_retry_at: null,
                    });
                } else if (abandoned.some((item) => item.job_id === job.job_id)) {
                    recoveredById.set(job.job_id, {
                        ...job, status: 'failed', inflight_at: null,
                        last_error: 'Recovered an interrupted sync after app restart.',
                        next_retry_at: null,
                    });
                }
            }
            const levelJobs = new Map();
            const attemptJobs = new Map();
            const currentJobs = jobs.map((job) => recoveredById.get(job.job_id) || job);
            for (const job of currentJobs) {
                if (job.table === 'levels' && job.payload?.level_id) {
                    if (!levelJobs.has(job.payload.level_id)) levelJobs.set(job.payload.level_id, []);
                    levelJobs.get(job.payload.level_id).push(job);
                }
                if (job.table === 'level_attempts' && job.payload?.attempt_id) {
                    if (!attemptJobs.has(job.payload.attempt_id)) attemptJobs.set(job.payload.attempt_id, []);
                    attemptJobs.get(job.payload.attempt_id).push(job);
                }
            }
            const eligible = currentJobs
                .filter(j => (
                    j.status === 'pending' || j.status === 'failed' || recoveredIds.has(j.job_id)
                ))
                .filter(j => !j.next_retry_at || Date.parse(j.next_retry_at) <= now)
                .sort((a, b) => {
                    // Priority: dependencies first
                    const pA = TABLE_ORDER.indexOf(a.table);
                    const pB = TABLE_ORDER.indexOf(b.table);
                    if (pA !== pB) return pA - pB;
                    // Within same table: oldest first
                    return a.created_at < b.created_at ? -1 : 1;
                });

            // Group by table
            const byTable = new Map();
            for (const j of eligible) {
                if (!byTable.has(j.table)) byTable.set(j.table, []);
                byTable.get(j.table).push(j);
            }

            // Process tables in strict dependency order
            tableLoop: for (const table of TABLE_ORDER) {
                if (!sessionMatches(context)) break;
                if (!byTable.has(table)) continue;
                // Resolve dependencies after the earlier table was confirmed,
                // so a fresh student, level, attempt and events can drain in
                // one pass. A failed/backed-off parent keeps its children local.
                const tableJobs = byTable.get(table).filter((job) => {
                    const levelIds = table === 'difficulty_decisions'
                        ? [job.payload?.previous_level_id, job.payload?.next_level_id]
                        : table === 'levels' || table === 'students' ? [] : [job.payload?.level_id];
                    if (levelIds.some((id) => id && levelJobs.get(id)?.some((parent) => parent.status !== 'done'))) return false;
                    if (table === 'difficulty_decisions' && currentJobs.some((parent) =>
                        parent.table === 'level_attempts'
                        && parent.payload?.level_id === job.payload?.previous_level_id
                        && parent.status !== 'done')) return false;
                    const attempts = table === 'level_attempts' ? null : attemptJobs.get(job.payload?.attempt_id);
                    return !attempts || attempts.every((attempt) => attempt.status === 'done');
                });
                for (let offset = 0; offset < tableJobs.length; offset += BATCH_SIZE) {
                    if (!sessionMatches(context)) break;
                    const batch = tableJobs.slice(offset, offset + BATCH_SIZE);
                    const result = await drainBatch(db, table, batch, context);
                    if (result !== true) {
                        for (const job of batch) job.status = 'failed';
                        // A repaired parent must be delivered before another
                        // child batch is considered. Refresh the queue instead
                        // of continuing with this pass's stale "done" parents.
                        if (result === 'parents_requeued' || table === 'students') break tableLoop;
                        continue;
                    }
                    for (const job of batch) {
                        job.status = 'done';
                    }
                    uploadedTables.add(table);
                }
            }
            if (sessionMatches(context)) {
                await reportDeviceStatus(db, context);
                if (sessionMatches(context) && uploadedTables.size && window.dispatchEvent && typeof CustomEvent === 'function') {
                    window.dispatchEvent(new CustomEvent('logicade:sync_completed', {
                        detail: { studentId: context.participant, tables: [...uploadedTables] },
                    }));
                }
            }
        } finally {
            draining = false;
            if (!sessionMatches(context)) rerunRequested = true;
        }
    }

    async function reportDeviceStatus(db, context) {
        const participant = context.participant;
        if (!participant) return;
        const jobs = await new Promise((resolve, reject) => {
            const tx = db.transaction('sync_queue', 'readonly');
            const req = tx.objectStore('sync_queue').getAll();
            req.onsuccess = () => resolve((req.result || []).filter((job) => job.payload?.student_id === participant));
            req.onerror = () => reject(req.error);
        });
        const pending = jobs.filter((job) => ['pending', 'inflight'].includes(job.status)).length;
        const failedJobs = jobs.filter((job) => ['failed', 'dead'].includes(job.status));
        const deviceKey = 'logicade_sync_device_id';
        let deviceId = localStorage.getItem(deviceKey);
        if (!deviceId) {
            deviceId = crypto.randomUUID();
            localStorage.setItem(deviceKey, deviceId);
        }
        try {
            const response = await fetch('/api/sync/status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${context.token}`,
                },
                body: JSON.stringify({
                    device_id: deviceId,
                    pending_records: pending,
                    failed_records: failedJobs.length,
                    last_sync_at: localStorage.getItem(`logicade_last_sync_at_${participant}`) || null,
                    last_error: failedJobs.at(-1)?.last_error
                        ? String(failedJobs.at(-1).last_error).slice(0, 500) : null,
                }),
            });
            if (!response.ok) throw new Error(`status API returned HTTP ${response.status}`);
        } catch (error) {
            // Status reporting must never stop gameplay-data delivery.
            console.debug('[sync] device status report deferred:', error?.message || error);
        }
    }

    async function drainBatch(db, table, batch, context) {
        await Promise.all(batch.map(j => _updateJob(db, {
            ...j, status: 'inflight', inflight_at: new Date().toISOString(),
        })));

        try {
            const res = await fetch('/api/sync/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${context.token}`,
                },
                body: JSON.stringify({ table, rows: batch.map(j => j.payload) }),
            });

            if (!res.ok) {
                const errText = await res.text();
                const error = new Error(`HTTP ${res.status}: ${errText}`);
                error.status = res.status;
                error.responseText = errText;
                throw error;
            }

            console.log(`[sync] delivered ${batch.length} × ${table}`);
            await Promise.all(batch.map(j => _updateJob(db, {
                ...j, status: 'done', inflight_at: null, last_error: null, next_retry_at: null,
            })));
            const participant = context.participant;
            if (participant) localStorage.setItem(`logicade_last_sync_at_${participant}`, new Date().toISOString());
            return true;
        } catch (err) {
            console.error(`[sync] batch failed for ${table}:`, err);
            await Promise.all(batch.map(j => _failJob(db, j, err)));
            const parentTable = missingParentTable(table, err);
            if (parentTable && await requeueMissingParents(db, batch, context, parentTable)) {
                rerunRequested = true;
                return 'parents_requeued';
            }
            return false;
        }
    }

    function missingParentTable(table, error) {
        if (!['level_attempts', 'events', 'coin_transactions', 'difficulty_decisions'].includes(table)) return null;
        const response = String(error.responseText || '');
        if (error.status === 409) {
            if (/A referenced attempt is not synchronized for this participant/i.test(response)) return 'level_attempts';
            if (/A referenced level is not synchronized for this participant/i.test(response)) return 'levels';
        }
        // Older API responses wrap PostgreSQL's FK failure in a 502. Only
        // recognized level/attempt links qualify; unrelated conflicts and
        // permission errors must keep their normal backoff.
        if ([400, 409, 502].includes(error.status) && /23503/.test(response)) {
            if (table !== 'level_attempts' && /attempt_id/i.test(response)) return 'level_attempts';
            if (/level_id/i.test(response)) return 'levels';
        }
        return null;
    }

    async function requeueMissingParents(db, batch, context, parentTable) {
        if (!sessionMatches(context)) return false;
        return new Promise((resolve, reject) => {
            const tx = db.transaction('sync_queue', 'readwrite');
            const store = tx.objectStore('sync_queue');
            const request = store.getAll();
            let repaired = false;
            request.onsuccess = () => {
                if (!sessionMatches(context)) return;
                const owned = (request.result || []).filter((job) => job.payload?.student_id === context.participant);
                const requestedIds = new Set(batch.map((job) => job.job_id));
                const children = owned.filter((job) => requestedIds.has(job.job_id)
                    && ['failed', 'pending'].includes(job.status)
                    && (Number(job.parent_recovery_attempts) || 0) < MAX_PARENT_RECOVERIES);
                const parents = new Map();

                const selectDoneParent = (table, field, value) => {
                    if (!value) return null;
                    const candidates = owned.filter((job) => job.table === table && job.payload?.[field] === value);
                    // Never override an independently pending, backed-off or
                    // dead parent, or erase a newer payload queued in another
                    // tab. The regular dependency checks already handle it.
                    if (!candidates.length || candidates.some((job) => job.status !== 'done')) return null;
                    const priorRepairs = Math.max(0, ...candidates.map((job) => Number(job.missing_parent_reuploads) || 0));
                    if (priorRepairs >= MAX_PARENT_RECOVERIES) return null;
                    const latest = candidates.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
                    const recovered = { ...latest, status: 'pending', attempts: 0, inflight_at: null,
                        next_retry_at: null, last_error: 'Requeued after the server reported a missing gameplay parent.',
                        missing_parent_reuploads: priorRepairs + 1 };
                    parents.set(latest.job_id, recovered);
                    return recovered;
                };

                const repairedChildren = [];
                for (const child of children) {
                    let childRepaired = false;
                    if (parentTable === 'level_attempts') {
                        const parent = selectDoneParent('level_attempts', 'attempt_id', child.payload?.attempt_id);
                        if (parent) {
                            // An attempt has its own level FK. Resend the known
                            // ancestor first, with the same IDs, when available.
                            selectDoneParent('levels', 'level_id', parent.payload?.level_id);
                            childRepaired = true;
                        }
                    } else {
                        const levelIds = child.table === 'difficulty_decisions'
                            ? [child.payload?.previous_level_id, child.payload?.next_level_id]
                            : [child.payload?.level_id];
                        for (const levelId of levelIds) {
                            if (selectDoneParent('levels', 'level_id', levelId)) childRepaired = true;
                        }
                    }
                    if (childRepaired) repairedChildren.push(child);
                }
                if (!repairedChildren.length) return;
                for (const parent of parents.values()) store.put(parent);
                for (const child of repairedChildren) store.put({
                    ...child, status: 'pending', inflight_at: null, next_retry_at: null,
                    parent_recovery_attempts: (Number(child.parent_recovery_attempts) || 0) + 1,
                });
                repaired = true;
            };
            request.onerror = () => { tx.abort(); reject(request.error); };
            tx.oncomplete = () => resolve(repaired);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Missing-parent recovery was interrupted'));
        });
    }

    async function _failJob(db, job, err) {
        const attempts = (job.attempts || 0) + 1;
        const delayIdx = Math.min(attempts - 1, BACKOFF_SECONDS.length - 1);
        const next = new Date(Date.now() + BACKOFF_SECONDS[delayIdx] * 1000).toISOString();
        const status = attempts >= MAX_ATTEMPTS ? 'dead' : 'failed';
        await _updateJob(db, {
            ...job, attempts, status, inflight_at: null,
            last_error: String(err?.message || err),
            next_retry_at: status === 'dead' ? null : next,
        });
    }

    async function _updateJob(db, job) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('sync_queue', 'readwrite');
            tx.objectStore('sync_queue').put(job);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    function init() {
        if (initialized) return;
        initialized = true;
        const kick = () => drainQueue().catch((err) => console.warn('[sync] queue drain failed:', err));
        window.addEventListener('online', kick);
        window.addEventListener('logicade:session_changed', kick);
        window.addEventListener('storage', (event) => {
            if (['logicade_current_user', 'logicade_session_token'].includes(event.key)) kick();
        });
        setInterval(kick, 30_000);
        kick();
    }

    return {init, drainQueue, syncTriggerMode};
})();
