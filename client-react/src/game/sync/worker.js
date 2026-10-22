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

    // Tables in dependency order — parents must sync before children
    const TABLE_ORDER = ['students', 'levels', 'level_attempts', 'events'];

    let draining = false;
    let initialized = false;

    async function drainQueue() {
        if (draining || !navigator.onLine) return;
        draining = true;
        try {
            const db = await LogiCadeDB.openDB();
            const jobs = await new Promise((resolve, reject) => {
                const tx = db.transaction('sync_queue', 'readonly');
                const req = tx.objectStore('sync_queue').getAll();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });

            const now = Date.now();
            const abandoned = jobs.filter((j) => j.status === 'inflight' &&
                (!j.inflight_at || now - Date.parse(j.inflight_at) > 90_000));
            await Promise.all(abandoned.map((j) => _updateJob(db, {
                ...j, status: 'failed', inflight_at: null,
                last_error: 'Recovered an interrupted sync after app restart.',
                next_retry_at: null,
            })));
            const recoveredIds = new Set(abandoned.map((j) => j.job_id));
            const levelJobs = new Map();
            for (const job of jobs) {
                if (job.table === 'levels' && job.payload?.level_id) {
                    levelJobs.set(job.payload.level_id, job);
                }
            }
            const eligible = jobs
                .filter(j => (
                    j.status === 'pending' || j.status === 'failed' || recoveredIds.has(j.job_id) ||
                    (j.status === 'dead' && /23503|foreign key constraint/i.test(j.last_error || ''))
                ))
                .filter(j => !j.next_retry_at || Date.parse(j.next_retry_at) <= now)
                .filter(j => {
                    if (j.table !== 'level_attempts' && j.table !== 'events') return true;
                    const parent = levelJobs.get(j.payload?.level_id);
                    return !parent || parent.status === 'done';
                })
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
            for (const table of TABLE_ORDER) {
                if (!byTable.has(table)) continue;
                const tableJobs = byTable.get(table);
                for (let offset = 0; offset < tableJobs.length; offset += BATCH_SIZE) {
                    const batch = tableJobs.slice(offset, offset + BATCH_SIZE);
                    if (!(await drainBatch(db, table, batch))) break;
                }
            }
        } finally {
            draining = false;
        }
    }

    async function drainBatch(db, table, batch) {
        await Promise.all(batch.map(j => _updateJob(db, {
            ...j, status: 'inflight', inflight_at: new Date().toISOString(),
        })));

        try {
            const res = await fetch('/api/sync/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table, rows: batch.map(j => j.payload) }),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`HTTP ${res.status}: ${errText}`);
            }

            console.log(`[sync] delivered ${batch.length} × ${table}`);
            await Promise.all(batch.map(j => _updateJob(db, {
                ...j, status: 'done', inflight_at: null, last_error: null, next_retry_at: null,
            })));
            return true;
        } catch (err) {
            console.error(`[sync] batch failed for ${table}:`, err);
            await Promise.all(batch.map(j => _failJob(db, j, err)));
            return false;
        }
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
        setInterval(kick, 30_000);
        kick();
    }

    return {init, drainQueue, syncTriggerMode};
})();
