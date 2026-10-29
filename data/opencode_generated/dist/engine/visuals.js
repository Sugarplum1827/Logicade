// Local-only visual and audio layer for the shared DOM runtime.
//
// The activity mechanics stay readable DOM controls. Around them this module
// mounts a small side-scrolling scene made from the local Kenney art pack,
// moves the hero with mechanic progress, and fires short particle and sound
// reactions on correct, incorrect, hint, and finish events.
//
// Everything is progressively enhanced: if the manifest or an image fails to
// load, the scene keeps its themed gradient and the activity still works.

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const SOUND_STORAGE_KEY = 'logicade.sound.muted';

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const el = (tag, attributes = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') {
      for (const [property, propertyValue] of Object.entries(value)) {
        if (property.startsWith('--')) node.style.setProperty(property, propertyValue);
        else node.style[property] = propertyValue;
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
};

const safeStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const motionQuery = () => {
  try {
    return window.matchMedia?.(REDUCED_QUERY) || null;
  } catch {
    return null;
  }
};

export const preferredReducedMotion = () => Boolean(motionQuery()?.matches);

/**
 * Fetch the local asset manifest once. A missing manifest is not fatal: the
 * caller gets null and the runtime falls back to the themed CSS scene.
 */
export async function loadAssetPack(root) {
  const manifestUrl = root?.dataset?.manifest;
  const assetBase = root?.dataset?.assetBase || './public/';
  if (!manifestUrl) return null;
  const response = await fetch(manifestUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${manifestUrl} returned ${response.status}`);
  const manifest = await response.json();
  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const urlFor = (id) => {
    const assetPath = byId.get(id)?.path;
    if (!assetPath) return '';
    try {
      return new URL(`${assetBase}${assetPath}`, document.baseURI).href;
    } catch {
      return '';
    }
  };
  return { manifest, assetBase, byId, urlFor };
}

/**
 * Five small OGG effects share one mute preference and one lazily-created
 * audio element per effect. Nothing is fetched or played until a user gesture
 * calls play().
 */
export function createSoundManager({ pack = null, storageKey = SOUND_STORAGE_KEY } = {}) {
  const store = safeStorage();
  let muted = store?.getItem(storageKey) === '1';
  let lastPlayed = '';
  const nodes = new Map();

  const audioUrl = (name) => pack?.urlFor?.(`audio.${name}`) || '';

  const makeNode = (name) => {
    const src = audioUrl(name);
    if (!src || typeof Audio === 'undefined') return null;
    try {
      const node = new Audio(src);
      node.preload = 'auto';
      node.volume = name === 'goal' ? 0.58 : name === 'coin' ? 0.42 : 0.38;
      nodes.set(name, node);
      return node;
    } catch {
      return null;
    }
  };

  const play = (name) => {
    if (muted) return false;
    const node = nodes.get(name) || makeNode(name);
    if (!node) return false;
    try {
      node.pause();
      node.currentTime = 0;
      const promise = node.play();
      if (promise && typeof promise.catch === 'function') promise.catch(() => {});
      lastPlayed = name;
      return true;
    } catch {
      return false;
    }
  };

  const setMuted = (next) => {
    muted = Boolean(next);
    try {
      store?.setItem(storageKey, muted ? '1' : '0');
    } catch {
      // Private-mode storage can throw; muting still works for this page.
    }
    if (muted) {
      for (const node of nodes.values()) {
        try {
          node.pause();
        } catch {
          // Ignore a detached or not-yet-loaded media element.
        }
      }
    }
    return muted;
  };

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    if (!next) play('coin');
    return muted;
  };

  return {
    play,
    setMuted,
    toggle,
    get muted() {
      return muted;
    },
    get available() {
      return Boolean(pack?.byId?.has('audio.coin'));
    },
    get lastPlayed() {
      return lastPlayed;
    },
  };
}

const particleCount = (kind) => (kind === 'win' ? 30 : kind === 'miss' ? 10 : 16);
const particleClass = (kind) => (kind === 'win' ? 'is-confetti' : kind === 'miss' ? 'is-dust' : 'is-coin');

/**
 * Build the activity scene. The returned object owns only its own DOM; the
 * runtime remains responsible for scoring, sound choices, and checking.
 */
export function createScene({
  scene: initialScene,
  pack = null,
  sound = null,
  host = null,
  reducedMotion = preferredReducedMotion(),
} = {}) {
  const initial = initialScene || {
    theme: 'space',
    themeLabel: 'Space',
    zones: [],
    obstacles: {},
  };

  const root = el('div', {
    class: 'arcade-scene',
    role: 'group',
    'aria-label': `${initial.themeLabel || 'Activity'} scene`,
    dataset: { theme: initial.theme || 'space', motion: reducedMotion ? 'reduced' : 'full' },
  });

  const art = el('div', { class: 'scene-art', 'aria-hidden': 'true' });
  const bgLayers = [0, 1].map((index) =>
    el('div', { class: `scene-bg${index === 0 ? ' is-active' : ''}`, dataset: { layer: String(index) } }),
  );
  const haze = el('div', { class: 'scene-haze' });
  const ground = el('div', { class: 'scene-ground' });
  const trail = el('div', { class: 'scene-trail' }, el('span', { class: 'scene-trail-fill' }));
  const propNodes = Array.from({ length: 3 }, (_, index) => {
    const img = el('img', { class: 'scene-prop-img', alt: '', draggable: 'false' });
    return {
      node: el('span', { class: 'scene-prop', dataset: { prop: String(index) } }, img),
      img,
    };
  });

  const goalImg = el('img', { class: 'scene-goal-img', alt: '', draggable: 'false' });
  const goal = el('div', { class: 'scene-goal' }, goalImg, el('span', { class: 'scene-goal-glow' }));

  const enemyImg = el('img', { class: 'scene-enemy-img', alt: '', draggable: 'false' });
  const enemy = el('div', { class: 'scene-enemy' }, enemyImg, el('span', { class: 'scene-enemy-shadow' }));

  const heroImg = el('img', { class: 'scene-hero-img', alt: '', draggable: 'false' });
  const hero = el('div', { class: 'scene-hero' }, heroImg, el('span', { class: 'scene-hero-shadow' }));

  const coinNodes = Array.from({ length: 4 }, (_, index) => {
    const img = el('img', { class: 'scene-coin-img', alt: '', draggable: 'false' });
    const node = el('span', { class: 'scene-coin', dataset: { coin: String(index) } }, img);
    return { node, img };
  });

  const motes = el(
    'div',
    { class: 'scene-motes' },
    Array.from({ length: 7 }, (_, index) =>
      el('span', { class: 'scene-mote', style: { '--i': String(index) } }),
    ),
  );
  const fx = el('div', { class: 'scene-fx' });

  art.append(...bgLayers, haze, motes, ground, trail, ...propNodes.map((prop) => prop.node), goal, ...coinNodes.map((coin) => coin.node), enemy, hero, fx);

  const themeLabel = el('span', { class: 'scene-label' });
  const progressLabel = el('span', { class: 'scene-progress-label', text: '0% route' });
  const meterFill = el('span', { class: 'scene-meter-fill' });
  const meter = el(
    'div',
    {
      class: 'scene-meter',
      role: 'progressbar',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': '0',
    },
    meterFill,
  );

  let soundButton = null;
  let soundText = null;
  if (sound?.available) {
    soundText = el('span', { class: 'scene-sound-text' });
    soundButton = el(
      'button',
      {
        type: 'button',
        class: 'scene-sound',
        'aria-pressed': String(!sound.muted),
        title: sound.muted ? 'Unmute sound effects' : 'Mute sound effects',
        onclick: () => {
          sound.toggle();
          refreshSound();
        },
      },
      el(
        'svg',
        { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
        el('path', {
          d: 'M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z',
          fill: 'currentColor',
        }),
        el('path', {
          class: 'scene-sound-wave',
          d: 'M15.3 8.4a5 5 0 0 1 0 7.2M18 5.7a8.7 8.7 0 0 1 0 12.6',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.8',
          'stroke-linecap': 'round',
        }),
      ),
      soundText,
    );
  }

  const hud = el(
    'div',
    { class: 'scene-hud' },
    el('span', { class: 'scene-theme' }, themeLabel),
    meter,
    progressLabel,
    soundButton,
  );
  root.append(art, hud);

  let current = initial;
  let bgIndex = 0;
  let currentBgId = '';
  let flashTimer = null;
  let disposed = false;

  const urlFor = (id) => pack?.urlFor?.(id) || '';
  const setImage = (img, id) => {
    const url = urlFor(id);
    if (!url) {
      img.removeAttribute('src');
      img.classList.add('is-missing');
      return;
    }
    img.classList.remove('is-missing');
    if (img.dataset.assetId !== id) {
      img.dataset.assetId = id;
      img.src = url;
    }
  };

  const applyBackground = (id, instant = false) => {
    const url = urlFor(id);
    if (!url || id === currentBgId) return;
    const nextIndex = instant ? 0 : (bgIndex + 1) % 2;
    const next = bgLayers[nextIndex];
    next.style.backgroundImage = `url("${url}")`;
    next.classList.add('is-active');
    bgLayers[1 - nextIndex].classList.remove('is-active');
    bgIndex = nextIndex;
    currentBgId = id;
  };

  const setTheme = (nextScene) => {
    current = nextScene || current;
    root.dataset.theme = current.theme || 'space';
    root.setAttribute('aria-label', `${current.themeLabel || 'Activity'} scene`);
    themeLabel.textContent = `${current.themeLabel || 'Activity'} route`;
    ground.style.backgroundImage = current.tile ? `url("${urlFor(current.tile)}")` : '';
    setImage(heroImg, current.player);
    setImage(goalImg, current.goal);
    setImage(enemyImg, current.enemy);
    for (const node of coinNodes) setImage(node.img, current.coin);
    const props = [current.obstacles?.spike, current.obstacles?.bush, current.obstacles?.bee];
    propNodes.forEach((prop, index) => setImage(prop.img, props[index]));
    currentBgId = '';
    applyBackground(current.bg || current.zones?.[0] || '', true);
  };

  const originForFx = () => {
    const area = art.getBoundingClientRect();
    const body = hero.getBoundingClientRect();
    return {
      x: Math.max(12, body.left - area.left + body.width / 2),
      y: Math.max(12, body.top - area.top + body.height / 2),
    };
  };

  const clearFlash = () => {
    if (flashTimer) window.clearTimeout(flashTimer);
    flashTimer = null;
  };

  const flash = (name, duration = 700) => {
    clearFlash();
    root.classList.remove('is-cheering', 'is-hit', 'is-hinting', 'is-won', 'is-lost');
    if (name) root.classList.add(name);
    if (name) {
      flashTimer = window.setTimeout(() => {
        if (!disposed) root.classList.remove(name);
        flashTimer = null;
      }, duration);
    }
  };

  const burst = (kind, origin = originForFx()) => {
    if (reducedMotion || disposed) return;
    const count = particleCount(kind);
    for (let index = 0; index < count; index += 1) {
      const angle = kind === 'win' ? -Math.PI * (0.08 + Math.random() * 0.84) : Math.PI * (1.08 + Math.random() * 0.84);
      const distance = kind === 'win' ? 34 + Math.random() * 92 : 16 + Math.random() * 46;
      const particle = el('span', {
        class: `scene-particle ${particleClass(kind)}`,
        style: {
          left: `${origin.x}px`,
          top: `${origin.y}px`,
          '--dx': `${Math.cos(angle) * distance}px`,
          '--dy': `${Math.sin(angle) * distance - (kind === 'win' ? 20 : 8)}px`,
          '--delay': `${Math.round(Math.random() * 120)}ms`,
          '--size': `${kind === 'win' ? 4 + Math.random() * 5 : 3 + Math.random() * 4}px`,
          '--hue': String(Math.round(Math.random() * 360)),
        },
      });
      fx.append(particle);
      const remove = () => particle.remove();
      particle.addEventListener('animationend', remove, { once: true });
      window.setTimeout(remove, 1600);
    }
  };

  const setProgress = (value) => {
    const progress = clamp01(value);
    const percentage = Math.round(progress * 100);
    const zones = current.zones?.length ? current.zones : [current.bg].filter(Boolean);
    const zoneIndex = zones.length ? Math.min(zones.length - 1, Math.floor(progress * zones.length)) : 0;
    applyBackground(zones[zoneIndex] || current.bg);

    hero.style.left = `${4 + progress * 72}%`;
    trail.querySelector('.scene-trail-fill').style.width = `${percentage}%`;
    meterFill.style.width = `${percentage}%`;
    meter.setAttribute('aria-valuenow', String(percentage));
    meter.setAttribute('aria-valuetext', `${percentage}% of the route`);
    progressLabel.textContent = `${percentage}% route`;
    root.dataset.progress = String(percentage);
    coinNodes.forEach((coin, index) => {
      const threshold = (index + 1) / (coinNodes.length + 1);
      coin.node.classList.toggle('is-collected', progress + 0.015 >= threshold);
    });
  };

  const refreshSound = () => {
    if (!soundButton || !sound) return;
    soundButton.setAttribute('aria-pressed', String(!sound.muted));
    soundButton.dataset.muted = String(sound.muted);
    soundButton.title = sound.muted ? 'Unmute sound effects' : 'Mute sound effects';
    if (soundText) soundText.textContent = sound.muted ? 'Muted' : 'Sound on';
  };

  setTheme(initial);
  setProgress(0);
  refreshSound();

  const scene = {
    root,
    get current() {
      return current;
    },
    setScene(nextScene) {
      flash(null);
      setTheme(nextScene);
      setProgress(0);
    },
    setProgress,
    celebrate() {
      flash('is-cheering', 820);
      burst('correct');
    },
    miss() {
      flash('is-hit', 650);
      burst('miss');
    },
    hint() {
      flash('is-hinting', 900);
    },
    win() {
      flash('is-won', 2400);
      setProgress(1);
      burst('win');
    },
    lose() {
      flash('is-lost', 1600);
      burst('miss');
    },
    reset() {
      flash(null);
      setProgress(0);
    },
    setReducedMotion(next) {
      reducedMotion = Boolean(next);
      root.dataset.motion = reducedMotion ? 'reduced' : 'full';
    },
    destroy() {
      disposed = true;
      clearFlash();
      root.remove();
    },
  };

  if (host) host.append(root);
  return scene;
}
