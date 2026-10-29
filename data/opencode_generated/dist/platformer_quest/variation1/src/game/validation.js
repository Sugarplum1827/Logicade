import { hashSeed } from './rng.js';

const MAX_TEXT = 400;

function cleanText(value, max = MAX_TEXT) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

export function validateDescription(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['Description must be an object.'] };
  }

  const title = cleanText(raw.title, 80);
  const objective = cleanText(raw.objective, 500);
  const hint = cleanText(raw.hint, 500);
  if (!title) errors.push('Missing title.');
  if (!objective) errors.push('Missing objective.');

  const questions = [];
  const seen = new Set();
  const source = Array.isArray(raw.questions) ? raw.questions : [];
  for (const item of source) {
    if (!item || typeof item !== 'object') continue;
    const id = cleanText(item.id, 64);
    const prompt = cleanText(item.prompt, 240);
    const options = Array.isArray(item.options)
      ? item.options.map((option) => cleanText(option, 80))
      : [];
    const explanation = cleanText(item.explanation, 400);
    const correctIndex = Number(item.correctIndex);

    if (
      !id ||
      seen.has(id) ||
      !prompt ||
      options.length !== 4 ||
      options.some((option) => !option) ||
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex > 3
    ) {
      errors.push(`Invalid question at index ${questions.length}.`);
      continue;
    }
    seen.add(id);
    questions.push({
      id,
      prompt,
      options,
      correctIndex,
      explanation,
      hint: cleanText(item.hint, 240),
    });
  }

  if (questions.length === 0) errors.push('No valid questions.');

  const gates = {};
  const gateSource = raw.gates && typeof raw.gates === 'object' ? raw.gates : {};
  for (const gate of ['lower', 'upper', 'final']) {
    const value = gateSource[gate];
    const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    const ids = list
      .map((id) => cleanText(id, 64))
      .filter((id) => seen.has(id));
    gates[gate] = ids;
  }

  if (!gates.lower.length && !gates.upper.length) {
    errors.push('At least one branch gate needs a question.');
  }
  if (!gates.final.length) errors.push('Final gate needs a question.');

  return {
    ok: errors.length === 0,
    errors,
    description: {
      game_id: cleanText(raw.game_id, 64) || '01_platformer_quest',
      variation_id: cleanText(raw.variation_id, 64) || '01_platformer_quest_v01',
      title,
      subtitle: cleanText(raw.subtitle, 80) || 'Forked Routes',
      topic: cleanText(raw.topic, 120) || 'valid variable names',
      objective,
      win_condition: cleanText(raw.win_condition, 300),
      hint,
      difficulty: cleanText(raw.difficulty, 32) || 'standard',
      week: Number.isInteger(raw.week) ? raw.week : 1,
      level: Number.isInteger(raw.level) ? raw.level : 1,
      gates,
      questions,
    },
  };
}

export function selectGateQuestions(description, seed) {
  const byId = new Map(description.questions.map((question) => [question.id, question]));
  const used = new Set();
  const result = {};

  for (const gate of ['lower', 'upper', 'final']) {
    const ids = description.gates[gate] || [];
    const available = ids.filter((id) => byId.has(id));
    const fresh = available.filter((id) => !used.has(id));
    const pool = fresh.length ? fresh : available;
    if (!pool.length) {
      const fallback = description.questions.find((question) => !used.has(question.id));
      if (fallback) {
        result[gate] = fallback;
        used.add(fallback.id);
      }
      continue;
    }
    const random = hashSeed(seed, gate) / 4294967296;
    const chosen = pool[Math.min(pool.length - 1, Math.floor(random * pool.length))];
    result[gate] = byId.get(chosen);
    used.add(chosen);
  }

  return result;
}

export function validateManifest(raw) {
  const assets = [];
  const safePath = /^assets\/[A-Za-z0-9_./-]+\.(png|ogg)$/;
  if (!raw || !Array.isArray(raw.assets)) {
    return { ok: false, assets, errors: ['Manifest is missing an assets array.'] };
  }
  for (const asset of raw.assets) {
    if (!asset || typeof asset.id !== 'string' || typeof asset.path !== 'string') continue;
    if (!safePath.test(asset.path) || asset.path.includes('..')) continue;
    assets.push({ id: asset.id, path: asset.path });
  }
  return { ok: assets.length > 0, assets, errors: assets.length ? [] : ['No safe assets.'] };
}
