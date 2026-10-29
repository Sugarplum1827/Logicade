import { validateDescription } from './validation.js';

const HOST_CHANNEL = 'logicade-host';
const GAME_CHANNEL = 'logicade-game';
const PROTOCOL_VERSION = 1;

function id() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

class HostBridge {
  constructor() {
    this.initialized = null;
    this.initListeners = new Set();
    this.commandListeners = new Set();
    this.isEmbedded = window.parent !== window;
    this.eventLog = [];
    this.emitMeta = { game_id: '01_platformer_quest', variation_id: '01_platformer_quest_v01', seed: 0 };
    window.addEventListener('message', (event) => this.handleMessage(event));
  }

  handleMessage(event) {
    // Only the embedding host may control this frame.
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || data.channel !== HOST_CHANNEL || data.version !== PROTOCOL_VERSION) return;

    if (data.type === 'initialize') {
      const checked = validateDescription(data.description);
      this.initialized = {
        game_id: typeof data.game_id === 'string' ? data.game_id : '01_platformer_quest',
        week: Number.isInteger(data.week) ? data.week : 1,
        level: Number.isInteger(data.level) ? data.level : 1,
        difficulty: typeof data.difficulty === 'string' ? data.difficulty : 'standard',
        description: checked.ok ? checked.description : null,
        descriptionError: checked.ok ? null : checked.errors.join(' '),
      };
      for (const listener of this.initListeners) listener(this.initialized);
      return;
    }

    if (data.type === 'pause' || data.type === 'resume' || data.type === 'hint') {
      for (const listener of this.commandListeners) listener(data.type);
    }
  }

  onInit(listener) {
    this.initListeners.add(listener);
    if (this.initialized) listener(this.initialized);
    return () => this.initListeners.delete(listener);
  }

  onCommand(listener) {
    this.commandListeners.add(listener);
    return () => this.commandListeners.delete(listener);
  }

  setMeta(meta) {
    this.emitMeta = { ...this.emitMeta, ...meta };
  }

  emit(type, payload = {}) {
    const event = {
      channel: GAME_CHANNEL,
      version: PROTOCOL_VERSION,
      type,
      event_id: id(),
      game_id: this.emitMeta.game_id,
      variation_id: this.emitMeta.variation_id,
      seed: this.emitMeta.seed,
      t_ms: Math.round(performance.now()),
      ...payload,
    };
    this.eventLog.push(event);
    window.__logicadeEvents = this.eventLog;
    if (this.isEmbedded) {
      window.parent.postMessage(event, '*');
    } else {
      console.info('[logicade-event]', event);
    }
    return event;
  }
}

export const hostBridge = new HostBridge();
