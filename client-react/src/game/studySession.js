export const INACTIVITY_THRESHOLD_MS = 60_000;

export function measureInterval(from, to, lastInput, visible) {
  const duration = Math.max(0, to - from);
  if (!visible) return { active: 0, inactive: 0 };
  const active = Math.min(duration, Math.max(0, lastInput + INACTIVITY_THRESHOLD_MS - from));
  return { active, inactive: duration - active };
}

export function initStudySession() {
  let session = null;

  function accrue(now) {
    const { active, inactive } = measureInterval(session.measuredAt, now, session.lastInput, session.visible);
    session.active += active;
    session.inactive += inactive;
    session.measuredAt = now;
  }

  function snapshot() {
    if (!session) return;
    const now = performance.now();
    accrue(now);
    return {
      session_id: session.id,
      student_id: session.studentId,
      started_at: new Date(session.epoch).toISOString(),
      duration_ms: Math.floor(now - session.started),
      active_ms: Math.floor(session.active),
      inactive_ms: Math.floor(session.inactive),
    };
  }

  async function save() {
    const payload = snapshot();
    if (!payload || payload.duration_ms <= session.lastSaved) return;
    const current = session;
    current.lastSaved = payload.duration_ms;
    try {
      await enqueue(payload);
    } catch (error) {
      if (current.lastSaved === payload.duration_ms) current.lastSaved = 0;
      throw error;
    }
  }

  async function enqueue(payload) {
    const db = await window.LogiCadeDB.openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').put({
        job_id: crypto.randomUUID(), created_at: new Date().toISOString(),
        table: 'learner_sessions', op: 'upsert', payload, status: 'pending', attempts: 0,
      });
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error('Session checkpoint was not saved'));
    });
  }

  const checkpoint = () => save().catch(error => console.warn('[study session]', error));
  function refresh() {
    const studentId = localStorage.getItem('logicade_session_token') && localStorage.getItem('logicade_current_user');
    if (session?.studentId === studentId) return;
    checkpoint();
    const now = performance.now();
    session = studentId ? {
      id: crypto.randomUUID(), studentId, epoch: Date.now(), started: now, measuredAt: now,
      lastInput: now, visible: !document.hidden, active: 0, inactive: 0, lastSaved: 0,
    } : null;
  }

  function input() {
    if (!session?.visible) return;
    const now = performance.now();
    accrue(now);
    session.lastInput = now;
  }

  window.LogiCadeStudySession = { input, checkpoint, snapshotFor: studentId => session?.studentId === studentId ? snapshot() : null };
  for (const type of ['keydown', 'pointerdown', 'pointerup', 'wheel', 'input']) {
    window.addEventListener(type, event => { if (event.isTrusted) input(); }, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!session) return;
    checkpoint();
    session.visible = !document.hidden;
  });
  window.addEventListener('pagehide', checkpoint);
  window.addEventListener('logicade:session_changed', refresh);
  window.addEventListener('storage', event => {
    if (['logicade_current_user', 'logicade_session_token'].includes(event.key)) refresh();
  });
  setInterval(checkpoint, 30_000);
  refresh();
}
