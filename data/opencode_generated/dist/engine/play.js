// LogiCade interactive runtime.
//
// CP1 pages load one authored challenge from a per-concept challenge bank.
// Classic pages load their existing question bank and adapt each prompt into
// an interactive mechanic (ordering, assembly, repair, sorting, recall).
// No Phaser, no multiple-choice buttons.

import {
  CLASSIC_MECHANICS,
  buildAdaptiveChallenge,
  mechanicInfo,
  renderChallenge,
} from './challenges.js';
import { modeLabel, normalizeQuestions, variationLabel } from './core.js';
import { sceneForVariation } from './scene-data.js';
import { createScene, createSoundManager, loadAssetPack } from './visuals.js';
import { createBridge } from './bridge.js';

const fatal = document.getElementById('fatal-error');
const fatalMessage = document.getElementById('fatal-error-message');
const root = document.getElementById('game-root');

const showFatal = (message) => {
  console.error('[logicade]', message);
  if (fatal && fatalMessage) {
    fatalMessage.textContent = message;
    fatal.hidden = false;
  }
  if (root) root.dataset.gameError = 'true';
};

const fetchJson = async (url) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
};

const setText = (id, value) => {
  const element = document.getElementById(id);
  if (element && value != null) element.textContent = value;
};

const setHref = (id, value) => {
  const element = document.getElementById(id);
  if (element && value) element.setAttribute('href', value);
};

const announce = (id, value) => setText(id, value);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const clear = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild);
};

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const stat = (label, value, key) =>
  el(
    'div',
    { class: 'arcade-stat' },
    el('span', { class: 'arcade-stat-label', text: label }),
    el('strong', { class: 'arcade-stat-value', dataset: { stat: key }, text: String(value) }),
  );

