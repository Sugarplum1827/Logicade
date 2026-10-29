// Pure logic for the shared LogiCade variation runtime. No Phaser imports here,
// so the same module can be validated from Node during `npm run check`.

export const TEMPLATE_VERSION = '1.0.0';
export const RUNTIME_VERSION = '2.0.0';
export const GRID = { w: 14, h: 9, tile: 64 };
export const KINDS = [
  'linear',
  'fork',
  'loop',
  'vertical',
  'star',
  'snake',
  'switchback',
  'corridor',
  'diagonal',
  'ring',
];
export const MODES = ['runner', 'lane_defense', 'grid_route', 'meter_sim', 'sequence', 'rhythm'];

export const hash = (value) => {
  let h = 2166136261;
  for (const char of String(value)) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const rng = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const shuffle = (items, random) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
};

const clamp = (value, min, max) => +Math.min(max, Math.max(min, value)).toFixed(2);

/**
 * Build a readable route inside the 14 x 9 play field. Points are normalized
 * to tile coordinates (0.5 .. 12.5 on x, 0.5 .. 7.5 on y) so every layout is
 * safe for the shared renderer.
 */
export function buildLayout(variation, questionCount, seed) {
  const random = rng(seed);
  const kind = variation.layout?.kind || 'linear';
  const steps = Math.max(1, questionCount);
  const path = [];
  let side = random() < 0.5 ? -1 : 1;

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    let x = 1 + 11 * t;
    let y = 6;

    if (kind === 'fork') {
      if (index > 0 && index < steps && index % 2 === 1 && random() < 0.5) side = -side;
      y = 6 + side * (index % 2 ? 2 : 1);
    } else if (kind === 'loop') {
      const angle = 2 * Math.PI * t;
      x = 7 + 5 * Math.sin(angle);
      y = 6 - 2 * (1 - Math.cos(angle));
    } else if (kind === 'vertical') {
      x = index % 2 ? 10 : 3;
      y = 7 - 5 * t;
    } else if (kind === 'star') {
      const points = [
        [2, 4],
        [7, 1],
        [12, 4],
        [7, 7],
      ];
      if (index % 2 === 0 || index === steps) {
        [x, y] = [7, 4];
      } else {
        [x, y] = points[(index >> 1) % 4];
      }
    } else if (kind === 'snake') {
      const row = Math.floor(index / 5) % 3;
      const column = index % 5;
      x = row % 2 ? 12 - column * 2.5 : 1 + column * 2.5;
      y = 6 - row * 2;
    } else if (kind === 'switchback') {
      x = 2 + 10 * (index % 4) / 3;
      y = 2 + 4 * (Math.floor(index / 4) % 2);
    } else if (kind === 'corridor') {
      x = 1 + 11 * t;
      y = 6 + Math.sin(t * Math.PI * 2) * 1.4;
    } else if (kind === 'diagonal') {
      x = 1 + 11 * t;
      y = 6 + Math.sin(t * Math.PI) * 3 * side;
    } else if (kind === 'ring') {
      const angle = 2 * Math.PI * t - Math.PI / 2;
      x = 7 + 4.5 * Math.cos(angle);
      y = 4 + 2.6 * Math.sin(angle);
    }

    path.push([clamp(x, 0.5, 12.5), clamp(y, 0.5, 7.5)]);
  }

  const obstacleTypes = ['spike', 'bush', 'slime', 'bee'];
  const obstacles = [];
  const targetObstacles = variation.pacing?.obstacles ?? 4;
  for (let tries = 0; obstacles.length < targetObstacles && tries < 600; tries += 1) {
    const x = clamp(1 + random() * 11.5, 0.5, 12.5);
    const y = clamp(1.5 + random() * 6, 0.5, 7.5);
    if (path.every((point) => Math.hypot(point[0] - x, point[1] - y) > 1.1)) {
      if (obstacles.every((obstacle) => Math.hypot(obstacle.x - x, obstacle.y - y) > 0.9)) {
        obstacles.push({
          x,
          y,
          type: obstacleTypes[Math.floor(random() * obstacleTypes.length)],
        });
      }
    }
  }

  const coins = path
    .filter((_, index) => index % 2 === 1 && index < steps)
    .map((point) => [point[0], Math.max(0.5, point[1] - 1)]);

  return { path, obstacles, coins };
}

