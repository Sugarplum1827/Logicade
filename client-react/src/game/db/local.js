// §14.1 IndexedDB schema. One database, local event and research stores.
// Stores:
//   students          — { student_id, ... }
//   levels            — { level_id, ... }
//   attempts          — { attempt_id, level_id, student_id, ... }
//   events            — { event_id, ... }
//   level_summary     — { level_id, student_id, ... }        (client-derived rollup)
//   week_summary      — { [student_id, week], ... }          (client-derived rollup)
//   student_summary   — { student_id, ... }                  (client-derived rollup)
//   sync_queue        — { job_id, table, op, payload, ... }  (outbound)

window.LogiCadeDB = (function () {
    const DB_NAME = 'logicade';
    const DB_VERSION = 3;
    const STORES = [
        'students', 'levels', 'attempts', 'events',
        'level_summary', 'week_summary', 'student_summary', 'sync_queue', 'coin_transactions',
        'difficulty_decisions',
    ];

    let dbPromise = null;

    function _upgrade(db) {
        for (const store of STORES) {
            if (db.objectStoreNames.contains(store)) continue;

            let keyPath = 'id';
            if (store === 'students') keyPath = 'student_id';
            else if (store === 'levels') keyPath = 'level_id';
            else if (store === 'attempts') keyPath = 'attempt_id';
            else if (store === 'events') keyPath = 'event_id';
            else if (store === 'sync_queue') keyPath = 'job_id';
            else if (store === 'level_summary') keyPath = 'level_id';
            else if (store === 'week_summary') keyPath = ['student_id', 'week'];
            else if (store === 'student_summary') keyPath = 'student_id';
            else if (store === 'coin_transactions') keyPath = 'transaction_id';
            else if (store === 'difficulty_decisions') keyPath = 'decision_id';

            const objStore = db.createObjectStore(store, {keyPath});

            // Indexes needed by rollups and sync
            if (store === 'attempts') {
                objStore.createIndex('student_id', 'student_id', {unique: false});
                objStore.createIndex('level_id', 'level_id', {unique: false});
            }
            if (store === 'events') {
                objStore.createIndex('attempt_id', 'attempt_id', {unique: false});
                objStore.createIndex('level_id', 'level_id', {unique: false});
            }
            if (store === 'sync_queue') {
                objStore.createIndex('status', 'status', {unique: false});
            }
            if (store === 'coin_transactions') {
                objStore.createIndex('student_id', 'student_id', {unique: false});
            }
            if (store === 'difficulty_decisions') {
                objStore.createIndex('student_id', 'student_id', {unique: false});
                objStore.createIndex('previous_level_id', 'previous_level_id', {unique: false});
            }
        }
    }

    function openDB() {
        if (dbPromise) return dbPromise;
        let pending;
        pending = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => _upgrade(e.target.result);
            req.onsuccess = () => {
                const db = req.result;
                db.onversionchange = () => {
                    db.close();
                    if (dbPromise === pending) dbPromise = null;
                };
                db.onclose = () => {
                    if (dbPromise === pending) dbPromise = null;
                };
                resolve(db);
            };
            req.onerror = () => {
                if (dbPromise === pending) dbPromise = null;
                reject(req.error);
            };
            req.onblocked = () => {
                if (dbPromise === pending) dbPromise = null;
                reject(new Error('IndexedDB upgrade is blocked by another open tab. Close other LogiCade tabs and reload.'));
            };
        });
        dbPromise = pending;
        return pending;
    }

    return {openDB, DB_NAME, DB_VERSION};
})();
