import * as Phaser from '../../../vendor/phaser.esm.min.js';
import { LEVEL_CONFIG } from '../../data/levelConfig.js';
import { DEPTH, EVENTS, WORLD } from '../constants.js';
import { hostBridge } from '../hostBridge.js';
import { selectGateQuestions } from '../validation.js';
import { LevelBuilder } from '../level/LevelBuilder.js';
import { Player } from '../entities/Player.js';
import { Hud } from '../ui/Hud.js';
import { QuestionPanel } from '../ui/QuestionPanel.js';
import { Overlays } from '../ui/Overlays.js';

const formatTime = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// Storage can be unavailable inside a locked-down iframe.
const readMuted = () => {
  try {
    return localStorage.getItem('logicade-muted') === '1';
  } catch {
    return false;
  }
};

const writeMuted = (muted) => {
  try {
    localStorage.setItem('logicade-muted', muted ? '1' : '0');
  } catch {
    // Not fatal: sound preference simply will not persist.
  }
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this.skipTutorial = Boolean(data?.skipTutorial);
    this.seed = Number.isInteger(data?.seed) ? data.seed : LEVEL_CONFIG.seed;
  }

  create() {
    this.description = this.registry.get('description');
    this.questionsByGate = selectGateQuestions(this.description, this.seed);
    hostBridge.setMeta({
      game_id: this.description.game_id,
      variation_id: this.description.variation_id,
      seed: this.seed,
    });

    this.physics.world.setBounds(0, 0, WORLD.width, 1000);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.fadeIn(350, 6, 10, 18);

    this.level = new LevelBuilder(this).build();
    this.player = new Player(this, LEVEL_CONFIG.spawn.x, LEVEL_CONFIG.spawn.feetY, LEVEL_CONFIG.player);
    this.playerShadow = this.add
      .image(this.player.x, this.player.feetY - 3, 'shadow')
      .setDisplaySize(66, 18)
      .setAlpha(0.4)
      .setDepth(DEPTH.player - 1);

    this.physics.add.collider(this.player, this.level.layer);
    this.physics.add.collider(this.player, this.level.solids);
    this.physics.add.overlap(this.player, this.level.coins, (_player, coin) => this.collectCoin(coin));
    this.physics.add.overlap(this.player, this.level.hazards, (_player, hazard) => this.damagePlayer(hazard.x));
    for (const enemy of this.level.enemies) {
      this.physics.add.overlap(this.player, enemy.sprite, () => this.damagePlayer(enemy.sprite.x));
    }

    this.burst = this.add
      .particles(0, 0, 'spark', {
        speed: { min: 50, max: 210 },
        lifespan: { min: 300, max: 650 },
        scale: { start: 0.7, end: 0 },
        gravityY: 520,
        emitting: false,
        tint: [0xffcf5c, 0xfff6e5, 0x7ee2b8],
        blendMode: 'ADD',
      })
      .setDepth(DEPTH.foreground);

    this.confetti = this.add
      .particles(0, 0, 'spark', {
        speed: { min: 120, max: 430 },
        lifespan: { min: 900, max: 1800 },
        scale: { start: 0.8, end: 0 },
        gravityY: 480,
        emitting: false,
        tint: [0xffcf5c, 0x7ee2b8, 0xff8fa3, 0x9db7ff, 0xfff6e5],
      })
      .setDepth(DEPTH.foreground);

    this.muted = readMuted();
    this.sound.mute = this.muted;

    this.hud = new Hud(this, {
      onHint: () => this.showHint(),
      onMute: () => this.toggleMute(),
      onPause: () => this.togglePause(),
    });
    this.panel = new QuestionPanel(this);
    this.overlays = new Overlays(this);

    this.panel.onAnswered = (result) => this.onQuestionAnswered(result);
    this.panel.onContinue = (result) => this.onQuestionContinue(result);
    this.panel.onSkip = () => this.onQuestionSkip();
    this.panel.onHint = () => this.onQuestionHint();

    this.createGatePrompt();
    this.setupInput();
    this.setupMobileControls();

    this.resetRunState();
    this.hud.update(this.hudState());

    this.unsubCommand = hostBridge.onCommand((command) => {
      if (command === 'pause') this.togglePause(true);
      else if (command === 'resume') this.resumeGame();
      else if (command === 'hint') this.showHint();
    });
    this.events.once('shutdown', () => {
      this.unsubCommand?.();
      this.unsubInit?.();
    });

    if (this.skipTutorial) {
      this.startRun();
    } else {
      this.showTutorial();
    }
  }

  resetRunState() {
    this.state = 'tutorial';
    this.hearts = LEVEL_CONFIG.player.maxHearts;
    this.score = 0;
    this.coins = 0;
    this.gatesOpened = 0;
    this.attempts = 0;
    this.correct = 0;
    this.errors = 0;
    this.hints = 0;
    this.elapsedMs = 0;
    this.invulnerableUntil = 0;
    this.gameOverSent = false;
    this.pendingGate = null;
    this.nearGate = null;
    this.clueCollected = false;
    this.rejoinAnnounced = false;
    this.checkpoint = { x: LEVEL_CONFIG.spawn.x, y: LEVEL_CONFIG.spawn.feetY };
    this.stars = 1;
    this.resultStats = null;
    this.touch = { left: false, right: false, jumpPressed: false, jumpHeld: false };
    this.player.respawn(LEVEL_CONFIG.spawn.x, LEVEL_CONFIG.spawn.feetY);
    this.player.setAlpha(1);
  }

  showTutorial() {
    this.state = 'tutorial';
    this.physics.pause();
    this.player.freeze();
    this.overlays.showTutorial({
      description: this.description,
      onStart: () => this.startRun(),
    });
  }

  startRun() {
    if (this.state === 'playing' || this.state === 'question') return;
    this.overlays.closeActive();
    this.physics.resume();

    this.state = 'playing';
    this.hearts = LEVEL_CONFIG.player.maxHearts;
    this.score = 0;
    this.coins = 0;
    this.gatesOpened = 0;
    this.attempts = 0;
    this.correct = 0;
    this.errors = 0;
    this.hints = 0;
    this.elapsedMs = 0;
    this.gameOverSent = false;
    this.pendingGate = null;
    this.nearGate = null;
    this.clueCollected = false;
    this.rejoinAnnounced = false;
    this.invulnerableUntil = 0;
    this.checkpoint = { x: LEVEL_CONFIG.spawn.x, y: LEVEL_CONFIG.spawn.feetY };
    this.player.respawn(LEVEL_CONFIG.spawn.x, LEVEL_CONFIG.spawn.feetY);
    this.player.setAlpha(1);
    this.hud.setVisible(true);
    this.hud.update(this.hudState());
    this.hud.toast('Reach a gate and press E', '#7ee2b8', 2400);

    hostBridge.emit(EVENTS.started, {
      difficulty: this.description.difficulty,
      week: this.description.week,
      level: this.description.level,
      question_ids: Object.fromEntries(
        Object.entries(this.questionsByGate).map(([gate, question]) => [gate, question?.id || null]),
      ),
    });
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      E: Phaser.Input.Keyboard.KeyCodes.E,
      H: Phaser.Input.Keyboard.KeyCodes.H,
      M: Phaser.Input.Keyboard.KeyCodes.M,
      P: Phaser.Input.Keyboard.KeyCodes.P,
      ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
      ENTER: Phaser.Input.Keyboard.KeyCodes.ENTER,
      R: Phaser.Input.Keyboard.KeyCodes.R,
      ONE: Phaser.Input.Keyboard.KeyCodes.ONE,
      TWO: Phaser.Input.Keyboard.KeyCodes.TWO,
      THREE: Phaser.Input.Keyboard.KeyCodes.THREE,
      FOUR: Phaser.Input.Keyboard.KeyCodes.FOUR,
    });
    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]);

    this.input.once('pointerdown', () => this.sound.unlock?.());
    this.input.keyboard.once('keydown', () => this.sound.unlock?.());
  }

  setupMobileControls() {
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    const enabled = Boolean(this.sys.game.device.input.touch) || coarse;
    if (!enabled) return;

    const makePad = (x, y, label, onDown, onUp, color = 0x1d283b) => {
      const group = this.add.container(x, y).setDepth(DEPTH.hud + 2);
      const bg = this.add.circle(0, 0, 36, color, 0.55);
      bg.setStrokeStyle(2, 0x7ee2b8, 0.6);
      const text = this.add
        .text(0, 0, label, {
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#fff6e5',
        })
        .setOrigin(0.5);
      const zone = this.add.zone(0, 0, 84, 84).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', onDown);
      zone.on('pointerup', onUp);
      zone.on('pointerout', onUp);
      group.add([bg, text, zone]);
      return group;
    };

    makePad(92, 626, '◀', () => {
      this.touch.left = true;
    }, () => {
      this.touch.left = false;
    });
    makePad(188, 626, '▶', () => {
      this.touch.right = true;
    }, () => {
      this.touch.right = false;
    });
    makePad(1126, 626, '▲', () => {
      this.touch.jumpPressed = true;
      this.touch.jumpHeld = true;
    }, () => {
      this.touch.jumpHeld = false;
    });
    makePad(1216, 626, 'E', () => {
      this.handleAction();
    }, () => {}, 0x123a2a);
  }

  hudState() {
    return {
      hearts: this.hearts,
      score: this.score,
      coins: this.coins,
      gates: this.gatesOpened,
      elapsedMs: this.elapsedMs,
      muted: this.muted,
    };
  }

  update(time, delta) {
    this.handleGlobalInput();

    if (this.state === 'playing') {
      this.elapsedMs += delta;
      const jumpPressed =
        Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
        Phaser.Input.Keyboard.JustDown(this.keys.W) ||
        this.touch.jumpPressed;
      this.touch.jumpPressed = false;

      const input = {
        left: this.cursors.left.isDown || this.keys.A.isDown || this.touch.left,
        right: this.cursors.right.isDown || this.keys.D.isDown || this.touch.right,
        jumpPressed,
        jumpHeld:
          this.cursors.space.isDown ||
          this.cursors.up.isDown ||
          this.keys.W.isDown ||
          this.touch.jumpHeld,
      };

      this.player.update(time, delta, input);
      this.updateShadow();
      this.updateEnemies();
      this.updateGateProximity(time);
      this.updateCheckpoint();
      this.checkPit();
      this.checkClue();
      this.checkRejoin();
      this.checkGoal();
      this.hud.update(this.hudState());
    } else {
      this.updateShadow();
    }
  }

  handleGlobalInput() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.M)) this.toggleMute();
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) this.togglePause();
    if (Phaser.Input.Keyboard.JustDown(this.keys.H)) this.showHint();

    if (this.state === 'tutorial') {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
        this.overlays.startTutorial();
      }
      return;
    }

    if (this.state === 'question') {
      const answerKeys = ['ONE', 'TWO', 'THREE', 'FOUR'];
      const chosen = answerKeys.findIndex((key) => Phaser.Input.Keyboard.JustDown(this.keys[key]));
      if (chosen >= 0) this.panel.choose(chosen);
      if (Phaser.Input.Keyboard.JustDown(this.keys.E) || Phaser.Input.Keyboard.JustDown(this.keys.ENTER)) {
        this.panel.continue();
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) this.panel.close();
      return;
    }

    if (this.state === 'paused' || this.state === 'hint') {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        if (this.state === 'paused') this.resumeGame();
        else this.closeHint();
      }
      return;
    }

    if (this.state === 'complete' || this.state === 'gameover') {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.restartRun();
      return;
    }

    if (this.state === 'playing') {
      if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.handleAction();
    }
  }

  handleAction() {
    if (this.state === 'question') {
      if (this.panel.answered) this.panel.continue();
      return;
    }
    if (this.state !== 'playing') return;
    if (this.nearGate) this.openGate(this.nearGate);
  }

  updateShadow() {
    if (!this.playerShadow) return;
    this.playerShadow.setPosition(this.player.x, this.player.feetY - 3);
    const grounded = this.player.body.blocked.down || this.player.body.touching.down;
    this.playerShadow.setAlpha(grounded && this.player.y < 660 ? 0.4 : 0);
  }

  onPlayerJump() {
    this.play('jump', { volume: 0.32, rate: 1.08 });
  }

  onPlayerLand() {
    this.play('impact', { volume: 0.14, rate: 1.4 });
  }

  updateEnemies() {
    for (const enemy of this.level.enemies) {
      const sprite = enemy.sprite;
      if (enemy.type === 'slime') {
        if (sprite.x <= enemy.spec.minX) sprite.setVelocityX(enemy.spec.speed);
        if (sprite.x >= enemy.spec.maxX) sprite.setVelocityX(-enemy.spec.speed);
        sprite.setFlipX(sprite.body.velocity.x < 0);
        if (enemy.shadow) enemy.shadow.setPosition(sprite.x, enemy.spec.feetY - 3);
      }
    }
  }

  updateGateProximity(time) {
    let near = null;
    for (const gate of Object.values(this.level.gates)) {
      if (gate.opened) continue;
      const inX = this.player.x >= gate.zone.x1 && this.player.x <= gate.zone.x2;
      const inY = this.player.y >= gate.zone.y1 && this.player.y <= gate.zone.y2;
      if (inX && inY) {
        near = gate;
        break;
      }
    }

    this.nearGate = near;
    if (near) {
      const x = near.centerX + 56;
      const y = near.y - 52;
      this.gatePrompt.setVisible(true).setPosition(x, y);
      this.promptBaseY = y;
      this.gatePrompt.y = y + Math.sin(time / 260) * 3;
      this.promptZone.setInteractive({ useHandCursor: true });
    } else {
      this.gatePrompt.setVisible(false);
      this.promptZone.disableInteractive();
    }
  }

  createGatePrompt() {
    this.gatePrompt = this.add.container(0, 0).setDepth(DEPTH.foreground + 3).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x0b1220, 0.92);
    bg.fillRoundedRect(-112, -18, 112, 36, 10);
    bg.lineStyle(1.5, 0x7ee2b8, 0.8);
    bg.strokeRoundedRect(-112, -18, 112, 36, 10);
    const keyBg = this.add.graphics();
    keyBg.fillStyle(0x1d283b, 1);
    keyBg.fillRoundedRect(-102, -11, 26, 22, 5);
    keyBg.lineStyle(1, 0x7ee2b8, 0.9);
    keyBg.strokeRoundedRect(-102, -11, 26, 22, 5);
    const keyText = this.add
      .text(-89, 0, 'E', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#7ee2b8',
      })
      .setOrigin(0.5);
    const label = this.add
      .text(-66, 0, 'ANSWER', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#fff6e5',
      })
      .setOrigin(0, 0.5);
    this.promptZone = this.add
      .zone(-56, 0, 112, 40)
      .setInteractive({ useHandCursor: true });
    this.promptZone.on('pointerdown', () => this.handleAction());
    this.gatePrompt.add([bg, keyBg, keyText, label, this.promptZone]);
    this.promptZone.disableInteractive();
    this.promptBaseY = 0;
  }

  openGate(gate) {
    if (this.state !== 'playing' || !gate || gate.opened) return;
    if (this.time.now < (gate.cooldownUntil || 0)) return;
    const question = this.questionsByGate[gate.gate];
    if (!question) {
      this.hud.toast('This gate has no question. Try the other route.', '#ffc2ca');
      return;
    }

    this.state = 'question';
    this.pendingGate = gate;
    this.nearGate = null;
    this.gatePrompt.setVisible(false);
    this.promptZone.disableInteractive();
    this.player.freeze();
    this.physics.pause();

    this.panel.open({
      gateLabel: gate.label,
      tint: gate.tint,
      question,
      index: gate.id === 'final' ? 2 : 1,
      total: 2,
      hint: this.description.hint,
    });
  }

  onQuestionAnswered(result) {
    const gate = this.pendingGate;
    if (!gate) return;
    gate.attempts = (gate.attempts || 0) + 1;
    this.attempts += 1;

    let deltaScore = 0;
    if (result.correct) {
      this.correct += 1;
      deltaScore = gate.attempts === 1 ? LEVEL_CONFIG.pacing.correctScore : LEVEL_CONFIG.pacing.retryScore;
      this.score += deltaScore;
      this.play('coin', { volume: 0.4, rate: 1.05 });
      this.burst.explode(12, gate.centerX, gate.centerY);
      this.floatText(gate.centerX, gate.centerY - 12, `+${deltaScore}`, '#7ee2b8');
    } else {
      this.errors += 1;
      deltaScore = -Math.min(LEVEL_CONFIG.pacing.wrongScorePenalty, this.score);
      this.score += deltaScore;
      this.play('impact', { volume: 0.35 });
      this.floatText(gate.centerX, gate.centerY - 12, `${deltaScore}`, '#ff8fa3');
      this.cameras.main.shake(140, 0.004);
    }

    hostBridge.emit(EVENTS.question, {
      gate_id: gate.id,
      question_id: result.question.id,
      correct: result.correct,
      response_index: result.index,
      attempt: gate.attempts,
      score_delta: deltaScore,
      accuracy_so_far: this.accuracy(),
      error_count: this.errors,
    });

    this.hud.update(this.hudState());
  }

  onQuestionContinue(result) {
    const gate = this.pendingGate;
    this.pendingGate = null;
    this.state = 'playing';
    this.physics.resume();
    this.player.setAccelerationX(0);
    if (!gate) return;

    if (result.correct) {
      this.openGateDoor(gate);
    } else {
      gate.cooldownUntil = this.time.now + LEVEL_CONFIG.pacing.gateCooldownMs;
      this.wrongGateFeedback(gate);
    }
  }

  onQuestionSkip() {
    const gate = this.pendingGate;
    this.pendingGate = null;
    this.state = 'playing';
    this.physics.resume();
    if (gate) gate.cooldownUntil = this.time.now + 500;
    this.hud.toast('Gate locked. Press E when you are ready.', '#ffcf5c');
  }

  onQuestionHint() {
    this.hints += 1;
    this.score = Math.max(0, this.score - 5);
    hostBridge.emit(EVENTS.hint, {
      gate_id: this.pendingGate?.id || null,
      source: 'question',
      hint_count: this.hints,
    });
    this.hud.update(this.hudState());
  }

  openGateDoor(gate) {
    gate.opened = true;
    this.gatesOpened += 1;
    gate.emitter.stop();
    this.tweens.killTweensOf(gate.emitter);
    this.tweens.add({
      targets: gate.container,
      alpha: 0,
      scaleY: 0.05,
      duration: 380,
      ease: 'Quad.easeIn',
    });
    gate.blocker.destroy();
    gate.labelText.setText('OPEN').setColor('#7ee2b8');
    gate.rune.setText('✓').setColor('#7ee2b8');
    this.burst.explode(26, gate.centerX, gate.centerY);
    this.cameras.main.flash(120, 126, 226, 184, false);
    this.play('goal', { volume: 0.4 });
    this.floatText(gate.centerX, gate.centerY - 30, 'OPEN', '#7ee2b8');
    const routeMessage =
      gate.id === 'lower'
        ? 'Lower route open. Cross the chasm.'
        : gate.id === 'upper'
          ? 'Upper route open. Follow the high road.'
          : 'Final gate open. Reach the flag!';
    this.hud.toast(
      routeMessage,
      gate.id === 'lower' ? '#7ee2b8' : gate.id === 'upper' ? '#ffcf5c' : '#9db7ff',
      2200,
    );
    this.hud.update(this.hudState());
  }

  wrongGateFeedback(gate) {
    this.tweens.add({
      targets: gate.container,
      x: gate.centerX + 6,
      duration: 45,
      yoyo: true,
      repeat: 3,
      onComplete: () => gate.container.setX(gate.centerX),
    });
    this.cameras.main.flash(120, 120, 30, 50, false);
    this.player.setVelocity(this.player.x < gate.centerX ? -220 : 220, -260);
    this.hud.toast('Gate holds. Read the tip and try again.', '#ffc2ca', 2200);
  }

  collectCoin(coin) {
    if (!coin.active) return;
    const glow = coin.getData('glow');
    const x = coin.x;
    const y = coin.y;
    this.tweens.killTweensOf(coin);
    if (glow) {
      this.tweens.killTweensOf(glow);
      glow.destroy();
    }
    coin.disableBody(true, true);
    this.coins += 1;
    this.score += LEVEL_CONFIG.pacing.coinScore;
    this.play('coin', { volume: 0.32, rate: 1.25 });
    this.burst.explode(8, x, y);
    this.floatText(x, y - 16, '+25', '#ffcf5c');
    this.hud.update(this.hudState());
  }

  updateCheckpoint() {
    const grounded = this.player.body.blocked.down || this.player.body.touching.down;
    if (!grounded) return;
    const feet = this.player.feetY;

    for (const zone of LEVEL_CONFIG.checkpointZones) {
      if (this.player.x < zone.minX || this.player.x > zone.maxX) continue;
      if (Math.abs(feet - zone.y) > 8) continue;
      if (this.checkpoint.x !== zone.x || this.checkpoint.y !== zone.y) {
        this.checkpoint = { x: zone.x, y: zone.y };
      }
      return;
    }
  }

  checkPit() {
    if (this.player.y <= 760) return;
    this.hearts -= 1;
    this.hud.update(this.hudState());
    if (this.hearts <= 0) {
      this.endRun(false);
      return;
    }
    this.player.respawn(this.checkpoint.x, this.checkpoint.y);
    this.makeInvulnerable();
    this.cameras.main.flash(180, 20, 12, 24, false);
    this.play('hurt', { volume: 0.4 });
    this.hud.toast('Back to the last safe ledge. -1 heart', '#ffc2ca', 1800);
  }

  checkClue() {
    if (this.clueCollected) return;
    const clue = LEVEL_CONFIG.clue;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, clue.x, clue.y) > 46) return;

    this.clueCollected = true;
    this.score += LEVEL_CONFIG.pacing.clueScore;
    this.level.clueVisual?.orb.destroy();
    this.level.clueVisual?.glow.destroy();
    this.burst.explode(18, clue.x, clue.y);
    this.play('coin', { volume: 0.45, rate: 0.9 });
    this.floatText(clue.x, clue.y - 20, 'BONUS CLUE', '#9df3ff');
    this.hud.update(this.hudState());
    this.openHintModal({ source: 'bonus_clue', penalty: false });
  }

  checkGoal() {
    if (!this.level.gates.final?.opened) return;
    const goal = LEVEL_CONFIG.goal;
    if (Math.abs(this.player.feetY - goal.feetY) > 90) return;
    if (Math.abs(this.player.x - goal.x) > 56) return;
    this.endRun(true);
  }

  checkRejoin() {
    if (this.rejoinAnnounced || this.player.x < 832) return;
    this.rejoinAnnounced = true;
    this.hud.toast('The routes rejoin. The final gate is ahead.', '#9db7ff', 2200);
    this.burst.explode(12, 832, 470);
  }

  damagePlayer(sourceX) {
    if (this.state !== 'playing') return;
    if (this.time.now < this.invulnerableUntil) return;

    this.hearts -= 1;
    this.player.hurt();
    this.makeInvulnerable();
    this.play('hurt', { volume: 0.5 });
    this.cameras.main.shake(180, 0.008);
    this.cameras.main.flash(150, 255, 60, 90, false);
    const direction = this.player.x < sourceX ? -1 : 1;
    this.player.setVelocity(direction * 250, -320);
    this.hud.update(this.hudState());
    if (this.hearts <= 0) {
      this.time.delayedCall(350, () => this.endRun(false));
    } else {
      this.hud.toast('Ouch! -1 heart', '#ffc2ca', 1400);
    }
  }

  makeInvulnerable() {
    this.invulnerableUntil = this.time.now + LEVEL_CONFIG.player.invulnerableMs;
    this.tweens.killTweensOf(this.player);
    this.player.setAlpha(1);
    this.tweens.add({
      targets: this.player,
      alpha: { from: 1, to: 0.35 },
      duration: 100,
      yoyo: true,
      repeat: 5,
      onComplete: () => this.player.setAlpha(1),
    });
  }

  showHint() {
    if (this.state === 'question') {
      this.panel.showHint();
      return;
    }
    if (this.state !== 'playing') return;
    this.openHintModal();
  }

  openHintModal({ source = 'hint_panel', penalty = true } = {}) {
    if (this.state !== 'playing') return;
    this.state = 'hint';
    this.player.freeze();
    this.physics.pause();
    this.hints += 1;
    if (penalty) this.score = Math.max(0, this.score - 5);
    hostBridge.emit(EVENTS.hint, { source, hint_count: this.hints });
    this.hud.update(this.hudState());
    this.overlays.showHint({
      hint: this.description.hint,
      onClose: () => this.closeHint(),
    });
  }

  closeHint() {
    this.overlays.closeActive();
    this.state = 'playing';
    this.physics.resume();
    this.player.setAccelerationX(0);
  }

  togglePause(fromHost = false) {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.player.freeze();
      this.physics.pause();
      this.touch.left = false;
      this.touch.right = false;
      this.touch.jumpHeld = false;
      this.overlays.showPause({
        muted: this.muted,
        onResume: () => this.resumeGame(),
        onRestart: () => this.restartRun(),
        onQuit: () => window.location.reload(),
        onMute: () => {
          this.toggleMute();
          this.overlays.closeActive();
          this.showPauseAgain();
        },
      });
      if (fromHost) this.hud.toast('Paused by the host', '#9fb1c8', 1200);
    } else if (this.state === 'paused') {
      this.resumeGame();
    }
  }

  showPauseAgain() {
    this.overlays.showPause({
      muted: this.muted,
      onResume: () => this.resumeGame(),
      onRestart: () => this.restartRun(),
      onQuit: () => window.location.reload(),
      onMute: () => {
        this.toggleMute();
        this.overlays.closeActive();
        this.showPauseAgain();
      },
    });
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.overlays.closeActive();
    this.state = 'playing';
    this.physics.resume();
    this.player.setAccelerationX(0);
  }

  toggleMute() {
    this.muted = !this.muted;
    this.sound.mute = this.muted;
    writeMuted(this.muted);
    this.hud.update(this.hudState());
    this.hud.toast(this.muted ? 'Sound muted' : 'Sound on', '#9fb1c8', 1100);
  }

  play(key, config = {}) {
    if (this.muted) return;
    if (!this.cache.audio.exists(key)) return;
    this.sound.play(key, { volume: 0.4, ...config });
  }

  floatText(x, y, text, color) {
    const label = this.add
      .text(x, y, text, {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '15px',
        fontStyle: 'bold',
        color,
        stroke: '#0b1220',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.foreground + 5);
    this.tweens.add({
      targets: label,
      y: y - 44,
      alpha: 0,
      duration: 850,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  accuracy() {
    if (!this.attempts) return 0;
    return Math.min(1, Math.max(0, this.correct / this.attempts));
  }

  endRun(won) {
    if (this.state === 'complete' || this.state === 'gameover') return;
    if (this.gameOverSent) return;
    this.gameOverSent = true;
    this.state = won ? 'complete' : 'gameover';
    this.player.freeze();
    this.physics.pause();
    this.overlays.closeActive();

    const accuracy = this.accuracy();
    if (won) {
      const timeBonus = Math.max(
        0,
        LEVEL_CONFIG.pacing.timeBonusMax - Math.floor(this.elapsedMs / 1000) * 2,
      );
      this.score += this.hearts * LEVEL_CONFIG.pacing.heartBonus + timeBonus;
      this.stars = accuracy >= 1 && this.hearts >= 2 ? 3 : accuracy >= 0.5 || this.hearts >= 2 ? 2 : 1;
      this.play('goal', { volume: 0.55 });
      this.cameras.main.flash(240, 255, 246, 229, false);
      this.confetti.explode(70, this.player.x, this.player.y - 80);
      this.time.delayedCall(320, () => this.confetti.explode(50, 640, 120));
    } else {
      this.play('hurt', { volume: 0.5 });
      this.cameras.main.shake(260, 0.006);
    }

    this.resultStats = {
      score: this.score,
      accuracy,
      time: formatTime(this.elapsedMs),
      coins: this.coins,
      hearts: this.hearts,
      gates: this.gatesOpened,
    };

    if (won) {
      hostBridge.emit(EVENTS.completed, {
        score: this.score,
        accuracy: Number(accuracy.toFixed(3)),
        coins: this.coins,
        hearts: this.hearts,
        gates_opened: this.gatesOpened,
        elapsed_ms: Math.round(this.elapsedMs),
      });
    }

    hostBridge.emit(EVENTS.over, {
      won,
      score: this.score,
      accuracy: Number(accuracy.toFixed(3)),
      error_count: this.errors,
      hint_count: this.hints,
      reason: won ? 'reached_goal' : 'out_of_hearts',
      coins: this.coins,
      hearts: this.hearts,
      gates_opened: this.gatesOpened,
      elapsed_ms: Math.round(this.elapsedMs),
      stars: won ? this.stars : 0,
    });

    this.hud.update(this.hudState());
    this.time.delayedCall(won ? 850 : 600, () => {
      if (won) this.showCompleteModal();
      else this.showGameOverModal();
    });
  }

  showCompleteModal() {
    this.overlays.showComplete({
      stats: this.resultStats,
      stars: this.stars,
      onReplay: () => this.restartRun(),
      onReview: () => this.reviewTip('complete'),
    });
  }

  showGameOverModal() {
    this.overlays.showGameOver({
      stats: this.resultStats,
      onRetry: () => this.restartRun(),
      onReview: () => this.reviewTip('gameover'),
    });
  }

  reviewTip(returnTo) {
    this.overlays.closeActive();
    this.overlays.showHint({
      hint: this.description.hint,
      onClose: () => {
        this.overlays.closeActive();
        if (returnTo === 'complete') this.showCompleteModal();
        else this.showGameOverModal();
      },
    });
  }

  restartRun() {
    this.overlays.closeActive();
    this.panel?.hide();
    this.physics.resume();
    this.scene.restart({ skipTutorial: true, seed: this.seed });
  }
}
