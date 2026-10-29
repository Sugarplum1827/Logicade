import { assetIds, buildLayout, hash, normalizeQuestions, resolveTemplate, rng, Round, validateVariation } from './core.js';
import { QUESTION_BANK } from '../missionQuestions.js';

export const TEMPLATE_ROOT = '/data/logicade_phaser_templates/logicade_phaser_templates';
const MAP_IDS = ['forest_path_01', 'cave_path_01'];

let catalogPromise;
let manifestPromise;

async function readJson(path) {
  const response = await fetch(path, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Template data could not be loaded (${response.status}): ${path}`);
  return response.json();
}

export function loadTemplateData() {
  if (!catalogPromise) catalogPromise = readJson(`${TEMPLATE_ROOT}/data/registry.json`).catch((error) => {
    catalogPromise = null;
    throw error;
  });
  if (!manifestPromise) manifestPromise = readJson(`${TEMPLATE_ROOT}/assets/logicade_starter_pack/asset_manifest.json`).catch((error) => {
    manifestPromise = null;
    throw error;
  });
  return Promise.all([catalogPromise, manifestPromise]);
}

export async function selectTemplateForDescription(spec, week, level, runId = 0) {
  const [catalog, manifest] = await loadTemplateData();
  const gameId = String(spec?.file_id || spec?.game_id || spec?.id || 'unknown');
  const selected = resolveTemplate(catalog, {
    game_id: gameId,
    week,
    level,
    run_id: runId,
    description: spec,
  });
  const selectedAssetIds = assetIds(selected.variation);
  const invalid = validateVariation(selected.variation, manifest.assets.map((asset) => asset.id), MAP_IDS, selected.game.render_family);
  if (invalid.length) throw new Error(`Template ${selected.game.template_id} is not valid: ${invalid.join(', ')}`);
  return {
    ...spec,
    phaser_template: {
      template_id: selected.game.template_id,
      display_name: selected.game.display_name,
      module_family: selected.game.module_family,
      render_family: selected.game.render_family,
      variation_id: selected.variation.variation_id,
      variation_title: selected.variation.title,
      template_version: catalog.template_version || '1.0.0',
      visual_theme: manifest.template_themes?.[selected.game.template_id] || null,
      seed: selected.seed,
      run_id: runId,
      map_id: selected.variation.map_id,
      asset_ids: selectedAssetIds,
    },
  };
}

function themedVisualAssets(game, variation, manifest, seed) {
  const theme = manifest.template_themes?.[game.template_id];
  const pool = theme ? manifest.kenney_pack_sets?.[theme] : null;
  const assets = { ...variation.assets };
  if (!pool) return { theme: null, assets, assetIds: [] };

  const random = rng(hash(`${seed}:${game.template_id}:${variation.variation_id}`));
  const choose = (values, fallback = null) => values?.length ? values[Math.floor(random() * values.length)] : fallback;
  const sounds = pool.audio || [];
  const sound = (pattern, fallback) => {
    const candidates = sounds.filter((id) => pattern.test(id));
    return choose(candidates, fallback);
  };
  const defaultAssets = variation.assets;

  assets.bg = choose(pool.backgrounds, defaultAssets.bg);
  assets.bg_tiled = theme === 'underwater';
  assets.tile = choose(pool.tiles, defaultAssets.tile);
  assets.coin = choose(pool.collectibles, defaultAssets.coin);
  assets.goal = choose(pool.goals, defaultAssets.goal);

  const player = choose(pool.players);
  if (player) {
    assets.player_texture = player;
    assets.player_poses = { idle: player, walk_a: player, walk_b: player, jump: player, hit: player };
  }
  const enemy = choose(pool.enemies);
  if (enemy) assets.enemy_texture = enemy;

  if (pool.obstacles?.length) {
    assets.obstacles = Object.fromEntries(['spike', 'bush', 'slime', 'bee'].map((type) => [type, choose(pool.obstacles, defaultAssets.tile)]));
  }
  assets.audio = {
    jump: sound(/laser|space_engine|bubble|splash|footstep/i, 'audio.jump'),
    coin: sound(/coin|power.?up|collect|bubble|chime/i, 'audio.coin'),
    hurt: sound(/impact|explosion|hit|damage|crunch/i, 'audio.hurt'),
    goal: sound(/win|complete|goal|door_open|two_tone/i, 'audio.goal'),
    impact: sound(/impact|explosion|laser|door_close/i, 'audio.impact'),
  };

  const known = new Set(manifest.assets.map((asset) => asset.id));
  const ids = new Set();
  for (const value of Object.values(assets)) {
    if (typeof value === 'string' && known.has(value)) ids.add(value);
    else if (Array.isArray(value)) value.forEach((id) => { if (typeof id === 'string' && known.has(id)) ids.add(id); });
    else if (value && typeof value === 'object') Object.values(value).forEach((id) => { if (typeof id === 'string' && known.has(id)) ids.add(id); });
  }
  return { theme, assets, assetIds: [...ids] };
}

function questionsFor(spec, identity, minimumCount = 1) {
  const direct = spec?.questions || spec?.quiz?.questions || spec?.assessment?.questions;
  if (Array.isArray(direct) && direct.length) return normalizeQuestions(spec);

  // Existing LogiCade fallback descriptions do not embed question arrays.
  // Reuse the app's approved topic bank so the template changes presentation,
  // while the CP1 question content and answer key remain host-owned.
  const topic = spec?.topic || spec?.metadata?.topic || 'Variables & Assignment';
  const bank = QUESTION_BANK[topic] || QUESTION_BANK['Variables & Assignment'];
  const random = rng(hash(identity));
  const questionCount = Math.max(bank.length, minimumCount);
  return normalizeQuestions({
    questions: Array.from({ length: questionCount }, (_, index) => {
      const question = bank[index % bank.length];
      const options = [...question.options];
      for (let i = options.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      return {
        id: `${topic.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${index + 1}`,
        question: question.prompt,
        options,
        answer: question.answer,
      };
    }),
  });
}

export function createTemplateRuntime({ catalog, manifest, spec: originalSpec, meta: originalMeta, studentId, levelId, week, level, difficulty, runId = 0, assetBase = null }) {
  if (!catalog?.games?.length || !manifest?.assets?.length) {
    throw new Error('The Phaser template catalog or asset manifest is empty.');
  }

  const gameId = String(originalSpec?.file_id || originalSpec?.game_id || originalSpec?.id || 'unknown');
  const identity = `${gameId}:${week}:${level}`;
  const selected = resolveTemplate(catalog, {
    game_id: gameId,
    week,
    level,
    run_id: runId,
    difficulty,
    description: originalSpec,
  });
  const baseAssetIds = assetIds(selected.variation);
  const invalid = validateVariation(selected.variation, manifest.assets.map((asset) => asset.id), MAP_IDS, selected.game.render_family);
  if (invalid.length) throw new Error(`Template ${selected.game.template_id} is not valid: ${invalid.join(', ')}`);

  const visual = themedVisualAssets(selected.game, selected.variation, manifest, selected.seed);
  const selectedAssetIds = [...new Set([...baseAssetIds, ...visual.assetIds])];
  const questions = questionsFor(originalSpec, identity, selected.variation.pacing.lives + 1);
  const config = {
    ...selected.variation,
    render_family: selected.game.render_family,
    module_family: selected.game.module_family,
    template_id: selected.game.template_id,
    title: originalSpec?.game_title || originalSpec?.game_concept || selected.game.display_name,
    template_label: `${selected.game.display_name} · ${selected.variation.title}`,
    tint: selected.game.tint,
    seed: selected.seed,
    assets: visual.assets,
    layout: { ...selected.variation.layout, ...buildLayout(selected.variation, questions.length, selected.seed) },
    asset_ids: selectedAssetIds,
  };
  const templateInfo = {
    template_id: selected.game.template_id,
    display_name: selected.game.display_name,
    module_family: selected.game.module_family,
    render_family: selected.game.render_family,
    variation_id: selected.variation.variation_id,
    variation_title: selected.variation.title,
    template_version: catalog.template_version || '1.0.0',
    visual_theme: visual.theme,
    seed: selected.seed,
    run_id: runId,
    map_id: selected.variation.map_id,
    asset_ids: selectedAssetIds,
  };
  const spec = {
    ...originalSpec,
    game_type: selected.game.template_id,
    map: selected.variation.map_id,
    sprite_ids: selectedAssetIds,
    phaser_template: templateInfo,
  };
  const meta = { ...originalMeta, ...templateInfo, variation_seed: selected.seed };
  const base = assetBase || `${TEMPLATE_ROOT}/assets/logicade_starter_pack/`;

  const attemptId = crypto.randomUUID();
  const emit = (type, payload = {}) => {
    if (type === 'game_started') window.Telemetry?.reset({ attemptId, studentId, levelId });
    const eventType = type === 'game_started' ? 'level_start'
      : type === 'question_answered' ? (payload.correct ? 'answer_correct' : 'answer_incorrect')
        : type;
    if (type !== 'game_over') {
      window.Telemetry?.emit(eventType, {
        entity_id: payload.question_id || payload.entity_id || null,
        payload: { ...payload, template_id: selected.game.template_id, variation_id: selected.variation.variation_id },
      });
      return;
    }

    window.Telemetry?.emit(payload.won ? 'level_win' : 'level_lose', {
      payload: { reason: payload.reason, template_id: selected.game.template_id, variation_id: selected.variation.variation_id },
    });
    const result = { ...payload, student_id: studentId, level_id: levelId, score: payload.accuracy, spec: originalSpec, meta };
    const finish = () => window.dispatchEvent(new CustomEvent('logicade:game_over', { detail: result }));
    const persist = window.LogiCadeWrite?.persistAttempt({
      attemptId,
      studentId,
      levelId,
      week,
      stageNumber: level,
      difficulty,
      spec,
      meta,
      score: payload.accuracy,
      accuracy: payload.accuracy,
      errorCount: payload.error_count,
      hintCount: payload.hint_count,
      completionTimeSec: payload.time,
      won: payload.won,
    });
    Promise.resolve(persist).catch((error) => {
      console.error('[template] attempt persistence failed:', error);
    }).finally(finish);
  };

  const round = new Round(questions, config.pacing, selected.seed);
  return { catalog, manifest, config, questions, round, spec, meta, base, emit };
}