window.addEventListener('error', (event) => {
  if (event.message) showFatal(event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  showFatal(reason || 'Unhandled promise rejection');
});

async function main() {
  if (!root) throw new Error('Missing #game-root');

  // Art and sound are enhancements: a manifest failure must never stop the
  // activity from loading its challenge bank.
  const assetPackPromise = loadAssetPack(root).catch((error) => {
    console.warn('[logicade] asset manifest unavailable:', error?.message || error);
    return null;
  });

  const variationUrl = root.dataset.variation || './variation.json';
  const catalogUrl = root.dataset.catalog || '../../index.html';
  const bridge = createBridge();
  let pendingInitialize = null;
  let bootReady = false;
  let applyInitialize = null;

  bridge.on('initialize', (message) => {
    if (!bootReady || !applyInitialize) {
      pendingInitialize = message;
      return;
    }
    applyInitialize(message);
  });

  const variation = await fetchJson(variationUrl);
  const conceptName = variation.display_name || variation.concept_name || 'LogiCade';
  const isCp1 = variation.track === 'cp1' || Boolean(variation.challenge_bank);
  const seed = Number(variation.seed) >>> 0;

  let challenges = [];
  let single = false;
  let activeSource = 'local catalog';

  const buildClassic = (questions, source) => {
    const offset = Math.max(0, (Number(variation.index) || 1) - 1);
    return questions.map((question, index) => {
      const type = CLASSIC_MECHANICS[(offset + index) % CLASSIC_MECHANICS.length];
      const challenge = buildAdaptiveChallenge(question, type, { seed: seed ^ (index + 1) });
      return {
        ...challenge,
        id: `${variation.variation_id || variation.slug || 'classic'}_q${index + 1}`,
        mechanic: challenge.type,
        mechanic_label: mechanicInfo(challenge.type).label,
      };
    });
  };

  if (isCp1) {
    const bank = await fetchJson(variation.challenge_bank);
    if (!Array.isArray(bank) || !bank.length) throw new Error('CP1 challenge bank is empty');
    const index = Math.max(1, Number(variation.challenge_index) || 1);
    const challenge = bank.find((entry) => Number(entry.index) === index) || bank[index - 1] || bank[0];
    challenges = [challenge];
    single = true;
    activeSource = 'CP1 authored bank';
  } else {
    const questionsUrl = variation.question_bank || root.dataset.questions || '../../data/questions/platformer_quest.json';
    const bank = await fetchJson(questionsUrl);
    challenges = buildClassic(normalizeQuestions(bank), 'local question bank');
    activeSource = 'classic adaptive bank';
  }

  const assetPack = await assetPackPromise;
  const sceneModel = sceneForVariation(variation);
  const sound = createSoundManager({ pack: assetPack });
  const scene = createScene({
    scene: sceneModel,
    pack: assetPack,
    sound,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false,
  });
  document.body.dataset.theme = sceneModel.theme;
  root.dataset.sound = sound.muted ? 'muted' : 'on';

  const arena = el('div', { class: 'arcade', dataset: { state: 'ready', track: isCp1 ? 'cp1' : 'classic' } });
  const scoreValue = el('strong', { class: 'arcade-stat-value', dataset: { stat: 'score' }, text: '0' });
  const livesValue = el('strong', { class: 'arcade-stat-value', dataset: { stat: 'lives' }, text: '3' });
  const roundValue = el('strong', { class: 'arcade-stat-value', dataset: { stat: 'round' }, text: `0/${challenges.length}` });
  const hud = el(
    'div',
    { class: 'arcade-hud' },
    el(
      'div',
      { class: 'arcade-ident' },
      el('span', { class: 'arcade-kicker', text: isCp1 ? 'CP1 interactive lab' : modeLabel(variation.mode || 'sequence') }),
      el('strong', { class: 'arcade-concept', text: conceptName }),
    ),
    el(
      'div',
      { class: 'arcade-stats' },
      el('div', { class: 'arcade-stat' }, el('span', { class: 'arcade-stat-label', text: 'Score' }), scoreValue),
      el('div', { class: 'arcade-stat' }, el('span', { class: 'arcade-stat-label', text: 'Lives' }), livesValue),
      el('div', { class: 'arcade-stat' }, el('span', { class: 'arcade-stat-label', text: single ? 'Lab' : 'Round' }), roundValue),
    ),
  );
  const progressFill = el('span', { class: 'arcade-progress-fill', style: { width: '0%' } });
  const progress = el('div', { class: 'arcade-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, progressFill);
  const stage = el('div', { class: 'arcade-stage' });
  arena.append(hud, progress, scene.root, stage);
  clear(root);
  root.append(arena);

  const state = {
    challenges,
    index: 0,
    total: challenges.length,
    score: 0,
    lives: 3,
    correct: 0,
    answered: 0,
    hints: 0,
    streak: 0,
    attempts: 0,
    started: false,
    paused: false,
    solved: false,
    revealed: false,
    finished: false,
    outOfLives: false,
    single,
    source: activeSource,
  };
  let view = null;

  const syncSceneProgress = () => {
    if (!state.started || state.finished) return;
    const currentProgress = state.solved ? 1 : clamp01(view?.progress?.() || 0);
    const overall = state.total ? (state.index + currentProgress) / state.total : 0;
    scene.setProgress(overall);
  };

  stage.addEventListener('click', () => requestAnimationFrame(syncSceneProgress));
  stage.addEventListener('keyup', () => requestAnimationFrame(syncSceneProgress));
  stage.addEventListener('input', () => requestAnimationFrame(syncSceneProgress));
  window.setInterval(syncSceneProgress, 900);

  const updateHud = () => {
    scoreValue.textContent = String(state.score);
    livesValue.textContent = String(state.lives);
    roundValue.textContent = `${state.started ? state.index + 1 : 0}/${state.total}`;
    const current = state.solved ? 1 : clamp01(view?.progress?.() || 0);
    const overall = state.total ? (state.index + current) / state.total : 0;
    progressFill.style.width = `${Math.round(overall * 100)}%`;
    progress.setAttribute('aria-valuenow', String(Math.round(overall * 100)));
    scene.setProgress(overall);
    root.dataset.gameReady = 'true';
    root.dataset.score = String(state.score);
    root.dataset.lives = String(state.lives);
    root.dataset.round = String(state.index + 1);
  };

  const emit = (type, payload = {}) =>
    bridge.send(type, {
      concept_id: variation.concept_id,
      variation_id: variation.variation_id,
      template_version: variation.template_version || '2.0.0',
      mode: isCp1 ? 'cp1_lab' : variation.mode,
      track: isCp1 ? 'cp1' : 'classic',
      ...payload,
    });

  const current = () => state.challenges[state.index];

  const renderStart = () => {
    view = null;
    state.started = false;
    state.paused = false;
    state.finished = false;
    state.solved = false;
    state.revealed = false;
    state.outOfLives = false;
    state.attempts = 0;
    arena.dataset.state = 'ready';
    scene.reset();
    clear(stage);
    const first = current();
    const mechanics = state.single
      ? [first.mechanic_label || mechanicInfo(first.type || first.mechanic).label]
      : [...new Set(state.challenges.map((entry) => entry.mechanic_label || mechanicInfo(entry.type).label))];
    const start = el(
      'button',
      { type: 'button', class: 'arcade-primary', onclick: startRound },
      state.single ? 'Start this lab' : 'Start the run',
    );
    stage.append(
      el(
        'section',
        { class: 'arcade-card start-card' },
        el('p', { class: 'arcade-eyebrow', text: state.single ? 'One focused mechanic' : 'Adaptive practice run' }),
        el('h2', { class: 'arcade-title', text: state.single ? first.title : `${conceptName} challenge run` }),
        el('p', { class: 'arcade-prompt', text: state.single ? first.prompt : variation.core_brief || variation.learning_target || '' }),
        el('p', { class: 'arcade-instruction', text: state.single ? first.instruction : 'Each prompt is rebuilt as an interactive task. Read, move, wire, sort, or repair your way to the answer.' }),
        el(
          'ul',
          { class: 'arcade-mechanics', 'aria-label': 'Mechanics in this activity' },
          mechanics.slice(0, 6).map((label) => el('li', { class: 'arcade-mechanic-chip', text: label })),
        ),
        el('div', { class: 'arcade-actions' }, start),
        el('p', { class: 'arcade-fine', text: `${state.total} ${state.total === 1 ? 'activity' : 'activities'} · 3 lives · local and offline` }),
      ),
    );
    updateHud();
    announce('sr-status', `${conceptName} ready. Press Enter or activate Start.`);
    requestAnimationFrame(() => start.focus());
  };

  const showFeedback = (kind, message) => {
    const box = stage.querySelector('.challenge-feedback');
    if (!box) return;
    box.className = `challenge-feedback is-${kind}`;
    box.textContent = message;
  };

  const finish = (won) => {
    if (state.finished) return;
    state.finished = true;
    arena.dataset.state = 'finished';
    if (won) {
      sound.play('goal');
      scene.win();
    } else {
      sound.play('hurt');
      scene.lose();
    }
    const accuracy = state.total ? state.correct / state.total : 0;
    const results = {
      won,
      score: state.score,
      correct: state.correct,
      answered: state.answered,
      total: state.total,
      accuracy,
      hints: state.hints,
      track: isCp1 ? 'cp1' : 'classic',
    };
    emit('game_over', results);
    window.dispatchEvent(new CustomEvent('logicade:results', { detail: results }));
    clear(stage);
    stage.append(
      el(
        'section',
        { class: 'arcade-card result-card' },
        el('p', { class: 'arcade-eyebrow', text: won ? 'Complete' : 'Run ended' }),
        el('h2', { class: 'arcade-title', text: won ? (state.single ? 'Lab cleared' : 'Challenge run cleared') : 'Out of lives' }),
        el('p', { class: 'arcade-prompt', text: won
          ? 'You worked through every mechanic in this set.'
          : (bridge.local
            ? 'The solution for the current task was revealed. Review it, then try the set again.'
            : 'The solution for the current task was revealed. Return to LogiCade to choose another challenge.') }),
        el(
          'div',
          { class: 'result-grid' },
          el('div', { class: 'result-stat' }, el('span', { text: 'Score' }), el('strong', { text: String(state.score) })),
          el('div', { class: 'result-stat' }, el('span', { text: 'Correct' }), el('strong', { text: `${state.correct}/${state.total}` })),
          el('div', { class: 'result-stat' }, el('span', { text: 'Accuracy' }), el('strong', { text: `${Math.round(accuracy * 100)}%` })),
          el('div', { class: 'result-stat' }, el('span', { text: 'Hints' }), el('strong', { text: String(state.hints) })),
        ),
        el(
          'div',
          { class: 'arcade-actions' },
          ...(bridge.local ? [
            el('button', { type: 'button', class: 'arcade-primary', onclick: restart }, 'Try again'),
            el('a', { class: 'arcade-secondary', href: variation.urls?.concept || '../index.html' }, isCp1 ? 'All labs in this concept' : 'All variations in this concept'),
            el('a', { class: 'arcade-ghost', href: catalogUrl }, 'Catalog'),
          ] : []),
        ),
      ),
    );
    announce('sr-status', `${won ? 'Complete.' : 'Out of lives.'} Score ${state.score}. Accuracy ${Math.round(accuracy * 100)} percent.`);
  };

  const reveal = () => {
    if (!view || state.solved || state.paused) return;
    state.revealed = true;
    state.solved = true;
    state.attempts += 1;
    sound.play('impact');
    scene.hint();
    const message = view.reveal?.() || 'Solution shown.';
    showFeedback('reveal', message);
    const check = stage.querySelector('[data-action="check"]');
    const reset = stage.querySelector('[data-action="reset"]');
    const revealButton = stage.querySelector('[data-action="reveal"]');
    if (check) check.hidden = true;
    if (reset) reset.hidden = true;
    if (revealButton) revealButton.hidden = true;
    const next = stage.querySelector('[data-action="next"]');
    if (next) {
      next.hidden = false;
      next.textContent = state.index + 1 >= state.total ? 'See results' : 'Next activity';
      next.focus();
    }
    const currentChallenge = current();
    const feedback = {
      correct: false,
      revealed: true,
      explanation: currentChallenge.explanation || '',
      lives: state.lives,
      score: state.score,
    };
    emit('question_answered', {
      question_id: currentChallenge.id,
      question_index: state.index + 1,
      total: state.total,
      mechanic: currentChallenge.mechanic || currentChallenge.type,
      ...feedback,
    });
    window.dispatchEvent(new CustomEvent('logicade:feedback', { detail: feedback }));
    updateHud();
  };

  const check = () => {
    if (!view || state.solved || state.finished || state.paused) return;
    let correct = false;
    try {
      correct = Boolean(view.check());
    } catch (error) {
      showFeedback('incorrect', error instanceof Error ? error.message : String(error));
      return;
    }
    state.answered += 1;
    const currentChallenge = current();
    if (correct) {
      state.solved = true;
      state.correct += 1;
      state.streak += 1;
      state.score += 100 + Math.min(5, state.streak - 1) * 10;
      state.attempts = 0;
      sound.play('coin');
      scene.celebrate();
      const explanation = currentChallenge.explanation || '';
      showFeedback('correct', `Correct. +${100 + Math.min(5, state.streak - 1) * 10} points.${explanation ? ` ${explanation}` : ''}`);
      const checkButton = stage.querySelector('[data-action="check"]');
      const hintButton = stage.querySelector('[data-action="hint"]');
      const reset = stage.querySelector('[data-action="reset"]');
      const revealButton = stage.querySelector('[data-action="reveal"]');
      if (checkButton) checkButton.hidden = true;
      if (hintButton) hintButton.hidden = true;
      if (reset) reset.hidden = true;
      if (revealButton) revealButton.hidden = true;
      const next = stage.querySelector('[data-action="next"]');
      if (next) {
        next.hidden = false;
        next.textContent = state.index + 1 >= state.total ? 'See results' : 'Next activity';
        next.focus();
      }
      const feedback = { correct: true, explanation, lives: state.lives, score: state.score, streak: state.streak };
      emit('question_answered', {
        question_id: currentChallenge.id,
        question_index: state.index + 1,
        total: state.total,
        mechanic: currentChallenge.mechanic || currentChallenge.type,
        ...feedback,
      });
      emit('activity_completed', {
        activity_id: currentChallenge.id,
        index: state.index + 1,
        total: state.total,
        mechanic: currentChallenge.mechanic || currentChallenge.type,
        score: state.score,
      });
      window.dispatchEvent(new CustomEvent('logicade:feedback', { detail: feedback }));
      announce('sr-feedback', `Correct. ${explanation} Lives ${state.lives}. Score ${state.score}.`);
    } else {
      state.lives -= 1;
      state.streak = 0;
      state.attempts += 1;
      sound.play('hurt');
      scene.miss();
      showFeedback('incorrect', state.lives > 0 ? 'Not quite. Adjust your answer and check again, or use a hint.' : 'Not quite. That was the last life.');
      const feedback = { correct: false, explanation: '', lives: state.lives, score: state.score };
      emit('question_answered', {
        question_id: currentChallenge.id,
        question_index: state.index + 1,
        total: state.total,
        mechanic: currentChallenge.mechanic || currentChallenge.type,
        ...feedback,
      });
      window.dispatchEvent(new CustomEvent('logicade:feedback', { detail: feedback }));
      announce('sr-feedback', `Not correct. Lives ${state.lives}. Score ${state.score}.`);
      if (state.attempts >= 2) {
        const revealButton = stage.querySelector('[data-action="reveal"]');
        if (revealButton) revealButton.hidden = false;
      }
      if (state.lives <= 0) {
        state.outOfLives = true;
        reveal();
      }
    }
    updateHud();
  };

  const hint = () => {
    if (!view || state.solved || state.finished || state.paused) return;
    const message = view.hint?.() || 'Hint: review the instructions and try one piece at a time.';
    state.hints += 1;
    state.score = Math.max(0, state.score - 10);
    sound.play('impact');
    scene.hint();
    showFeedback('hint', message);
    emit('hint_used', {
      question_id: current().id,
      question_index: state.index + 1,
      hint: message,
      hints: state.hints,
    });
    window.dispatchEvent(new CustomEvent('logicade:feedback', { detail: { correct: false, hint: message, lives: state.lives, score: state.score } }));
    announce('sr-feedback', message);
    updateHud();
  };

  const next = () => {
    if (!state.solved || state.finished) return;
    if (state.outOfLives) {
      finish(false);
      return;
    }
    if (state.index + 1 < state.total) sound.play('jump');
    state.index += 1;
    if (state.index >= state.total) {
      finish(true);
      return;
    }
    renderCurrent();
  };

  const renderCurrent = () => {
    if (state.index >= state.total) {
      finish(true);
      return;
    }
    const challenge = current();
    state.solved = false;
    state.revealed = false;
    state.attempts = 0;
    state.paused = false;
    arena.dataset.state = 'playing';
    scene.reset();
    clear(stage);
    const mount = el('div', { class: 'challenge-mount' });
    const feedback = el('div', { class: 'challenge-feedback', role: 'status', 'aria-live': 'polite' });
    const checkButton = el('button', { type: 'button', class: 'arcade-primary', dataset: { action: 'check' }, onclick: check }, 'Check answer');
    const hintButton = el('button', { type: 'button', class: 'arcade-secondary', dataset: { action: 'hint' }, onclick: hint }, 'Hint');
    const resetButton = el('button', { type: 'button', class: 'arcade-ghost', dataset: { action: 'reset' }, onclick: () => view?.reset?.() }, 'Reset');
    const revealButton = el('button', { type: 'button', class: 'arcade-ghost', dataset: { action: 'reveal' }, onclick: reveal, hidden: true }, 'Show solution');
    const nextButton = el('button', { type: 'button', class: 'arcade-primary', dataset: { action: 'next' }, onclick: next, hidden: true }, 'Next activity');
    const mechanic = challenge.mechanic || challenge.type;
    stage.append(
      el(
        'section',
        { class: 'arcade-card challenge-card', dataset: { mechanic } },
        el(
          'header',
          { class: 'challenge-head' },
          el(
            'span',
            { class: 'arcade-pill mechanic' },
            el('span', { class: 'arcade-pill-icon', text: mechanicInfo(mechanic).icon || '*' }),
            el('span', { text: challenge.mechanic_label || mechanicInfo(mechanic).label }),
          ),
          el('span', { class: 'arcade-pill round', text: state.single ? 'Single lab' : `${state.index + 1} of ${state.total}` }),
        ),
        el('h2', { class: 'arcade-title challenge-title', text: challenge.title }),
        el('p', { class: 'arcade-prompt challenge-prompt', text: challenge.prompt }),
        el('p', { class: 'arcade-instruction', text: challenge.instruction }),
        mount,
        el('div', { class: 'challenge-actions' }, checkButton, hintButton, resetButton, revealButton, nextButton),
        feedback,
      ),
    );
    try {
      view = renderChallenge(challenge.type || mechanic, challenge.payload, { seed: seed ^ (state.index + 1) });
      mount.append(view.root);
      const label = view.checkLabel || 'Check answer';
      checkButton.textContent = label;
    } catch (error) {
      showFatal(error instanceof Error ? error.message : String(error));
      return;
    }
    updateHud();
    const detail = {
      index: state.index + 1,
      total: state.total,
      prompt: challenge.prompt,
      instruction: challenge.instruction,
      mechanic,
      options: [],
    };
    window.dispatchEvent(new CustomEvent('logicade:question', { detail }));
    announce('sr-question', `${state.single ? 'Lab' : 'Challenge'} ${state.index + 1} of ${state.total}. ${challenge.prompt} ${challenge.instruction}`);
    root.dataset.gameReady = 'true';
  };

  function startRound() {
    if (state.started) return;
    state.started = true;
    state.finished = false;
    state.score = 0;
    state.lives = 3;
    state.correct = 0;
    state.answered = 0;
    state.hints = 0;
    state.streak = 0;
    sound.play('jump');
    scene.reset();
    bridge.reset();
    emit('game_started', { total: state.total, first_mechanic: current()?.mechanic || current()?.type || '' });
    renderCurrent();
    announce('sr-status', `Started ${conceptName}.`);
  }

  function restart() {
    state.index = 0;
    state.started = false;
    state.score = 0;
    state.lives = 3;
    state.correct = 0;
    state.answered = 0;
    state.hints = 0;
    state.streak = 0;
    state.solved = false;
    state.revealed = false;
    state.finished = false;
    state.outOfLives = false;
    sound.play('jump');
    scene.reset();
    bridge.reset();
    renderStart();
  }

  const setPaused = (paused) => {
    if (!state.started || state.finished) return;
    state.paused = Boolean(paused);
    arena.classList.toggle('is-paused', state.paused);
    scene.root.classList.toggle('is-paused', state.paused);
    const existing = stage.querySelector('.arcade-pause');
    if (state.paused && !existing) {
      stage.append(
        el(
          'div',
          { class: 'arcade-pause', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paused' },
          el('strong', { text: 'Paused' }),
          el('p', { text: 'The activity is waiting. Resume when you are ready.' }),
          el('button', { type: 'button', class: 'arcade-primary', onclick: () => setPaused(false) }, 'Resume'),
        ),
      );
    } else if (!state.paused) {
      existing?.remove();
    }
  };

  applyInitialize = (message) => {
    const description = message?.description;
    if (!description?.questions) return;
    try {
      const questions = normalizeQuestions(description);
      state.challenges = buildClassic(questions, 'host initialize');
      state.total = state.challenges.length;
      state.single = false;
      state.index = 0;
      state.source = 'host initialize';
      activeSource = 'host initialize';
      restart();
    } catch (error) {
      console.warn('[logicade] host description rejected:', error);
    }
  };

  bridge.on('pause', () => setPaused(true));
  bridge.on('resume', () => setPaused(false));
  bridge.on('hint', () => hint());

  window.addEventListener('keydown', (event) => {
    const typing = event.target instanceof Element && event.target.matches('input, textarea, select');
    if (event.key === 'Enter' && typing) {
      event.preventDefault();
      check();
      return;
    }
    if (typing) return;
    if (event.key === 'Enter') {
      if (!state.started) startRound();
      else if (state.solved) next();
      else check();
    } else if (event.key.toLowerCase() === 'h') {
      hint();
    } else if (event.key.toLowerCase() === 'r') {
      restart();
    } else if (event.key === 'Escape') {
      setPaused(!state.paused);
    }
  });

  window.addEventListener('logicade:ready', () => {
    root.dataset.gameReady = 'true';
  });

  const label = isCp1 ? `Lab ${String(variation.challenge_index || 1).padStart(2, '0')}` : variationLabel(variation);
  document.title = `${conceptName} · ${variation.title || label}`;
  setText('concept-name', conceptName);
  setText('variation-name', isCp1 ? `${label}: ${current().title}` : label);
  setText('learning-target', variation.learning_target);
  setText('core-brief', variation.core_brief);
  setText('mode-label', isCp1 ? current().mechanic_label : modeLabel(variation.mode || 'sequence'));
  setText('question-count', String(state.total));
  setHref('catalog-link', catalogUrl);
  setHref('concept-link', variation.urls?.concept || '../index.html');
  setHref('prev-link', variation.urls?.previous || '');
  setHref('next-link', variation.urls?.next || '');
  document.documentElement.style.setProperty('--accent', variation.accent || '#7ee2b8');
  document.documentElement.style.setProperty('--accent-soft', `${variation.accent || '#7ee2b8'}33`);
  document.body.dataset.track = isCp1 ? 'cp1' : 'classic';
  document.body.dataset.concept = variation.slug || '';
  document.body.dataset.variation = String(variation.index || 1);
  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.setAttribute(
      'content',
      `${conceptName}: ${variation.title || label}. Practise ${variation.learning_target || 'programming'} with an interactive LogiCade lab.`,
    );
  }

  const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (motionPreference?.addEventListener) {
    motionPreference.addEventListener('change', (event) => scene.setReducedMotion(event.matches));
  }

  renderStart();
  bootReady = true;
  if (pendingInitialize) {
    const message = pendingInitialize;
    pendingInitialize = null;
    applyInitialize(message);
  }

  window.__logicade = {
    variation,
    state,
    challenges,
    bridge,
    sound,
    scene,
    get view() {
      return view;
    },
    start: startRound,
    restart,
    check,
    hint,
    next,
    reveal,
    setPaused,
  };
  window.__logicadeBoot = (questions, nextSeed) => {
    if (questions) {
      applyInitialize({ description: { questions } });
    }
    if (nextSeed != null) {
      state.challenges = state.challenges;
    }
  };
  window.dispatchEvent(new CustomEvent('logicade:ready', { detail: { concept: conceptName, total: state.total } }));
  console.info(`[logicade] ${conceptName} — ${label} (${activeSource})`);
}

main().catch((error) => {
  showFatal(error instanceof Error ? error.message : String(error));
});
