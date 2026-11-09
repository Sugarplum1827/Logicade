(() => {
  'use strict';

  function start({ game, description }) {
    const shell = document.getElementById('game-shell');
    const live = document.getElementById('live-region');
    const { artifacts, room: roomName, background: backgroundUrl, fallbackBackground, frame, tuning } = globalThis.LogiCadeArchiveArtifacts.layout(game);
    const tasks = game.tasks;
    const found = new Set();
    const buttons = new Map();
    const trayEntries = new Map();
    let selected = null;
    let highlighted = null;
    let startedAt = null;
    let pausedAt = null;
    let pausedMs = 0;
    let questionIndex = 0;
    let questionAttempts = 0;
    let errors = 0;
    let hints = 0;
    let finished = false;
    let eventId = 0;
    let soundEnabled = true;

    function add(parent, tag, className, text) {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text) element.textContent = text;
      parent.append(element);
      return element;
    }

    function button(parent, text, action, className = 'archive-button') {
      const control = add(parent, 'button', className, text);
      control.type = 'button';
      control.addEventListener('click', action);
      return control;
    }

    function icon(parent, artifact) {
      // The SVG bodies come from the bundled, authored artifact catalog.
      const wrapper = add(parent, 'span', 'archive-art');
      wrapper.setAttribute('aria-hidden', 'true');
      wrapper.innerHTML = '<svg viewBox="0 0 120 90" focusable="false">' + artifact.shape + '</svg>';
      return wrapper;
    }

    function post(type, fields = {}) {
      const message = { channel: 'logicade-game', version: 1, type, ...fields };
      if (type !== 'game_over') {
        message.event_id = game.file_id + '-archive-' + (++eventId);
        message.time_ms = startedAt === null ? 0 : Math.round(performance.now() - startedAt);
      }
      window.parent.postMessage(message, '*');
    }

    function announce(message) {
      live.textContent = message;
    }

    function play(kind) {
      const url = game.assets?.[kind + '_sound'];
      if (soundEnabled && url) new Audio(url).play().catch(() => {});
    }

    function canPlay() {
      return !finished && pausedAt === null && !globalThis.LogiCadeFirstVisitGuide?.active;
    }

    const study = globalThis.LogiCadeStudyTelemetry;
    function begin() {
      if (startedAt !== null) return;
      startedAt = performance.now();
      study?.start();
      post('game_started', { payload: { mechanic: 'hidden_archive', clues_total: artifacts.length } });
    }

    function pause(request = false) {
      if (!canPlay()) return;
      begin();
      pausedAt = performance.now();
      study?.setPaused(true);
      post('game_paused');
      if (request) {
        if (window.parent === window) {
          openCard('Case paused', body => button(body, 'Resume', () => { dialog.close(); resume(); }));
        } else {
          post('pause_request');
        }
      }
    }

    function resume() {
      if (pausedAt === null) return;
      pausedMs += performance.now() - pausedAt;
      pausedAt = null;
      study?.setPaused(false);
      post('game_resumed');
    }

    shell.className = 'archive-shell';
    shell.dataset.frame = frame;
    shell.setAttribute('aria-label', 'The Lost Legacy of C hidden-object game');
    document.getElementById('game').remove();

    const header = add(shell, 'header', 'archive-header');
    const pauseButton = button(header, 'Ⅱ', () => pause(true), 'archive-button archive-pause');
    pauseButton.setAttribute('aria-label', 'Pause game');
    const titleBar = add(header, 'div', 'archive-titlebar');
    const caseHeading = add(titleBar, 'div', 'archive-case');
    add(caseHeading, 'h1', '', 'Case: The Lost Legacy of C');
    add(caseHeading, 'p', 'archive-topic', roomName + ' · ' + game.lesson.stage_title);
    const objective = add(titleBar, 'p', 'archive-objective', 'Find all ' + artifacts.length + ' artifacts in the archive');
    const counter = add(titleBar, 'p', 'archive-counter');
    counter.setAttribute('aria-live', 'polite');
    const settings = button(header, '⚙', () => {
      if (!canPlay()) return;
      openCard('Case settings', body => {
        const toggle = button(body, soundEnabled ? 'Sound effects on' : 'Sound effects off', () => {
          soundEnabled = !soundEnabled;
          toggle.textContent = soundEnabled ? 'Sound effects on' : 'Sound effects off';
          toggle.setAttribute('aria-pressed', String(soundEnabled));
        });
        toggle.setAttribute('aria-pressed', String(soundEnabled));
      });
    }, 'archive-button archive-settings');
    settings.setAttribute('aria-label', 'Case settings');

    const stage = add(shell, 'div', 'archive-stage');
    const viewport = add(stage, 'div', 'archive-viewport');
    const room = add(viewport, 'section', 'archive-room');
    room.setAttribute('aria-label', 'Search the archive room');
    const scene = add(room, 'canvas', 'archive-background');
    scene.setAttribute('aria-hidden', 'true');
    const pan = add(stage, 'nav', 'archive-pan');
    pan.setAttribute('aria-label', 'Look around the room');
    button(pan, '‹ Look left', () => viewport.scrollBy({ left: -viewport.clientWidth * .65 }), 'archive-button');
    button(pan, 'Look right ›', () => viewport.scrollBy({ left: viewport.clientWidth * .65 }), 'archive-button');
    const background = new Image();
    function drawRoom() {
      const scale = Math.min(2, window.devicePixelRatio || 1);
      scene.width = Math.round(room.clientWidth * scale);
      scene.height = Math.round(room.clientHeight * scale);
      if (background.naturalWidth && scene.width && scene.height) {
        scene.getContext('2d')?.drawImage(background, 0, 0, scene.width, scene.height);
      }
    }
    background.onload = drawRoom;
    background.onerror = () => {
      background.onerror = null;
      if (backgroundUrl !== fallbackBackground) background.src = fallbackBackground;
    };
    background.src = backgroundUrl;
    new ResizeObserver(() => {
      room.style.minWidth = Math.round(viewport.clientHeight * 1.6) + 'px';
      pan.hidden = room.clientWidth <= viewport.clientWidth;
      drawRoom();
    }).observe(viewport);
    const footer = add(shell, 'footer', 'archive-footer');
    const hint = button(footer, '⌕ Hint', () => {
      if (!canPlay()) return;
      if (window.parent === window) {
        announce('Launch from LogiCade to use an Oracle hint.');
      } else {
        post('hint_request');
      }
    }, 'archive-button archive-hint');
    hint.setAttribute('aria-label', 'Ask the Oracle for a hint');
    const tray = add(footer, 'div', 'archive-tray');
    tray.style.setProperty('--archive-clue-count', artifacts.length);
    tray.setAttribute('role', 'group');
    tray.setAttribute('aria-label', 'Artifacts to find');
    const evidence = button(footer, '▤ Evidence', showEvidence, 'archive-button archive-evidence');

    const dialog = add(shell, 'dialog', 'archive-dialog');
    dialog.setAttribute('aria-labelledby', 'archive-card-title');
    const card = add(dialog, 'div', 'archive-card');
    const cardHeader = add(card, 'header', 'archive-card-header');
    const cardTitle = add(cardHeader, 'h2', 'archive-card-title');
    cardTitle.id = 'archive-card-title';
    const close = button(cardHeader, '×', () => dialog.close(), 'archive-button archive-close-icon');
    close.setAttribute('aria-label', 'Close card');
    const content = add(card, 'div', 'archive-card-content');
    const cardFooter = add(card, 'footer', 'archive-card-footer');
    button(cardFooter, 'Close', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      study?.dismiss();
      if (window.parent === window && pausedAt !== null) resume();
      if (found.size === artifacts.length && !finished && questionIndex < tasks.length) evidence.focus();
    });

    function openCard(title, fill) {
      study?.dismiss();
      cardTitle.textContent = title;
      content.replaceChildren();
      fill(content);
      if (!dialog.open) dialog.showModal();
      close.focus();
    }

    for (const artifact of artifacts) {
      const [x, y, angle, size, light] = artifact.position;
      const clue = button(room, '', () => discover(artifact), 'archive-object');
      clue.style.setProperty('--x', x + '%');
      clue.style.setProperty('--y', y + '%');
      clue.style.setProperty('--angle', angle + 'deg');
      clue.style.setProperty('--object-scale', size * tuning.size);
      clue.style.setProperty('--object-light', light * tuning.light);
      clue.dataset.concealment = artifact.concealment;
      clue.setAttribute('aria-label', 'Inspect ' + artifact.name);
      icon(clue, artifact);
      buttons.set(artifact.id, clue);

      const tile = button(tray, '', () => {
        if (!canPlay()) return;
        if (found.has(artifact.id)) {
          showArtifact(artifact);
        } else {
          selected = artifact.id;
          update();
          announce('Look for ' + artifact.name + ' in the room.');
        }
      }, 'archive-tile');
      icon(tile, artifact);
      add(tile, 'span', 'archive-tile-name', artifact.name);
      trayEntries.set(artifact.id, tile);
    }

    function update() {
      counter.textContent = found.size + ' / ' + artifacts.length + ' Found';
      if (found.size === artifacts.length) {
        objective.textContent = finished ? 'Investigation closed' : 'Open Evidence to verify your findings';
        evidence.classList.toggle('archive-ready', !finished);
      }
      for (const artifact of artifacts) {
        const collected = found.has(artifact.id);
        const tile = trayEntries.get(artifact.id);
        const clue = buttons.get(artifact.id);
        tile.classList.toggle('archive-collected', collected);
        tile.setAttribute('aria-label', artifact.name + (collected ? ', found. Read record' : ', unfound. Select clue'));
        tile.setAttribute('aria-pressed', String(!collected && selected === artifact.id));
        clue.hidden = collected;
        clue.classList.toggle('archive-highlight', highlighted === artifact.id);
      }
    }

    function showArtifact(artifact) {
      openCard(artifact.name, body => {
        const layout = add(body, 'div', 'archive-artifact-record');
        const figure = add(layout, 'figure', 'archive-portrait');
        icon(figure, artifact);
        add(figure, 'figcaption', '', 'Illustrated archive reproduction');
        const record = add(layout, 'div', 'archive-history');
        add(record, 'h3', '', artifact.era);
        add(record, 'p', '', artifact.history);
        if (artifact.connection) add(record, 'p', 'archive-connection', artifact.connection);
        add(record, 'small', 'archive-source', artifact.source);
      });
    }

    function discover(artifact) {
      if (!canPlay() || found.has(artifact.id)) return;
      begin();
      found.add(artifact.id);
      if (highlighted === artifact.id) highlighted = null;
      if (selected === artifact.id) selected = null;
      play('success');
      update();
      showArtifact(artifact);
      post('activity_completed', { entity_id: artifact.id, payload: { activity: 'artifact_discovery', artifact_id: artifact.id } });
      post('checkpoint_saved', { payload: { clues_found: found.size, clues_total: artifacts.length } });
      announce(artifact.name + ' found. ' + counter.textContent + '.');
    }

    function showEvidence() {
      if (!canPlay()) return;
      openCard('Evidence folder', body => {
        add(body, 'p', 'archive-evidence-intro', found.size
          ? 'Open any recovered artifact to review what it tells you.'
          : 'The folder is empty. Search the room and inspect an artifact to add its record.');
        const list = add(body, 'div', 'archive-evidence-list');
        for (const artifact of artifacts.filter(item => found.has(item.id))) {
          const entry = button(list, '', () => showArtifact(artifact), 'archive-button archive-record-link');
          icon(entry, artifact);
          add(entry, 'span', '', artifact.name);
        }
        if (found.size === artifacts.length) {
          button(body, 'Verify findings', showQuestion, 'archive-button archive-verify');
        }
      });
    }

    function showQuestion() {
      if (!canPlay() || found.size !== artifacts.length || questionIndex >= tasks.length) return;
      const task = tasks[questionIndex];
      const available = Number(game.starting_lives) - errors;
      openCard('Verify finding ' + (questionIndex + 1) + ' of ' + tasks.length, body => {
        add(body, 'p', 'archive-review-meta', game.lesson.stage_title + ' · Checks remaining ' + available);
        add(body, 'h3', 'archive-question', task.prompt.replace(/^Archive case \d+: /, ''));
        const choices = add(body, 'div', 'archive-choices');
        const feedback = add(body, 'p', 'archive-feedback');
        feedback.setAttribute('role', 'status');
        for (const [i, answer] of task.choices.entries()) {
          button(choices, answer, () => {
            if (!canPlay() || questionIndex >= tasks.length) return;
            const correct = i === task.answer_index;
            study?.submit(post, 'question', task.id, correct, study.takeResponseTime());
            post('question_answered', {
              entity_id: task.id,
              payload: { question_id: task.id, attempt_number: ++questionAttempts, selected_index: i,
                correct, answer_type: 'archive_evidence', objective_id: game.learning_objective_id },
            });
            if (!correct) {
              errors++;
              play('error');
              if (errors >= Number(game.starting_lives)) return finish(false);
              study?.present();
              feedback.textContent = 'That finding does not match the record. Review Evidence and try again.';
              body.querySelector('.archive-review-meta').textContent = game.lesson.stage_title + ' · Checks remaining ' + (Number(game.starting_lives) - errors);
              return;
            }
            questionIndex++;
            questionAttempts = 0;
            play('success');
            if (questionIndex === tasks.length) return finish(true);
            choices.replaceChildren();
            feedback.textContent = task.explanation;
            button(body, 'Next finding', showQuestion, 'archive-button archive-verify').focus();
          }, 'archive-button archive-answer');
        }
        button(body, 'Review evidence', showEvidence);
      });
      study?.present();
    }

    function finish(won) {
      if (finished) return;
      finished = true;
      dialog.close();
      objective.textContent = won ? 'Case solved' : 'Case closed · checks exhausted';
      evidence.disabled = hint.disabled = pauseButton.disabled = true;
      evidence.classList.remove('archive-ready');
      const answered = questionIndex + errors;
      post('game_over', {
        won, reason: won ? 'archive_evidence_verified' : 'archive_checks_exhausted',
        score: Math.round(100 * questionIndex / tasks.length),
        accuracy: answered ? questionIndex / answered : 0,
        answered, correct: questionIndex, error_count: errors, hint_count: hints,
        duration_sec: Math.max(0, (performance.now() - startedAt - pausedMs - (globalThis.LogiCadeFirstVisitGuide?.durationMs || 0)) / 1000),
        active_play_ms: study?.activePlayMs(),
        accuracy_basis: 'question_answers', formal_assessment: false,
      });
      announce(objective.textContent);
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (event.source !== window.parent || message?.channel !== 'logicade-host' || message.version !== 1) return;
      if (message.type === 'initialize') begin();
      if (message.type === 'pause') pause();
      if (message.type === 'resume') resume();
      if (message.type !== 'hint' || finished) return;
      hints++;
      highlighted = artifacts.find(item => item.id === selected && !found.has(item.id))?.id
        || artifacts.find(item => !found.has(item.id))?.id || null;
      update();
      const target = buttons.get(highlighted);
      if (target) viewport.scrollLeft = target.offsetLeft - viewport.clientWidth / 2;
      post('hint_used', { entity_id: highlighted, payload: { source: 'host_oracle', activity: 'archive' } });
      announce(highlighted ? 'The Oracle highlighted an unfound artifact.' : String(message.hint || description?.hint || 'Review the evidence.'));
    });
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !dialog.open && canPlay()) {
        event.preventDefault();
        pause(true);
      }
    });
    update();
    if (window.parent === window) begin();
  }

  globalThis.LogiCadeArchive = { start };
})();
