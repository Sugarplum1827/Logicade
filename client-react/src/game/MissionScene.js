import Phaser from 'phaser';
import { createMissionQuestion } from './missionQuestions';
import { getMissionModule, listMissionModules } from './missionModules';
import { playButtonClick, playGameSound } from './audio';

const MISSION_TYPES = listMissionModules();

export class MissionScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MissionScene' });
  }

  preload() {
    const week = this.registry.get('week') || 1;
    const background = week === 2 || week === 9 ? 'background_color_desert.png'
      : week === 3 || week === 8 ? 'background_color_hills.png'
        : week === 4 ? 'background_color_mushrooms.png' : 'background_color_trees.png';
    const root = '/vendor/kenney/organized';
    this.load.image('mission_background', `${root}/sprites/new_platformer_pack_1_1/backgrounds/1x/${background}`);
    this.load.image('mission_player', `${root}/sprites/new_platformer_pack_1_1/tiles/1x/hud_player_helmet_green.png`);
    this.load.image('mission_coin', `${root}/sprites/new_platformer_pack_1_1/tiles/1x/coin_gold.png`);
    this.load.image('mission_enemy', `${root}/sprites/new_platformer_pack_1_1/enemies/1x/slime_block_rest.png`);
    this.load.audio('kenney_collect', `${root}/audio/interface/interface_sounds/confirmation_001.ogg`);
    this.load.audio('kenney_error', `${root}/audio/interface/interface_sounds/error_001.ogg`);
    this.load.audio('kenney_click', `${root}/audio/interface/interface_sounds/click_001.ogg`);
  }

  init(data) {
    this.spec = data.spec || {};
    this.manifest = data.manifest || {};

    // Mission type lives either at the top level (LLM) or under
    // spec.metadata (manifest-served). Accept both.
    const rawMissionType =
      this.spec.mission_type || this.spec.metadata?.mission_type;
    this.missionType = MISSION_TYPES.includes(rawMissionType)
      ? rawMissionType
      : 'Survival Siege';
    this.missionModule = getMissionModule(this.missionType);

    this.settings = this.spec.game_settings || {};
    const targetScore = this.settings.target_score ?? 10;
    const doorHealth = targetScore;

    this.state = {
      score: 0,
      timer: 0,
      lives: this.settings.lives ?? 3,
      streak: 0,
      moves: 0,
      doorHealth,
      maxDoorHealth: doorHealth,
      rivalScore: 0,
      gameOver: false,
      won: false,
      challengeOpen: false,
      startedAt: 0,
      paused: false,
      hintCount: 0,
      errorCount: 0,
    };
    this.attemptId = crypto.randomUUID();
    if (window.Telemetry) window.Telemetry.reset({
      attemptId: this.attemptId, studentId: this.registry.get('student_id'), levelId: this.registry.get('level_id'),
    });
  }

  create() {
    this.state.startedAt = this.time.now;
    this._emit('level_start', {});

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

    this.cameras.main.setBackgroundColor('#1a1a2e');
    if (this.textures.exists('mission_background')) {
      this.add.image(this.scale.width / 2, this.scale.height / 2, 'mission_background')
        .setDisplaySize(this.scale.width, this.scale.height).setAlpha(0.52).setDepth(-20);
      this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x101525, 0.55).setDepth(-19);
    }

    this.missionModule.build(this);

    this._buildHUD();
    this._buildCodePanel();
    this._buildTutorial();

    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (!this.state.paused && !this.state.gameOver) {
          this.state.timer += 0.1;
        }
      },
    });

    if (this.registry.get('pause_for_tutorial')) {
      this.state.paused = true;
      this.physics.pause();
      this.tweens.pauseAll();
      this.time.paused = true;
      window.dispatchEvent(new Event('logicade:tutorial_ready'));
    }

    this.events.once('shutdown', () => {
      window.removeEventListener('logicade:pause_game', this._pauseHandler);
      window.removeEventListener('logicade:resume_game', this._resumeHandler);
      window.removeEventListener('logicade:show_hint', this._onShowHint);
    });
  }

  update() {
    if (this.state.gameOver || this.state.paused) return;
    this.missionModule.tick(this);
    this._checkWinLose();
    this._updateHUD();
  }

  _buildSurvivalSiege() {
    const durationSec = this.settings.time_limit_seconds ?? 30;
    const attackInterval =
      (this.settings.enemy_attack_interval_seconds ?? 2) * 1000;
    const waveCount = this.settings.enemy_wave_count ?? 2;
    const repairAmount = Math.max(2, Math.round(this.state.maxDoorHealth / 20));

    this._siegeDuration = durationSec;
    this._siegeRepair = repairAmount;

    this.add.rectangle(400, 300, 120, 200, 0x8b4513).setStrokeStyle(4, 0x000);
    this.add.text(400, 300, '🚪', { fontSize: '40px' }).setOrigin(0.5);

    this.player = this.textures.exists('mission_player')
      ? this.add.image(200, 300, 'mission_player').setDisplaySize(52, 60)
      : this.add.circle(200, 300, 30, 0x3498db);
    this.add.text(200, 340, 'YOU', {
      fontSize: '14px', color: '#fff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.hpBar = this.add
      .rectangle(400, 180, 200, 16, 0x2ecc71)
      .setStrokeStyle(2, 0x000);
    this.hpLabel = this.add
      .text(400, 160, `Door: ${this.state.doorHealth}`, {
        fontSize: '14px', color: '#fff', fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.enemies = this.physics.add.group();
    this.time.addEvent({
      delay: attackInterval,
      loop: true,
      callback: () => {
        if (this.state.gameOver || this.state.paused) return;
        for (let i = 0; i < waveCount; i++) this._spawnZombie();
      },
    });

    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this._onSpaceDown = () => {
      if (this.state.gameOver || this.state.paused) return;
      this._askCodeQuestion((correct) => {
        if (correct) {
          this.state.doorHealth = Math.min(this.state.maxDoorHealth, this.state.doorHealth + this._siegeRepair);
          if (this.player.setTint) {
            this.player.setTint(0x2ecc71);
            this.time.delayedCall(150, () => this.player?.clearTint());
          } else {
            this.player.setFillStyle(0x2ecc71);
            this.time.delayedCall(150, () => this.player?.setFillStyle(0x3498db));
          }
        } else {
          this.state.doorHealth = Math.max(0, this.state.doorHealth - this._siegeRepair);
          this.state.errorCount += 1;
        }
        this._updateMissionStatus();
      });
    };
    this.spaceKey.on('down', this._onSpaceDown);
  }

  _spawnZombie() {
    const enemyY = Phaser.Math.Between(220, 380);
    const z = this.textures.exists('mission_enemy')
      ? this.add.image(this.scale.width + 20, enemyY, 'mission_enemy').setDisplaySize(34, 34)
      : this.add.circle(this.scale.width + 20, enemyY, 16, 0xe74c3c);
    this.enemies.add(z);
    this.tweens.add({
      targets: z,
      x: 460,
      duration: 2000,
      onComplete: () => {
        if (this.state.gameOver) return;
        this.state.doorHealth = Math.max(0, this.state.doorHealth - 5);
        this.state.errorCount += 1;
        this.cameras.main.shake(150, 0.008);
        z.destroy();
      },
    });
  }

  _buildStreakChallenge() {
    this._streakTarget = this.settings.streak_target ?? 5;

    this.streakLabel = this.add
      .text(400, 160, `Streak: 0 / ${this._streakTarget}`, {
        fontSize: '24px', color: '#f1c40f', fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.questionLabel = this.add.text(400, 225, '', {
      fontSize: '16px', color: '#e5e7eb', fontFamily: 'monospace',
      wordWrap: { width: 700 }, align: 'center',
    }).setOrigin(0.5);

    this.livesLabel = this.add
      .text(400, 200, `Lives: ${this.state.lives}`, {
        fontSize: '18px', color: '#f87171', fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.choiceButtons = [0, 1, 2, 3].map((i) => {
      const btn = this.add
        .text(400, 260 + i * 55, '', {
          fontSize: '18px', color: '#fff', fontFamily: 'monospace',
          backgroundColor: '#1e3a8a', padding: { x: 16, y: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this._pickStreak(i));
      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#3b82f6' }));
      btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#1e3a8a' }));
      this.input.keyboard.on(
        `keydown-${['ONE', 'TWO', 'THREE', 'FOUR'][i]}`,
        () => this._pickStreak(i),
      );
      return btn;
    });
    this._showStreakQuestion();
  }

  _showStreakQuestion() {
    const question = createMissionQuestion(this.spec);
    this._streakCorrect = question.correctIndex;
    this.questionLabel.setText(question.prompt);
    this.choiceButtons.forEach((button, index) => button.setText(`[${index + 1}] ${question.options[index]}`));
  }

  _pickStreak(idx) {
    if (this.state.gameOver || this.state.paused) return;
    if (idx === this._streakCorrect) {
      this.state.streak += 1;
      this.state.score += 10;
      this._playSfx('sfx_collect');
      this._burst(400, 300, 0x65e28a);
      this._emit('answer_correct', { payload: { topic: this.spec.topic, mechanic: this.spec.primary_mechanic } });
    } else {
      this.state.streak = 0;
      this.state.lives = Math.max(0, this.state.lives - 1);
      this.state.errorCount += 1;
      this._playSfx('sfx_error');
      this.cameras.main.shake(120, 0.004);
      this._emit('answer_incorrect', { payload: { topic: this.spec.topic, mechanic: this.spec.primary_mechanic } });
    }
    this._updateMissionStatus();
    this._showStreakQuestion();
  }

  _askCodeQuestion(onAnswer) {
    if (this.state.challengeOpen || this.state.gameOver || this.state.paused) return;
    this.state.challengeOpen = true;
    const question = createMissionQuestion(this.spec);
    const layer = this.add.container(0, 0).setDepth(210).setScrollFactor(0);
    const panel = this.add.rectangle(400, 320, 710, 300, 0x111827, 0.98)
      .setStrokeStyle(3, 0x4ade80);
    const title = this.add.text(400, 192, `${question.topic} · choose an answer`, {
      fontSize: '15px', color: '#86efac', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5);
    const prompt = this.add.text(400, 238, question.prompt, {
      fontSize: '17px', color: '#f9fafb', fontFamily: 'monospace',
      align: 'center', wordWrap: { width: 650 },
    }).setOrigin(0.5);
    layer.add([panel, title, prompt]);

    const finish = (index) => {
      if (!this.state.challengeOpen) return;
      const correct = index === question.correctIndex;
      this.state.challengeOpen = false;
      layer.destroy(true);
      this._emit(correct ? 'answer_correct' : 'answer_incorrect', {
        payload: {
          topic: question.topic,
          mechanic: this.spec.primary_mechanic || this.spec.metadata?.mechanic,
          game_id: this.spec.game_id || this.spec.id,
        },
      });
      if (correct) {
        this._playSfx('sfx_collect');
        this._burst(400, 320, 0x65e28a);
      } else {
        this._playSfx('sfx_error');
        this.cameras.main.shake(120, 0.004);
      }
      onAnswer(correct);
    };

    question.options.forEach((option, index) => {
      const x = index % 2 === 0 ? 230 : 570;
      const y = index < 2 ? 300 : 385;
      const button = this.add.rectangle(x, y, 315, 62, 0x1e3a8a, 1)
        .setStrokeStyle(1, 0x60a5fa)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(x, y, `[${index + 1}] ${option}`, {
        fontSize: '14px', color: '#fff', fontFamily: 'monospace',
        align: 'center', wordWrap: { width: 290 },
      }).setOrigin(0.5);
      button.on('pointerover', () => button.setFillStyle(0x2563eb));
      button.on('pointerout', () => button.setFillStyle(0x1e3a8a));
      button.on('pointerdown', () => finish(index));
      layer.add([button, label]);
    });
  }

  _updateMissionStatus() {
    if (this.hpLabel) this.hpLabel.setText(`Door: ${this.state.doorHealth}`);
    if (this.hpBar) this.hpBar.setFillStyle(this.state.doorHealth <= this.state.maxDoorHealth / 3 ? 0xef4444 : 0x2ecc71);
    if (this.streakLabel) this.streakLabel.setText(`Streak: ${this.state.streak} / ${this._streakTarget}`);
    if (this.livesLabel) this.livesLabel.setText(`Lives: ${this.state.lives}`);
    if (this.targetLabel && this.missionType === 'Resource Rush') this.targetLabel.setText(`Collect: ${this.state.score} / ${this._rushTarget}`);
    if (this.targetLabel && this.missionType === 'Efficiency Trial') this.targetLabel.setText(`Target: ${this.state.score} / ${this._effTarget}`);
    if (this.budgetLabel) this.budgetLabel.setText(`Moves: ${this.state.moves} / ${this._effBudget}`);
    if (this.progressLabel) this.progressLabel.setText(`${this.state.score} / ${this._raceTarget}`);
    if (this.playerBar) this.playerBar.setSize(this._raceBarMax * Math.min(1, this.state.score / this._raceTarget), 18);
    if (this.rivalBar) this.rivalBar.setSize(this._raceBarMax * Math.min(1, this.state.rivalScore / this._raceTarget), 18);
  }

  _buildResourceRush() {
    this._rushTarget = this.settings.target_score ?? 10;
    this._rushYield = Math.max(1, Math.ceil(this._rushTarget / 24));

    this.targetLabel = this.add
      .text(400, 160, `Collect: 0 / ${this._rushTarget}`, {
        fontSize: '24px', color: '#f1c40f', fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    for (let i = 0; i < 24; i++) {
      const r = this.textures.exists('mission_coin')
        ? this.add.image(Phaser.Math.Between(100, 700), Phaser.Math.Between(250, 520), 'mission_coin').setDisplaySize(28, 28)
        : this.add.circle(
          Phaser.Math.Between(100, 700),
          Phaser.Math.Between(250, 520),
          12,
          0xfbbf24,
        )
        .setInteractive({ useHandCursor: true });
      r.on('pointerdown', () => {
        if (this.state.gameOver || this.state.paused) return;
        if (!r.active) return;
        this._askCodeQuestion((correct) => {
          this._burst(r.x, r.y, correct ? 0xfbbf24 : 0xef4444);
          r.destroy();
          if (correct) {
            this.state.score = Math.min(this._rushTarget, this.state.score + this._rushYield);
            this._playSfx('sfx_collect');
          } else {
            this.state.lives = Math.max(0, this.state.lives - 1);
            this.state.errorCount += 1;
            this._playSfx('sfx_error');
            this.cameras.main.shake(120, 0.004);
          }
          this._updateMissionStatus();
        });
      });
    }
  }

  _buildRivalRace() {
    this._raceTarget = this.settings.target_score ?? 10;
    this._raceYield = Math.max(1, Math.ceil(this._raceTarget / 10));
    this._raceBarMax = 400;
    this._raceElapsed = 0;

    this.add.text(200, 260, 'YOU', {
      fontSize: '14px', color: '#2ecc71', fontFamily: 'monospace',
    });
    this.playerBar = this.add.rectangle(200, 290, 0, 18, 0x2ecc71).setOrigin(0, 0.5);
    this.rivalBar = this.add.rectangle(200, 340, 0, 18, 0xe74c3c).setOrigin(0, 0.5);
    this.add.text(200, 360, 'RIVAL', {
      fontSize: '14px', color: '#e74c3c', fontFamily: 'monospace',
    });

    this.progressLabel = this.add
      .text(400, 420, `0 / ${this._raceTarget}`, {
        fontSize: '18px', color: '#fff', fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.state.gameOver || this.state.paused) return;
      this._askCodeQuestion((correct) => {
        if (correct) {
          this.state.score = Math.min(this._raceTarget, this.state.score + this._raceYield);
          this._playSfx('sfx_collect');
        } else {
          this.state.errorCount += 1;
          this.state.rivalScore = Math.min(this._raceTarget, this.state.rivalScore + this._raceYield);
          this._playSfx('sfx_error');
        }
        this._updateMissionStatus();
      });
    });
  }

  _buildEfficiencyTrial() {
    this._effBudget = this.settings.action_budget ?? 10;
    this._effTarget = this.settings.target_score ?? 10;
    this._effYield = Math.max(1, Math.ceil(this._effTarget / Math.max(1, this._effBudget)));

    this.budgetLabel = this.add
      .text(400, 160, `Moves: 0 / ${this._effBudget}`, {
        fontSize: '24px', color: '#f1c40f', fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.targetLabel = this.add
      .text(400, 210, `Target: 0 / ${this._effTarget}`, {
        fontSize: '20px', color: '#fff', fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.state.gameOver || this.state.paused) return;
      this._askCodeQuestion((correct) => {
        this.state.moves += 1;
        if (correct && this.state.moves <= this._effBudget) {
          this.state.score = Math.min(this._effTarget, this.state.score + this._effYield);
          this._playSfx('sfx_collect');
        } else {
          this.state.errorCount += 1;
          this._playSfx('sfx_error');
        }
        this._updateMissionStatus();
      });
    });
  }

  _checkWinLose() {
    if (!this.state.gameOver) this.missionModule.evaluate(this);
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
      console.error('[MissionScene._finish] telemetry:', e);
    }

    const normalized = Math.max(0, Math.min(1, this.missionModule.score(this)));

    const payload = {
      student_id: this.registry.get('student_id'),
      level_id: this.registry.get('level_id'),
      won,
      time: this.state.timer,
      score: normalized,
      accuracy: normalized,
      error_count: this.state.errorCount,
      hint_count: this.state.hintCount,
      reason,
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

    // ── Persist via the shared helper (same path as GameScene) ──
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
          score: normalized,
          accuracy: normalized,
          errorCount: this.state.errorCount,
          hintCount: this.state.hintCount,
          completionTimeSec: this.state.timer,
          won,
        });
      } catch (err) {
        console.error('[MissionScene._finish] persistence failed:', err);
      } finally {
        window.dispatchEvent(new CustomEvent('logicade:game_over', { detail: payload }));
      }
    })();
  }

  _buildHUD() {
    const style = { fontSize: '18px', color: '#fff', fontFamily: 'monospace' };

    this.add
      .text(12, 12, `MISSION: ${this.missionType}`, {
        fontSize: '14px', color: '#fbbf24', fontFamily: 'monospace',
      })
      .setDepth(100)
      .setScrollFactor(0);

    this.add.text(this.scale.width / 2, 44, this.spec.game_title || this.spec.game_concept || 'Learning challenge', {
      fontSize: '17px', color: '#fef3c7', fontFamily: 'monospace',
      align: 'center', wordWrap: { width: this.scale.width - 80 },
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0);
    this.add.text(this.scale.width / 2, 70, `${this.spec.primary_mechanic || this.spec.metadata?.mechanic || this.missionType} · ${this.spec.topic || ''}`, {
      fontSize: '13px', color: '#86efac', fontFamily: 'monospace', align: 'center',
      wordWrap: { width: this.scale.width - 80 },
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0);

    this.hudTime = this.add.text(12, 36, 'Time: 0.0', style)
      .setDepth(100)
      .setScrollFactor(0);

    this.add
      .text(12, this.scale.height - 24, 'ESC = pause', {
        ...style, fontSize: '14px', color: '#6b7280',
      })
      .setDepth(100)
      .setScrollFactor(0);
  }

  _buildCodePanel() {
    if (!this.spec.code_snippet) return;
    this.add.rectangle(400, 550, 700, 60, 0x000, 0.8)
      .setDepth(100).setScrollFactor(0);
    this.add.text(400, 550, this.spec.code_snippet, {
      fontSize: '13px', color: '#00ffcc', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5).setDepth(101).setScrollFactor(0);
  }

  _buildTutorial() {
    // The pre-game objective panel already displayed these steps.
  }

  _updateHUD() {
    if (this.hudTime) this.hudTime.setText(`Time: ${this.state.timer.toFixed(1)}s`);

    if (this.missionType === 'Survival Siege' && this.hpLabel) {
      this.hpLabel.setText(`Door: ${this.state.doorHealth}`);
      const pct = Math.max(0, this.state.doorHealth / this.state.maxDoorHealth);
      this.hpBar.width = 200 * pct;
      this.hpBar.fillColor = pct > 0.6 ? 0x2ecc71 : pct > 0.3 ? 0xf1c40f : 0xe74c3c;
    }
    if (this.missionType === 'Streak Challenge' && this.streakLabel) {
      this.streakLabel.setText(`Streak: ${this.state.streak} / ${this._streakTarget}`);
      if (this.livesLabel) this.livesLabel.setText(`Lives: ${this.state.lives}`);
    }
    if (this.missionType === 'Resource Rush' && this.targetLabel) {
      this.targetLabel.setText(`Collect: ${this.state.score} / ${this._rushTarget}`);
    }
    if (this.missionType === 'Rival Race' && this.progressLabel) {
      const max = this._raceTarget || 1;
      this.playerBar.width = (this.state.score / max) * this._raceBarMax;
      this.rivalBar.width = (this.state.rivalScore / max) * this._raceBarMax;
      this.progressLabel.setText(`${this.state.score} / ${max}`);
    }
    if (this.missionType === 'Efficiency Trial') {
      if (this.budgetLabel) this.budgetLabel.setText(`Moves: ${this.state.moves} / ${this._effBudget}`);
      if (this.targetLabel) this.targetLabel.setText(`Target: ${this.state.score} / ${this._effTarget}`);
    }
  }

  _playSfx(key) {
    playGameSound(this, key);
  }

  _burst(x, y, tint) {
    for (let i = 0; i < 9; i += 1) {
      const angle = (Math.PI * 2 * i) / 9;
      const particle = this.add.circle(x, y, Phaser.Math.Between(3, 6), tint, 0.95);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * Phaser.Math.Between(30, 85),
        y: y + Math.sin(angle) * Phaser.Math.Between(30, 85),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(320, 560),
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  _emit(eventType, fields) {
    fields.t_ms_since_start = Math.round(this.time.now - this.state.startedAt);
    if (window.Telemetry) window.Telemetry.emit(eventType, fields);
  }
}
