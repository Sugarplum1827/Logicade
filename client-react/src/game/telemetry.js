// §13 telemetry buffer. Emits to console now; Phase 5 will drain to
// IndexedDB + sync queue. Every LevelComplete (§14.2) will build the
// attempt row from this buffer, so shape matters.

window.Telemetry = (function () {
    const buffer = [];

    function emit(eventType, fields) {
        const entry = {
            event_id: crypto.randomUUID(),
            event_type: eventType,
            t_ms_since_start: fields.t_ms_since_start ?? 0,
            entity_id: fields.entity_id ?? null,
            rule_id: fields.rule_id ?? null,
            payload: fields.payload ?? {},
        };
        buffer.push(entry);
        // eslint-disable-next-line no-console
        console.log('[telemetry]', JSON.stringify(entry));
        return entry;
    }

    function snapshot() {
        return buffer.slice();
    }

    function reset() {
        buffer.length = 0;
    }

    return {emit, snapshot, reset};
})();