export function assetIds(variation) {
  const assets = variation.assets || {};
  if (assets.theme) {
    return [
      ...new Set(
        [
          assets.bg,
          ...(assets.zones || []),
          assets.tile,
          assets.player,
          assets.enemy,
          assets.coin,
          assets.goal,
          assets.follower,
          ...Object.values(assets.obstacles || {}),
        ].filter((id) => typeof id === 'string' && id.length > 0),
      ),
    ];
  }

  const playerFrames =
    assets.player === 'green' ? ['idle', 'walk_a', 'walk_b', 'jump', 'hit'] : ['idle', 'walk_a', 'walk_b'];
  return [
    ...new Set([
      assets.bg,
      ...(assets.zones || []),
      assets.tile,
      assets.coin,
      assets.goal,
      ...playerFrames.map((frame) => `characters.${assets.player}_${frame}`),
      `enemies.${assets.enemy}_rest`,
      'enemies.slime_rest',
      'enemies.bee_rest',
      'tiles.spikes',
      'tiles.bush',
      'tiles.wood',
      'characters.beige_idle',
    ]),
  ];
}

export function validateVariation(variation, manifestIds, mapIds, mode) {
  const errors = [];
  const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;

  if (!KINDS.includes(variation.layout?.kind)) errors.push('layout.kind');
  if (!MODES.includes(mode)) errors.push('mode');
  if (!mapIds.includes(variation.map_id)) errors.push('map_id');
  if (!inRange(variation.pacing?.lives, 1, 6)) errors.push('pacing.lives');
  if (!inRange(variation.pacing?.timer_s, 0, 120)) errors.push('pacing.timer_s');
  if (!inRange(variation.pacing?.approach_s, 6, 40)) errors.push('pacing.approach_s');
  if (!inRange(variation.pacing?.obstacles, 0, 24)) errors.push('pacing.obstacles');
  if (![1, 4].includes(variation.features?.lanes)) errors.push('features.lanes');
  if (!inRange(variation.features?.checkpoint_every, 0, 10)) errors.push('features.checkpoint_every');
  if (!variation.assets?.bg || !variation.assets?.tile || !variation.assets?.player) errors.push('assets');
  if (variation.assets?.theme) {
    if (!variation.assets.theme_label) errors.push('assets.theme_label');
    for (const type of ['spike', 'bush', 'slime', 'bee']) {
      if (!variation.assets.obstacles?.[type]) errors.push(`assets.obstacles.${type}`);
    }
    if (!variation.assets.follower) errors.push('assets.follower');
    for (const id of assetIds(variation)) {
      if (!id.startsWith(`themes.${variation.assets.theme}.`)) {
        errors.push(`asset-theme:${id}`);
      }
    }
  }

  for (const id of assetIds(variation)) {
    if (!manifestIds.includes(id)) errors.push(`asset:${id}`);
  }
  return errors;
}

