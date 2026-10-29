// Host bridge: listens only to window.parent on channel `logicade-host` v1 and
// emits `logicade-game` v1 events. In a standalone tab it logs to the console
// and keeps a local event log for verification.

export function createBridge(win = window) {
  const listeners = {};
  const session = globalThis.crypto?.randomUUID?.() || String(Math.random()).slice(2);
  const log = (win.__logicadeEvents = []);
  let sequence = 0;
  let gameOverSent = false;
  let origin = '*';
  const local = win.parent === win;

  const send = (type, payload = {}) => {
    if (type === 'game_over') {
      if (gameOverSent) return;
      gameOverSent = true;
    }
    const message = {
      channel: 'logicade-game',
      version: 1,
      type,
      event_id: `${session}-${++sequence}`,
      ts: Date.now(),
      ...payload,
    };
    log.push(message);
    if (local) console.info('[logicade-game]', message);
    else win.parent.postMessage(message, origin);
  };

  win.addEventListener('message', (event) => {
    if (event.source !== win.parent) return;
    const message = event.data;
    if (!message || message.channel !== 'logicade-host' || message.version !== 1) return;
    if (event.origin && event.origin !== 'null') origin = event.origin;
    listeners[message.type]?.(message);
  });

  return {
    on: (type, handler) => {
      listeners[type] = handler;
    },
    send,
    local,
    reset: () => {
      gameOverSent = false;
    },
  };
}
