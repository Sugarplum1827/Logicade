(function () {
  let activeSince = null;
  let activeTotal = 0;
  let paused = false;
  let started = false;
  let promptStart = null;

  function updateClock() {
    const now = performance.now();
    if (activeSince !== null) activeTotal += now - activeSince;
    activeSince = started && !paused && !document.hidden && !globalThis.LogiCadeFirstVisitGuide?.active ? now : null;
  }

  function activeTime() {
    return activeTotal + (activeSince === null ? 0 : performance.now() - activeSince);
  }

  document.addEventListener('visibilitychange', updateClock);
  window.addEventListener('logicade:guidance_changed', updateClock);
  window.addEventListener('message', ({ source, data }) => {
    if (source !== window.parent || data?.channel !== 'logicade-host' || data.version !== 1) return;
    if (data.type === 'pause' || data.type === 'resume') {
      paused = data.type === 'pause';
      updateClock();
    }
  });

  globalThis.LogiCadeStudyTelemetry = {
    start() { started = true; updateClock(); },
    setPaused(value) { paused = value; updateClock(); },
    activePlayMs() { return Math.min(86400000, Math.max(0, Math.round(activeTime()))); },
    present() { if (promptStart === null) promptStart = activeTime(); },
    dismiss() { promptStart = null; },
    takeResponseTime() {
      const elapsed = promptStart === null ? null : Math.min(86400000, Math.max(0, Math.round(activeTime() - promptStart)));
      promptStart = null;
      return elapsed;
    },
    submit(post, kind, target, correct, responseMs) {
      post('scored_submission', {
        entity_id: String(target),
        payload: { kind, target: String(target), correct, response_ms: responseMs },
      });
    },
  };

  let lastInput = -Infinity;
  function reportInput(event) {
    const now = performance.now();
    if (!event.isTrusted || now - lastInput < 1000) return;
    lastInput = now;
    window.parent.postMessage({ channel: 'logicade-game', version: 1, type: 'learner_input' }, '*');
  }
  for (const type of ['keydown', 'pointerdown', 'pointerup', 'wheel', 'input']) {
    window.addEventListener(type, reportInput, { capture: true, passive: true });
  }
})();
