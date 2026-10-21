// §14.4 Sync worker. Drains the sync_queue in batches of up to 50 per table,
// applying exponential backoff on failure and marking dead after 20 attempts.
// Never silently drops — dead jobs are surfaced for admin review in Phase 7.
//
// Trigger modes (§14.4 authoritative):
//   'menu'       — drains only when the player returns to the main menu (default)
//   'interval'   — drains every 30s while online
//   'level_end'  — drains immediately after each level
//
// Phase 5 wires the queue and worker; the actual Supabase POST lands in
// Phase 6. Until then every job completes against a simulated endpoint,
// which is enough to prove the atomicity and idempotency properties.
window.LogiCadeSync = (function () {
    const syncTriggerMode = 'level_end'; // 'menu' | 'interval' | 'level_end'
    const BACKOFF_SECONDS = [2, 10, 60, 300, 900];
    const MAX_ATTEMPTS = 20;
    const BATCH_SIZE = 50;

    let draining = false;

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
            const eligible = jobs
                .filter(j => (j.status === 'pending' || j.status === 'failed'))
                .filter(j => !j.next_retry_at || Date.parse(j.next_retry_at) <= now)
                .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

            const byTable = new Map();
            for (const j of eligible) {
                if (!byTable.has(j.table)) byTable.set(j.table, []);
                byTable.get(j.table).push(j);
            }

            for (const [table, tableJobs] of byTable.entries()) {
                const batch = tableJobs.slice(0, BATCH_SIZE);
                await drainBatch(db, table, batch);
            }
        } finally {
            draining = false;
        }
    }

    async function drainBatch(db, table, batch) {
        await Promise.all(batch.map(j => _updateJob(db, {...j, status: 'inflight'})));

        try {
            const url = `${window.LOGICADE_CONFIG.supabaseUrl}/rest/v1/${table}`;
            const key = window.LOGICADE_CONFIG.supabaseAnonKey;

            // PostgREST expects a JWT (starts with 'eyJ') in the Authorization header.
            // The new sb_publishable_ keys must only go in the 'apikey' header.
            const headers = {
                'apikey': key,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates' // Upsert behavior
            };
            if (key && key.startsWith('eyJ')) {
                headers['Authorization'] = `Bearer ${key}`;
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(batch.map(j => j.payload))
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`HTTP ${res.status}: ${errText}`);
            }

            console.log(`[sync] delivered ${batch.length} × ${table}`);
            await Promise.all(batch.map(j => _updateJob(db, {
                ...j, status: 'done', last_error: null, next_retry_at: null,
            })));
        } catch (err) {
            console.error(`[sync] batch failed for ${table}:`, err);
            await Promise.all(batch.map(j => _failJob(db, j, err)));
        }
    }

    async function _failJob(db, job, err) {
        const attempts = (job.attempts || 0) + 1;
        const delayIdx = Math.min(attempts - 1, BACKOFF_SECONDS.length - 1);
        const next = new Date(Date.now() + BACKOFF_SECONDS[delayIdx] * 1000).toISOString();
        const status = attempts >= MAX_ATTEMPTS ? 'dead' : 'failed';
        await _updateJob(db, {
            ...job, attempts, status,
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
        window.addEventListener('online', () => drainQueue());
        if (syncTriggerMode === 'interval') {
            setInterval(drainQueue, 30_000);
        }
    }

    return {init, drainQueue, syncTriggerMode};
})();