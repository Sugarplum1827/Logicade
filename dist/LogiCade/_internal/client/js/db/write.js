// §14.2 Atomic write + §14.5 student initialization.

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
            const job = {
                job_id: crypto.randomUUID(),
                created_at: new Date().toISOString(),
                table: 'students',
                op: 'upsert',
                payload: studentRow,
                status: 'pending',
                attempts: 0,
                last_error: null,
                next_retry_at: null,
            };
            tx.objectStore('sync_queue').put(job);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async function recordAttempt(attempt) {
        const db = await LogiCadeDB.openDB();
        
        // Strip columns not in the Supabase `level_attempts` schema (§14.5)
        const syncPayload = { ...attempt };
        delete syncPayload.week;
        delete syncPayload.level_index;

        const job = {
            job_id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            table: 'level_attempts',
            op: 'upsert',
            payload: syncPayload,
            status: 'pending',
            attempts: 0,
            last_error: null,
            next_retry_at: null,
        };

        await new Promise((resolve, reject) => {
            const tx = db.transaction(['attempts', 'sync_queue'], 'readwrite');
            tx.objectStore('attempts').put(attempt);
            tx.objectStore('sync_queue').put(job);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
        });

        await LogiCadeRollups.rebuildLocalRollups(db, attempt.student_id);
        return job.job_id;
    }

    return {recordAttempt, ensureStudent};
})();