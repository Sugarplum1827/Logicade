// Minimal asynchronous IndexedDB surface for exercising the actual outbox and
// write code without a browser or a database service.
export function memoryDatabase(initial = {}) {
  const keyPaths = {
    students: 'student_id', levels: 'level_id', attempts: 'attempt_id',
    events: 'event_id', sync_queue: 'job_id', coin_transactions: 'transaction_id',
    difficulty_decisions: 'decision_id',
  };
  const data = Object.fromEntries(Object.entries(keyPaths).map(([name, key]) => [
    name, new Map((initial[name] || []).map((row) => [row[key], structuredClone(row)])),
  ]));
  const db = {
    rows: (name) => [...data[name].values()].map((row) => structuredClone(row)),
    transaction(names, mode) {
      const allowed = new Set(Array.isArray(names) ? names : [names]);
      let pending = 0;
      let finished = false;
      const tx = {
        abort() {
          finished = true;
          queueMicrotask(() => tx.onabort?.());
        },
        objectStore(name) {
          if (!allowed.has(name) || !data[name]) throw new Error(`Unknown store ${name}`);
          const request = (operation) => {
            const req = {};
            pending += 1;
            queueMicrotask(() => {
              if (finished) return;
              try {
                req.result = operation();
                req.onsuccess?.();
              } catch (error) {
                req.error = tx.error = error;
                req.onerror?.();
                tx.onerror?.();
                finished = true;
              }
              pending -= 1;
              queueMicrotask(() => {
                if (!pending && !finished) { finished = true; tx.oncomplete?.(); }
              });
            });
            return req;
          };
          return {
            get: (key) => request(() => structuredClone(data[name].get(key))),
            getAll: () => request(() => db.rows(name)),
            put: (row) => request(() => {
              if (mode !== 'readwrite') throw new Error('Read-only transaction');
              const key = row[keyPaths[name]];
              if (!key) throw new Error(`Missing key in ${name}`);
              data[name].set(key, structuredClone(row));
              return key;
            }),
            index: (field) => ({
              getAll: (value) => request(() => db.rows(name).filter((row) => row[field] === value)),
            }),
          };
        },
      };
      return tx;
    },
  };
  return db;
}

export function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}
