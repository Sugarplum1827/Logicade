// §14.1 IndexedDB schema. One database, eight object stores.
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
    const DB_VERSION = 1;
    const STORES = [
        'students', 'levels', 'attempts', 'events',
        'level_summary', 'week_summary', 'student_summary', 'sync_queue',
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
        }
    }

    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => _upgrade(e.target.result);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
            req.onblocked = () => reject(new Error('indexedDB upgrade blocked by another tab'));
        });
        return dbPromise;
    }

    return {openDB, DB_NAME, DB_VERSION};
})();