export function normalizeQuestions(bank) {
  const raw = bank?.questions;
  if (!Array.isArray(raw) || !raw.length) throw new Error('question bank has no questions');

  return raw.map((question, index) => {
    if (!question || typeof question !== 'object') throw new Error(`question ${index + 1} is malformed`);
    const choices = question.options || question.choices || [];
    if (!Array.isArray(choices)) throw new Error(`question ${index + 1} is malformed`);
    const options = choices.map((option) =>
      typeof option === 'string' ? option : String(option?.text ?? ''),
    );
    const indexes = ['answer_index', 'correct_index', 'correctIndex']
      .map((key) => question[key]).filter((value) => value != null);
    if (indexes.some((value) => !Number.isInteger(value) || value !== indexes[0])) {
      throw new Error(`question ${index + 1} has conflicting or invalid answer indexes`);
    }
    let answer = indexes[0];
    if (answer == null) {
      const target = question.answer ?? question.correct_answer;
      answer = Number.isInteger(target) ? target
        : typeof target === 'string' && options.filter((option) => option === target).length === 1
          ? options.indexOf(target) : -1;
    }
    const prompt = question.question ?? question.prompt ?? question.text;
    if (options.length < 2 || options.length > 6 || options.some((option) => !option.trim())
      || !Number.isInteger(answer) || !(answer >= 0 && answer < options.length)
      || typeof prompt !== 'string' || !prompt.trim()) {
      throw new Error(`question ${index + 1} is malformed`);
    }
    return {
      id: String(question.id ?? `q${index + 1}`),
      prompt,
      options,
      answer,
      explanation: question.explanation ? String(question.explanation) : '',
    };
  });
}

export class Round {
  constructor(questions, pacing, seed = 0) {
    const order = shuffle(
      questions.map((_, index) => index),
      rng(seed ^ 0x9e3779b9),
    );
    Object.assign(this, {
      qs: order.map((index) => questions[index]),
      i: 0,
      lives: pacing.lives,
      maxLives: pacing.lives,
      correct: 0,
      errors: 0,
      hints: 0,
      score: 0,
      done: false,
      answered: 0,
      seed,
    });
    this.hinted = new Set();
  }

  get q() {
    return this.qs[this.i];
  }

  record(ok) {
    if (this.done) return null;
    const question = this.q;
    this.answered += 1;
    if (ok) {
      this.correct += 1;
      this.score += 100;
    } else {
      this.errors += 1;
      this.lives -= 1;
    }
    if (this.lives <= 0 || this.answered >= this.qs.length) this.done = true;
    return {
      ok,
      id: question.id,
      step: this.answered,
      explanation: question.explanation,
      correct_index: question.answer,
    };
  }

  answer(index) {
    return this.record(index === this.q?.answer);
  }

  timeout() {
    return this.record(false);
  }

  next() {
    if (!this.done) this.i += 1;
  }

  heal() {
    if (this.lives < this.maxLives) this.lives += 1;
  }

  hint() {
    const question = this.q;
    if (!question || this.done || this.hinted.has(this.i) || question.options.length < 3) return null;
    const wrong = question.options.map((_, index) => index).filter((index) => index !== question.answer);
    const pick = wrong[(this.seed + this.i) % wrong.length];
    this.hinted.add(this.i);
    this.hints += 1;
    return pick;
  }

  result() {
    const total = this.qs.length;
    const won = this.lives > 0 && this.answered >= total;
    return {
      won,
      score: this.score,
      accuracy: total ? +(this.correct / total).toFixed(4) : 0,
      errors: this.errors,
      hints: this.hints,
      reason: won ? 'all_questions_completed' : this.lives <= 0 ? 'out_of_lives' : 'ended_early',
    };
  }
}

export function resolveVariation(catalog, slug, variationIndex) {
  const concept = catalog.concepts.find((item) => item.slug === slug);
  if (!concept) throw new Error(`Unknown concept: ${slug}`);
  const variation = concept.variations.find((item) => item.index === Number(variationIndex));
  if (!variation) throw new Error(`Unknown variation ${variationIndex} for ${slug}`);
  return { concept, variation };
}

export function variationLabel(variation) {
  return `Variation ${String(variation.index).padStart(2, '0')}: ${variation.title}`;
}

export function modeLabel(mode) {
  return (
    {
      runner: 'Route runner',
      lane_defense: 'Lane defense',
      grid_route: 'Grid route',
      meter_sim: 'System builder',
      sequence: 'Sequence solver',
      rhythm: 'Beat matcher',
    }[mode] || mode
  );
}
