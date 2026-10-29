import Phaser from 'phaser';
import { playButtonClick, playGameSound } from './audio';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this.spec = data.spec;
    this.manifest = data.manifest;
    this.state = {
      score: 0,
      timer: 0,
      count: 0,
      carrying: new Set(),
      lastTriggered: {},
      entities: {},
      destroyed: new Set(),
      gameOver: false,
      won: false,
      startedAt: 0,
      hintCount: 0,
      errorCount: 0,
      attempts: 1,
      paused: false,
    };
    this.attemptId = crypto.randomUUID();
    if (window.Telemetry) window.Telemetry.reset({
      attemptId: this.attemptId, studentId: this.registry.get('student_id'), levelId: this.registry.get('level_id'),
    });
  }

  create() {
    this.state.startedAt = this.time.now;
    this._emit('level_start', {});

    this._onGateResult = this._onGateResult.bind(this);
    window.addEventListener('logicade:gate_resolved', this._onGateResult);

    this._pauseHandler = () => {
      if (!this.state.gameOver && !this.state.paused) {
        this.state.paused = true;
        this.physics.pause();
        this.tweens.pauseAll();
        this.time.paused = true;
        window.dispatchEvent(new Event('logicade:game_paused'));
      }
    };
    window.addEventListener('logicade:pause_game', this._pauseHandler);

    this._resumeHandler = () => {
      if (this.state.gameOver) return;
      if (this.state.paused) {
        this.state.paused = false;
        this.physics.resume();
        this.tweens.resumeAll();
        this.time.paused = false;
      }
    };
    window.addEventListener('logicade:resume_game', this._resumeHandler);

    this._onShowHint = (event) => {
      this.state.hintCount += 1;
      const existing = this.children.getByName('hintText');
      if (existing) existing.destroy();

      this.add
        .text(
          this.scale.width / 2, 60,
          event.detail.hint || 'No hint available.',
          {
            fontSize: '16px',
            color: '#fef08a',
            fontFamily: 'monospace',
            backgroundColor: '#000000dd',
            padding: { x: 14, y: 8 },
            wordWrap: { width: this.scale.width - 80 },
            align: 'center',
          },
        )
        .setOrigin(0.5, 0)
        .setDepth(150)
        .setScrollFactor(0)
        .setName('hintText');

      this.time.delayedCall(6000, () => {
        const t = this.children.getByName('hintText');
        if (t) t.destroy();
      });
    };
    window.addEventListener('logicade:show_hint', this._onShowHint);

    const unlockAudio = () => {
      const ctx = this.sound.context;
      if (ctx.state === 'suspended') ctx.resume();
    };
    this.input.on('pointerdown', unlockAudio);
    this.input.on('gameobjectdown', playButtonClick);
    this.input.keyboard.on('keydown', unlockAudio);

    const soundKeys = [
      'sfx_collect', 'sfx_destroy', 'sfx_win', 'sfx_lose', 'sfx_click', 'sfx_error',
    ];
    for (const key of soundKeys) {
      if (this.cache.audio.exists(key) && !this.sound.get(key)) {
        this.sound.add(key, { volume: 0.4 });
      }
    }

    this._buildLayout();
    this._buildMap();
    this._buildEntities();
    this._buildInput();
    this._buildHUD();

    this._timerEvent = this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (!this.state.paused && !this.state.gameOver) {
          this.state.timer += 0.1;
        }
      },
    });

    this.cameras.main.setBackgroundColor('#1a1a2e');

    if (this.registry.get('pause_for_tutorial')) {
      this.state.paused = true;
      this.physics.pause();
      this.tweens.pauseAll();
      this.time.paused = true;
      window.dispatchEvent(new Event('logicade:tutorial_ready'));
    }

    this.events.once('shutdown', () => {
      window.removeEventListener('logicade:gate_resolved', this._onGateResult);
      window.removeEventListener('logicade:pause_game', this._pauseHandler);
      window.removeEventListener('logicade:resume_game', this._resumeHandler);
      window.removeEventListener('logicade:show_hint', this._onShowHint);
    });
  }

  update(_time, delta) {
    if (this.state.gameOver) return;
    if (this.state.paused) return;
    this._movePlayer(delta);
    this._evaluateRules();
    this._checkHazardCollision();
    this._checkWin();
    this._updateHUD();
  }

  _buildLayout() {
    const map = this.manifest.tilemaps.find((m) => m.id === this.spec.map);
    const [cols, rows] = map.grid_size;
    this.gridCols = cols;
    this.gridRows = rows;

    this.layout = SpecRenderer.computeLayout({
      viewportW: this.scale.width,
      viewportH: this.scale.height,
      gridCols: cols,
      gridRows: rows,
      tileSize: map.tile_size,
    });

    // Physics bounds always cover the board.
    this.physics.world.setBounds(
      this.layout.offsetX, this.layout.offsetY,
      this.layout.boardW, this.layout.boardH,
    );

    // Only set camera bounds when the board exceeds the viewport.
    // If it fits, we leave the camera at (0,0) so the board's own
    // offsetX/offsetY positions it in the center of the viewport.
    if (!this.layout.fits) {
      this.cameras.main.setBounds(
        this.layout.offsetX, this.layout.offsetY,
        this.layout.boardW, this.layout.boardH,
      );
    }
  }

  _buildMap() {
    const { offsetX, offsetY, boardW, boardH } = this.layout;
    this.add.image(offsetX + boardW / 2, offsetY + boardH / 2, this.spec.map)
      .setDisplaySize(boardW, boardH).setDepth(0).setAlpha(0.88);
    const grid = this.add.graphics().lineStyle(1, 0xffffff, 0.18);
    for (let c = 0; c <= this.gridCols; c += 1) {
      const x = offsetX + c * this.layout.displaySize;
      grid.lineBetween(x, offsetY, x, offsetY + boardH);
    }
    for (let r = 0; r <= this.gridRows; r += 1) {
      const y = offsetY + r * this.layout.displaySize;
      grid.lineBetween(offsetX, y, offsetX + boardW, y);
    }
    grid.setDepth(1);
  }

  _buildEntities() {
    const used = new Set();
    for (const ent of this.spec.entities) {
      let col;
      let row;
      if (ent.role === 'player') {
        col = 1;
        row = Math.floor(this.gridRows / 2);
      } else {
        const pos = this._randomFreeCell(used, ent.role);
        col = pos.col;
        row = pos.row;
      }
      used.add(`${col},${row}`);

      const { x, y } = SpecRenderer.cellCenter(this.layout, col, row);
      const sprite = this.physics.add.sprite(x, y, ent.sprite);
      const size = this.layout.displaySize * 0.8;
      sprite.setDisplaySize(size, size);
      sprite.setData('entityId', ent.id);
      sprite.setData('role', ent.role);
      sprite.setDepth(10);
      sprite.body.setSize(size, size);

      if (ent.role === 'player') {
        sprite.setCollideWorldBounds(true);
        // Only follow when the board overflows the viewport.
        if (!this.layout.fits) {
          this.cameras.main.startFollow(sprite, true, 0.1, 0.1);
        }
        this.tweens.add({
          targets: sprite,
          scaleX: sprite.scaleX * 1.05,
          scaleY: sprite.scaleY * 1.05,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else if (ent.role === 'collectible' || ent.role === 'powerup') {
        this.tweens.add({
          targets: sprite, angle: 360, duration: 3000, repeat: -1, ease: 'Linear',
        });
      } else if (ent.role === 'hazard') {
        this.tweens.add({
          targets: sprite,
          scaleX: sprite.scaleX * 1.1,
          scaleY: sprite.scaleY * 1.1,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else if (ent.role === 'gate') {
        this.tweens.add({
          targets: sprite, alpha: 0.5, duration: 1000, yoyo: true, repeat: -1,
        });
      }

      this.state.entities[ent.id] = sprite;
      if (ent.role === 'player') this.player = sprite;
    }
  }

  _randomFreeCell(used, role) {
    const playerRow = Math.floor(this.gridRows / 2);
    for (let i = 0; i < 200; i++) {
      const col = Phaser.Math.Between(0, this.gridCols - 1);
      const row = Phaser.Math.Between(0, this.gridRows - 1);
      if (col < 3 && row < 3) continue;
      if (
        (role === 'hazard' || role === 'obstacle') &&
        col <= 2 &&
        Math.abs(row - playerRow) <= 1
      ) continue;
      if (!used.has(`${col},${row}`)) return { col, row };
    }
    return { col: this.gridCols - 1, row: this.gridRows - 1 };
  }

  _buildInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D',
    });
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,W,A,S,D');
    this.input.keyboard.on('keydown-ESC', () => this._pauseHandler());
  }

  _buildHUD() {
    const style = { fontSize: '18px', color: '#ffffff', fontFamily: 'monospace' };

    this.add.text(12, 12, 'Score: 0', style)
      .setDepth(100).setScrollFactor(0).setName('hudScore');
    this.add.text(12, 36, 'Time: 0.0', style)
      .setDepth(100).setScrollFactor(0).setName('hudTimer');

    // Goal label — prefer spec.player_objective, fall back to derived
    // from win condition.
    let goalText = this.spec.player_objective || 'Complete the level';
    if (!this.spec.player_objective) {
      const win = String(this.spec.win || this.spec.win_condition || '');
      let m;
      if ((m = win.match(/score\s*(>=|==|>)\s*(\d+)/))) {
        goalText = `Collect ${m[2]} items`;
      } else if ((m = win.match(/timer\s*(>=|>)\s*(\d+)/))) {
        goalText = `Survive ${m[2]} seconds`;
      } else if ((m = win.match(/count\s*(>=|==|>)\s*(\d+)/))) {
        goalText = `Destroy ${m[2]} objects`;
      }
    }
    this.add.text(12, 60, `🎯 ${goalText}`, {
      fontSize: '16px',
      color: '#ffca28',
      fontFamily: 'monospace',
      backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setDepth(100).setScrollFactor(0).setName('hudGoal');

    this.add.text(12, this.scale.height - 24, 'ESC = pause', {
      ...style, fontSize: '14px', color: '#9ca3af',
    }).setDepth(100).setScrollFactor(0);
  }

  _movePlayer(_delta) {
    if (!this.player || !this.player.body) return;
    const speed = 200;
    this.player.body.setVelocity(0);

    if (this.cursors.left.isDown || this.wasd.left.isDown) {
      this.player.body.setVelocityX(-speed);
    } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
      this.player.body.setVelocityX(speed);
    }
    if (this.cursors.up.isDown || this.wasd.up.isDown) {
      this.player.body.setVelocityY(-speed);
    } else if (this.cursors.down.isDown || this.wasd.down.isDown) {
      this.player.body.setVelocityY(speed);
    }
  }

  _evaluateRules() {
    for (let i = 0; i < this.spec.rules.length; i++) {
      const rule = this.spec.rules[i];
      const triggered = this._evaluateTrigger(rule.on);
      const was = this.state.lastTriggered[i] || false;
      if (triggered && !was) {
        if (this._evaluateCondition(rule.if)) {
          for (const effect of rule.then) this._applyEffect(effect, i);
        }
      }
      this.state.lastTriggered[i] = triggered;
    }
  }

  _evaluateTrigger(onStr) {
    const parsed = this._parseOn(onStr);
    if (!parsed) return false;
    const { trigger, args } = parsed;

    switch (trigger) {
      case 'collision': {
        const a = this.state.entities[args[0]];
        const b = this.state.entities[args[1]];
        if (!a || !b || !a.active || !b.active) return false;
        return this.physics.overlap(a, b);
      }
      case 'timer':
        return this.state.timer >= parseFloat(args[0] ?? 0);
      case 'score threshold':
        return this.state.score >= parseFloat(args[0] ?? 0);
      case 'count reached':
        return this.state.count >= parseFloat(args[0] ?? 0);
      default:
        return false;
    }
  }

  _parseOn(onStr) {
    const m = String(onStr).match(/^([a-z_ ]+?)(?:\(([^)]+)\))?$/i);
    if (!m) return null;
    return {
      trigger: m[1].trim().toLowerCase().replace(/_/g, ' '),
      args: m[2] ? m[2].split(',').map((s) => s.trim()) : [],
    };
  }

  _evaluateCondition(ifStr) {
    if (!ifStr || ifStr === 'always') return true;
    const m = String(ifStr).match(
      /^(score|timer|count)\s*(==|>=|<=|>|<|!=)\s*(-?\d+(?:\.\d+)?)$/,
    );
    if (m) {
      const [, name, op, num] = m;
      return this._compare(this.state[name], op, parseFloat(num));
    }
    return false;
  }

  _compare(a, op, b) {
    switch (op) {
      case '==': return a === b;
      case '!=': return a !== b;
      case '>=': return a >= b;
      case '<=': return a <= b;
      case '>':  return a > b;
      case '<':  return a < b;
      default:   return false;
    }
  }

  _applyEffect(effectStr, ruleIndex) {
    const s = String(effectStr).trim();

    let m = s.match(/^score\s*([+-]=)\s*(\d+)$/);
    if (m) {
      const delta = m[1] === '+=' ? parseFloat(m[2]) : -parseFloat(m[2]);
      this.state.score += delta;
      this._playSfx(delta > 0 ? 'sfx_collect' : 'sfx_error');
      this._emit('rule_triggered', {
        rule_id: `r${ruleIndex}`,
        payload: { effect: s, new_score: this.state.score },
      });
      return;
    }

    m = s.match(/^destroy\((\w+)\)$/);
    if (m) {
      const target = this.state.entities[m[1]];
      if (target && target.active) {
        this._burst(target.x, target.y, 0xfde047);
        target.destroy();
        this.state.destroyed.add(m[1]);
        this.state.count += 1;
        this._playSfx('sfx_destroy');
        this._emit('collision', {
          entity_id: m[1],
          rule_id: `r${ruleIndex}`,
          payload: { effect: s },
        });
      }
      return;
    }

    m = s.match(/^spawn\((\w+)\)$/);
    if (m) {
      const spriteId = m[1];
      const x = Phaser.Math.Between(
        this.layout.offsetX,
        this.layout.offsetX + this.gridCols * this.layout.displaySize,
      );
      const y = this.layout.offsetY - 50;
      const hazard = this.physics.add.sprite(
        x, y, spriteId === 'hazard' ? 'spike' : spriteId,
      );
      hazard.setDisplaySize(
        this.layout.displaySize * 0.8,
        this.layout.displaySize * 0.8,
      );
      hazard.setData('role', 'hazard');
      hazard.body.setVelocityY(150);
      this.state.entities[`spawned_${Date.now()}`] = hazard;
      return;
    }

    if (s === 'open_code_gate') {
      this._triggerCodeGate(ruleIndex);
      return;
    }

    if (s === 'reset') {
      this._finish(false, 'reset_triggered');
    }
  }

  _triggerCodeGate(_ruleIndex) {
    this.state.paused = true;
    this.physics.pause();
    this.tweens.pauseAll();
    this.time.paused = true;

    const questions = [
      {
        q: 'if (score ___ 5) // to pass when score is exactly 5',
        opts: ['if (score > 5)', 'if (score >= 5)', 'if (score == 5)', 'if (score != 5)'],
        correct: 1,
      },
      {
        q: 'if (lives ___ 0) // to trigger game over',
        opts: ['if (lives < 0)', 'if (lives == 0)', 'if (lives <= 0)', 'if (lives != 0)'],
        correct: 2,
      },
    ];
    const data = questions[Math.floor(Math.random() * questions.length)];
    window.dispatchEvent(
      new CustomEvent('logicade:gate_opened', {
        detail: { question: data.q, options: data.opts, correct: data.correct },
      }),
    );
  }

  _onGateResult(event) {
    this.state.paused = false;
    if (!this.state.gameOver) {
      this.physics.resume();
      this.tweens.resumeAll();
      this.time.paused = false;
    }

    if (event.detail.correct) {
      this._playSfx('sfx_win');
      this.state.score += 5;
      this._emit('rule_triggered', {
        payload: { effect: 'gate_opened', new_score: this.state.score },
      });
      for (const [, ent] of Object.entries(this.state.entities)) {
        if (ent.getData('role') === 'gate' && ent.active) {
          this._burst(ent.x, ent.y, 0x00ffff);
          ent.destroy();
        }
      }
    } else {
      this._playSfx('sfx_error');
      this.state.errorCount += 1;
      this.state.score = Math.max(0, this.state.score - 1);
    }
  }

  _playSfx(key) {
    playGameSound(this, key);
  }

  _burst(x, y, color) {
    const emitter = this.add.particles(x, y, 'gem', {
      speed: { min: 80, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.4, end: 0 },
      lifespan: 500,
      quantity: 10,
      blendMode: 'ADD',
      tint: color,
    });
    this.time.delayedCall(600, () => emitter.destroy());
  }

  _checkWin() {
    if (this.state.gameOver) return;
    const winStr = String(this.spec.win || this.spec.win_condition || '');
    const m = winStr.match(
      /^(score|timer|count)\s*(==|>=|<=|>|<|!=)\s*(-?\d+(?:\.\d+)?)$/,
    );
    if (!m) return;
    const [, name, op, num] = m;
    if (this._compare(this.state[name], op, parseFloat(num))) {
      this._finish(true, 'win_condition');
    }
  }

  _checkHazardCollision() {
    if (this.state.gameOver || !this.player) return;
    for (const [, ent] of Object.entries(this.state.entities)) {
      if (!ent.active || ent.getData('role') !== 'hazard') continue;
      if (this.physics.overlap(this.player, ent)) {
        this.state.errorCount += 1;
        this._finish(false, 'hit_hazard');
        return;
      }
    }
  }

  _finish(won, reason) {
    if (this.state.gameOver) return;
    this.state.gameOver = true;
    this.state.won = won;
    this.state.paused = true;

    this.physics.pause();
    this.tweens.pauseAll();
    this.time.paused = true;

    try {
      this._emit(won ? 'level_win' : 'level_lose', { payload: { reason } });
    } catch (e) {
      console.error('[finish] telemetry error:', e);
    }

    this._playSfx(won ? 'sfx_win' : 'sfx_lose');
    if (this.player.body) this.player.body.setVelocity(0);

    const maxScore = Math.max(1, this.spec.rules.length);
    const safeScore = Math.max(0, Math.min(1, this.state.score / maxScore));

    const payload = {
      student_id: this.registry.get('student_id'),
      level_id: this.registry.get('level_id'),
      won,
      time: this.state.timer,
      score: safeScore,
      accuracy: safeScore,
      error_count: this.state.errorCount,
      hint_count: this.state.hintCount,
      spec: this.spec,
    };
    this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        won ? 'VICTORY!' : 'GAME OVER',
        {
          fontSize: '64px',
          color: won ? '#4ade80' : '#f87171',
          fontFamily: 'monospace',
          stroke: '#000000',
          strokeThickness: 6,
        },
      )
      .setOrigin(0.5)
      .setDepth(200)
      .setScrollFactor(0);

    // ── Persist via the shared helper ──
    (async () => {
      try {
        await window.LogiCadeWrite.persistAttempt({
          attemptId: this.attemptId,
          studentId: this.registry.get('student_id'),
          levelId: this.registry.get('level_id'),
          week: this.registry.get('week'),
          stageNumber: this.registry.get('level_num'),
          difficulty: this.registry.get('difficulty'),
          spec: this.spec,
          meta: this.registry.get('meta'),
          score: safeScore,
          accuracy: safeScore,
          errorCount: this.state.errorCount,
          hintCount: this.state.hintCount,
          completionTimeSec: this.state.timer,
          won,
        });
      } catch (err) {
        console.error('[finish] persistence failed:', err);
      } finally {
        window.dispatchEvent(new CustomEvent('logicade:game_over', { detail: payload }));
      }
    })();
  }

  _updateHUD() {
    const score = this.children.getByName('hudScore');
    const timer = this.children.getByName('hudTimer');
    if (score) score.setText(`Score: ${this.state.score}`);
    if (timer) timer.setText(`Time: ${this.state.timer.toFixed(1)}`);
  }

  _emit(eventType, fields) {
    fields.t_ms_since_start = Math.round(this.time.now - this.state.startedAt);
    if (window.Telemetry) window.Telemetry.emit(eventType, fields);
  }
}
