// §13 telemetry buffer. Emits to console now; Phase 5 will drain to
// IndexedDB + sync queue. Every LevelComplete (§14.2) will build the
// attempt row from this buffer, so shape matters.

window.Telemetry = (function () {
    const buffer = [];
    let currentSession = {};

    function emit(eventType, fields = {}) {
        const entry = {
            event_id: crypto.randomUUID(),
            event_type: eventType,
            t_ms_since_start: fields.t_ms_since_start ?? 0,
            entity_id: fields.entity_id ?? null,
            rule_id: fields.rule_id ?? null,
            payload: fields.payload ?? {},
            created_at: new Date().toISOString(),
            origin: navigator.onLine ? 'online' : 'offline',
        };
        buffer.push(entry);
        // eslint-disable-next-line no-console
        console.log('[telemetry]', JSON.stringify(entry));
        return entry;
    }

    function snapshot() {
        return buffer.slice();
    }

    function reset(session = {}) {
        buffer.length = 0;
        currentSession = { ...session };
    }

    return {emit, snapshot, reset, session: () => ({ ...currentSession })};
})();
