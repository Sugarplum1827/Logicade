import * as Phaser from '../vendor/phaser.esm.min.js';
import { GRID, assetIds } from './core.js';

const T = GRID.tile;
const W = GRID.w * T;
const SH = GRID.h * T;
const PANEL = 292;
const H = SH + PANEL;
const FONT = 'Segoe UI, Trebuchet MS, sans-serif';
const MONO = 'Consolas, Courier New, monospace';
const OBSTACLE_TEXTURE = {
  spike: 'tiles.spikes',
  bush: 'tiles.bush',
  slime: 'enemies.slime_rest',
  bee: 'enemies.bee_rest',
};
const LANE_SPAWNS = [
  [0.5, 4],
  [13, 4],
  [7, 0.5],
  [7, 7.5],
];

const style = (overrides = {}) => ({
  fontFamily: FONT,
  fontSize: '18px',
  color: '#eef6ff',
  ...overrides,
});

const accentNumber = (hex) => Number.parseInt(String(hex || '#7ee2b8').replace('#', ''), 16) || 0x7ee2b8;
const point = (value) => [value[0] * T + T / 2, value[1] * T + T / 2];

export class LogicadeScene extends Phaser.Scene {
  constructor() {
    super('play');
  }

  init(data) {
    Object.assign(this, {
      round: data.round,
      cfg: data.cfg,
      emit: data.emit,
      manifest: data.manifest,
      base: data.base,
      paused: false,
      locked: true,
      ended: false,
      started: false,
      elapsed: 0,
      questionStart: 0,
      buttons: [],
      marks: [],
      sequenceChips: [],
      phase: 0,
      lastSecond: -1,
      muted: false,
      accent: accentNumber(data.cfg.accent),
    });
  }

  preload() {
    this.load.on('loaderror', (file) => console.warn('[preload] could not load', file.key, file.src));
    const required = new Set(assetIds(this.cfg));
    for (const asset of this.manifest.assets) {
      if (asset.id.startsWith('audio.')) required.add(asset.id);
    }
    for (const asset of this.manifest.assets) {
      if (!required.has(asset.id)) continue;
      const url = `${this.base}${asset.path}`;
      if (asset.id.startsWith('audio.')) this.load.audio(asset.id, url);
      else this.load.image(asset.id, url);
    }
  }

  create() {
    const cfg = this.cfg;
    const layout = cfg.layout;
    const lane = cfg.mode === 'lane_defense';
    this.themed = Boolean(cfg.assets?.theme);
    this.followerId = cfg.assets.follower || 'characters.beige_idle';
    this.enemyId = this.themed ? cfg.assets.enemy : `enemies.${cfg.assets.enemy}_rest`;

    if (this.themed && Phaser.Textures?.FilterMode?.NEAREST !== undefined) {
      for (const id of assetIds(cfg)) {
        const texture = this.textures.exists(id) ? this.textures.get(id) : null;
        if (texture && typeof texture.setFilter === 'function') {
          texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
      }
    }

    this.cameras.main.setBackgroundColor('#0b1220');
    this.add
      .rectangle(0, 0, W, SH, 0x0b1220)
      .setOrigin(0)
      .setDepth(-20);

    this.bg = this.add
      .image(0, 0, cfg.assets.bg)
      .setOrigin(0)
      .setDisplaySize(W, SH)
      .setDepth(-10);
    if (!this.themed) this.bg.setTint(cfg.tint);
    this.add.rectangle(0, 0, W, 110, 0x07101d, 0.62).setOrigin(0).setDepth(-5);
    this.add.rectangle(0, SH - 54, W, 54, 0x07101d, 0.58).setOrigin(0).setDepth(-5);

    if (cfg.mode === 'grid_route') this.drawGrid();
    if (lane) this.drawLanes();
    if (cfg.mode === 'sequence') this.drawSequenceRail();
    if (cfg.mode === 'rhythm') this.drawBeatPads();

    this.drawPath(lane);
    this.drawObstacles();
    this.drawCoins();

    const start = point(layout.path[0]);
    const end = point(layout.path[layout.path.length - 1]);
    if (!lane) this.fit(this.add.image(end[0], end[1], cfg.assets.goal), T * 0.92).setDepth(4);

    const heroPoint = lane ? (cfg.features.lanes > 1 ? point([7, 4]) : point([11, 6])) : start;
    this.hero = this.fit(this.add.image(heroPoint[0], heroPoint[1], this.pose('idle')), 58).setDepth(8);
    this.heroScale = this.hero.scaleX;

    if (cfg.features.follower) {
      this.mate = this.fit(this.add.image(heroPoint[0] - 42, heroPoint[1], this.followerId), 46).setDepth(7);
    }
    if (cfg.features.phases) {
      this.rival = this.fit(this.add.image(end[0] + 18, end[1] - 52, this.enemyId), 62).setDepth(6);
    }

    this.drawHud();
    this.drawQuestionPanel();
    this.drawTopButtons();
    this.bindKeys();
    this.showIntro();
    window.dispatchEvent(
      new CustomEvent('logicade:ready', {
        detail: {
          displayName: cfg.display_name,
          variation: cfg.label,
          mode: cfg.mode,
          questionCount: this.round.qs.length,
        },
      }),
    );
  }

  // ---------------------------------------------------------------------
  // Layout helpers
  // ---------------------------------------------------------------------

  fit(object, width) {
    object.setScale(width / object.width);
    return object;
  }

  pose(name) {
    if (this.themed) return this.cfg.assets.player;
    const key = `characters.${this.cfg.assets.player}_${name}`;
    return this.textures.exists(key) ? key : `characters.${this.cfg.assets.player}_idle`;
  }

  obstacleTexture(type) {
    return this.cfg.assets.obstacles?.[type] || OBSTACLE_TEXTURE[type] || 'tiles.bush';
  }

  drawGrid() {
    const grid = this.add.graphics().setDepth(-2);
    grid.lineStyle(1, this.accent, 0.16);
    for (let x = 0; x <= GRID.w; x += 1) grid.lineBetween(x * T, 0, x * T, SH);
    for (let y = 0; y <= GRID.h; y += 1) grid.lineBetween(0, y * T, W, y * T);
  }

  drawLanes() {
    const lanes = this.cfg.features.lanes > 1 ? 4 : 1;
    const graphics = this.add.graphics().setDepth(-2);
    if (lanes === 4) {
      for (const [x, y] of LANE_SPAWNS) {
        const [px, py] = point([x, y]);
        graphics.lineStyle(2, this.accent, 0.2);
        graphics.lineBetween(px, py, W / 2, SH / 2);
      }
    } else {
      graphics.lineStyle(2, this.accent, 0.2);
      graphics.lineBetween(0, SH - 90, W, SH - 90);
    }
    const core = this.add.circle(W / 2, SH / 2, 46, 0x0b1220, 0.72).setStrokeStyle(3, this.accent, 0.8).setDepth(-1);
    this.core = core;
  }

  drawPath(lane) {
    const path = this.cfg.layout.path;
    if (lane) {
      const [cx, cy] = point([7, 4]);
      this.add.circle(cx, cy, 76, this.accent, 0.08).setDepth(-1);
      return;
    }
    for (let index = 0; index < path.length; index += 1) {
      const [x, y] = point(path[index]);
      const tile = this.fit(this.add.image(x, y + 22, this.cfg.assets.tile), T * 0.9)
        .setAlpha(this.themed ? 0.98 : 0.78)
        .setDepth(0);
      if (this.cfg.mode === 'sequence') {
        tile.setTint(0x9fb1c8);
        this.add
          .rectangle(x, y + 22, T * 0.72, T * 0.28, 0x07101d, 0.55)
          .setStrokeStyle(1, this.accent, 0.35)
          .setDepth(1);
      }
      if (this.cfg.features.switches) {
        this.marks.push(this.add.circle(x, y - 8, 8, 0x3a4a63).setStrokeStyle(2, 0xeef6ff, 0.7).setDepth(3));
      }
    }
  }

  drawObstacles() {
    for (const obstacle of this.cfg.layout.obstacles) {
      const [x, y] = point([obstacle.x, obstacle.y]);
      this.fit(this.add.image(x, y, this.obstacleTexture(obstacle.type)), obstacle.type === 'bush' ? 46 : 40)
        .setAlpha(0.88)
        .setDepth(2);
    }
  }

  drawCoins() {
    for (const coin of this.cfg.layout.coins) {
      const [x, y] = point(coin);
      this.fit(this.add.image(x, y, this.cfg.assets.coin), this.themed ? 30 : 28).setDepth(3);
    }
  }

  drawSequenceRail() {
    const total = Math.min(8, this.round.qs.length);
    const slotWidth = 96;
    const gap = 10;
    const startX = (W - (total * slotWidth + (total - 1) * gap)) / 2;
    for (let index = 0; index < total; index += 1) {
      const x = startX + index * (slotWidth + gap);
      const rect = this.add
        .rectangle(x, 74, slotWidth, 42, 0x101826, 0.82)
        .setOrigin(0)
        .setStrokeStyle(2, 0x3a4a63, 0.9)
        .setDepth(5);
      const label = this.add
        .text(x + slotWidth / 2, 95, `${index + 1}`, style({ fontFamily: MONO, fontSize: '14px', color: '#9fb1c8' }))
        .setOrigin(0.5)
        .setDepth(6);
      this.sequenceChips.push({ rect, label });
    }
  }

  drawBeatPads() {
    this.beatPads = [];
    const pads = [
      [0.24, 0.72],
      [0.41, 0.72],
      [0.59, 0.72],
      [0.76, 0.72],
    ];
    for (const [x, y] of pads) {
      const pad = this.add
        .circle(W * x, SH * y, 28, 0x101826, 0.8)
        .setStrokeStyle(3, this.accent, 0.55)
        .setDepth(4);
      this.beatPads.push(pad);
    }
    this.beatMarker = this.add
      .rectangle(W * 0.24, SH * 0.72, 8, 70, this.accent, 0.9)
      .setDepth(5);
  }

  drawHud() {
    this.hud = this.add
      .text(16, 14, '', style({ fontFamily: MONO, fontSize: '15px', backgroundColor: '#00000066', padding: { x: 8, y: 5 } }))
      .setDepth(20);
    this.modeBadge = this.add
      .text(W - 16, 14, this.cfg.mechanic.toUpperCase(), style({ fontSize: '12px', color: '#07101d', backgroundColor: this.cfg.accent, padding: { x: 8, y: 5 } }))
      .setOrigin(1, 0)
      .setDepth(20);
    this.progressTrack = this.add.rectangle(W / 2 - 170, 54, 340, 8, 0x263248, 0.9).setOrigin(0).setDepth(20);
    this.progressFill = this.add.rectangle(W / 2 - 170, 54, 0, 8, this.accent, 1).setOrigin(0).setDepth(21);
  }

  drawQuestionPanel() {
    this.add.rectangle(0, SH, W, PANEL, 0x0b1220, 1).setOrigin(0).setDepth(10);
    this.add.rectangle(0, SH, W, 3, this.accent, 0.8).setOrigin(0).setDepth(11);
    this.qtext = this.add
      .text(24, SH + 16, '', style({ fontSize: '20px', wordWrap: { width: W - 48 } }))
      .setDepth(12);
    this.feedback = this.add
      .text(24, H - 54, '', style({ fontSize: '15px', color: '#b8c7da', wordWrap: { width: W - 48 } }))
      .setDepth(12);
  }

  drawTopButtons() {
    this.pauseButton = this.add
      .text(W - 16, 44, 'II  pause', style({ fontFamily: MONO, fontSize: '12px', color: '#9fb1c8' }))
      .setOrigin(1, 0)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    this.pauseButton.on('pointerdown', () => this.setPaused(!this.paused));
    this.muteButton = this.add
      .text(W - 16, 68, 'sound on', style({ fontFamily: MONO, fontSize: '12px', color: '#9fb1c8' }))
      .setOrigin(1, 0)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    this.muteButton.on('pointerdown', () => this.toggleMute());
  }

  bindKeys() {
    this.input.keyboard.on('keydown', (event) => {
      const number = Number.parseInt(event.key, 10);
      if (number >= 1 && number <= this.buttons.length) {
        this.submit(number - 1);
        return;
      }
      if (event.key === 'h' || event.key === 'H') this.useHint();
      else if (event.key === 'Escape') this.setPaused(!this.paused);
      else if (event.key === 'm' || event.key === 'M') this.toggleMute();
      else if (event.key === 'r' || event.key === 'R') window.location.reload();
      else if (event.key === 'Enter' && !this.started) this.startRound();
    });
  }

  // ---------------------------------------------------------------------
  // Intro / question flow
  // ---------------------------------------------------------------------

  showIntro() {
    const cfg = this.cfg;
    const depth = 100;
    const cover = this.add.rectangle(0, 0, W, H, 0x07101d, 0.94).setOrigin(0).setDepth(depth);
    const title = this.add
      .text(W / 2, 62, cfg.display_name, style({ fontSize: '42px', fontStyle: 'bold', color: '#fff6e5' }))
      .setOrigin(0.5)
      .setDepth(depth + 1);
    const variation = this.add
      .text(W / 2, 108, cfg.label, style({ fontFamily: MONO, fontSize: '17px', color: cfg.accent }))
      .setOrigin(0.5)
      .setDepth(depth + 1);
    const target = this.add
      .text(
        W / 2,
        150,
        `LEARNING TARGET  ·  ${cfg.learning_target}  ·  THEME  ·  ${cfg.skin}${cfg.theme_label ? `  ·  ART  ·  ${cfg.theme_label}` : ''}`,
        style({ fontSize: '14px', color: '#9fb1c8' }),
      )
      .setOrigin(0.5)
      .setDepth(depth + 1);
    const brief = this.add
      .text(W / 2, 198, cfg.core_brief, style({ fontSize: '17px', color: '#d7e4f2', align: 'center', wordWrap: { width: W - 160 } }))
      .setOrigin(0.5, 0)
      .setDepth(depth + 1);
    const mapBrief = this.add
      .text(
        W / 2,
        258,
        `THIS ROUTE  ·  ${cfg.brief.map}`,
        style({ fontSize: '14px', color: '#9fb1c8', align: 'center', wordWrap: { width: W - 200 } }),
      )
      .setOrigin(0.5, 0)
      .setDepth(depth + 1);
    const controls = this.add
      .text(
        W / 2,
        H - 186,
        '1–4 choose   ·   H hint   ·   Esc pause   ·   M mute   ·   R restart',
        style({ fontFamily: MONO, fontSize: '13px', color: '#9fb1c8' }),
      )
      .setOrigin(0.5)
      .setDepth(depth + 1);
    const button = this.add
      .rectangle(W / 2, H - 118, 300, 58, this.accent, 1)
      .setDepth(depth + 2)
      .setInteractive({ useHandCursor: true });
    const buttonText = this.add
      .text(W / 2, H - 118, 'Start round', style({ fontSize: '20px', fontStyle: 'bold', color: '#07101d' }))
      .setOrigin(0.5)
      .setDepth(depth + 3);
    const note = this.add
      .text(W / 2, H - 64, 'Questions come from the local catalog. No network calls.', style({ fontSize: '12px', color: '#6f8299' }))
      .setOrigin(0.5)
      .setDepth(depth + 1);

    this.introObjects = [cover, title, variation, target, brief, mapBrief, controls, button, buttonText, note];
    button.on('pointerdown', () => this.startRound());
    button.on('pointerover', () => button.setFillStyle(0xffffff, 1));
    button.on('pointerout', () => button.setFillStyle(this.accent, 1));
  }

  startRound() {
    if (this.started || !this.qtext || !this.hero) return;
    this.started = true;
    this.locked = false;
    for (const object of this.introObjects || []) object.destroy();
    this.introObjects = [];
    this.emit('game_started', {
      concept_id: this.cfg.concept_id,
      variation_id: this.cfg.variation_id,
      mode: this.cfg.mode,
      map_id: this.cfg.map_id,
      seed: this.cfg.seed,
      question_count: this.round.qs.length,
    });
    this.showQuestion();
  }

  showQuestion() {
    const question = this.round.q;
    if (!question) {
      this.finish();
      return;
    }
    const count = question.options.length;
    const rows = Math.ceil(count / 2);
    const buttonHeight = rows > 2 ? 44 : 52;
    const buttonWidth = (W - 64) / 2;
    const startY = SH + 82;

    for (const button of this.buttons) {
      button.rect.destroy();
      button.text.destroy();
    }
    this.buttons = [];

    this.qtext.setText(`${this.round.i + 1}/${this.round.qs.length}  ${question.prompt}`);
    question.options.forEach((option, index) => {
      const x = 24 + (index % 2) * (buttonWidth + 16);
      const y = startY + Math.floor(index / 2) * (buttonHeight + 8);
      const rect = this.add
        .rectangle(x, y, buttonWidth, buttonHeight, 0x162235, 1)
        .setOrigin(0)
        .setStrokeStyle(2, 0x3a4a63, 0.95)
        .setDepth(13)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(x + 14, y + buttonHeight / 2, `${index + 1}. ${option}`, style({ fontSize: '16px', wordWrap: { width: buttonWidth - 28 } }))
        .setOrigin(0, 0.5)
        .setDepth(14);
      rect.on('pointerdown', () => this.submit(index));
      rect.on('pointerover', () => rect.setFillStyle(0x21324d, 1));
      rect.on('pointerout', () => rect.setFillStyle(0x162235, 1));
      this.buttons.push({ rect, text });
    });

    this.feedback.setText('');
    this.elapsed = 0;
    this.questionStart = Date.now();
    this.locked = false;
    this.spawnFoe();
    this.refreshHud();
    this.updateProgress();
    this.announceQuestion(question);
  }

  submit(index) {
    if (this.locked || this.paused || this.ended || this.round.done || !this.started) return;
    this.locked = true;
    const responseMs = Date.now() - this.questionStart;
    const result = index < 0 ? this.round.timeout() : this.round.answer(index);
    if (!result) return;

    this.emit('question_answered', {
      question_id: result.id,
      correct: result.ok,
      timed_out: index < 0,
      response_ms: responseMs,
      attempt: 1,
    });
    this.react(result);
    this.refreshHud();
    this.updateProgress();
    this.feedback.setText(
      `${result.ok ? 'Correct!' : index < 0 ? 'Time is up.' : 'Not quite.'} ${result.explanation || ''}`,
    );
    this.feedback.setColor(result.ok ? '#b8f5d6' : '#ffb3c0');
    this.announceFeedback(result);
    this.time.delayedCall(result.ok ? 950 : 1550, () => this.next());
  }

  next() {
    if (this.round.done) {
      this.finish();
      return;
    }
    this.round.next();
    this.showQuestion();
  }

  // ---------------------------------------------------------------------
  // Mode reactions
  // ---------------------------------------------------------------------

  react(result) {
    const cfg = this.cfg;
    const layout = cfg.layout;
    const step = result.step;
    const total = this.round.qs.length;
    const last = layout.path.length - 1;

    if (cfg.mode === 'lane_defense') this.reactLane(result);
    else if (cfg.mode === 'meter_sim') this.reactMeter(result, step, last);
    else if (cfg.mode === 'sequence') this.reactSequence(result, step);
    else if (cfg.mode === 'rhythm') this.reactRhythm(result, step);
    else this.hop(step, result.ok, last);

    if (cfg.features.switches) {
      this.marks[Math.min(step, last)]?.setFillStyle(result.ok ? this.accent : 0xb04040);
    }
    if (cfg.features.zones) {
      this.bg.setTexture(cfg.assets.zones[Math.min(2, Math.floor((3 * step) / total))]);
    }
    if (cfg.features.phases) {
      const phase = Math.floor((3 * step) / total);
      if (phase > this.phase && step < total) {
        this.phase = phase;
        this.banner(`Phase ${phase + 1}: the rival changes pace!`);
        this.tweens.add({ targets: this.rival, scaleX: this.rival.scaleX * 1.06, scaleY: this.rival.scaleY * 1.06, duration: 250, yoyo: true });
      }
      this.rival?.setAlpha(Math.max(0.3, 1 - (0.7 * step) / total));
      this.tweens.add({ targets: this.rival, angle: result.ok ? -18 : 18, yoyo: true, duration: 150 });
    }

    const checkpoint = cfg.features.checkpoint_every;
    if (result.ok && checkpoint && step % checkpoint === 0 && this.round.lives < this.round.maxLives) {
      this.round.heal();
      this.banner('Checkpoint saved: +1 life');
    }
  }

  hop(step, ok, last) {
    const path = this.cfg.layout.path;
    const [x, y] = point(path[Math.min(step, last)]);
    if (ok) {
      this.play('audio.jump');
      this.hero.setTexture(this.pose('jump'));
    } else {
      this.hurt();
    }
    this.tweens.add({
      targets: this.hero,
      x,
      y,
      duration: 420,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.hero.setTexture(this.pose(ok ? 'idle' : 'hit'));
        if (ok) {
          this.hero.setScale(this.heroScale, this.heroScale * 0.8);
          this.tweens.add({ targets: this.hero, scaleY: this.heroScale, duration: 140 });
        }
      },
    });
    if (this.mate) {
      this.tweens.add({ targets: this.mate, x: x - 42, y, duration: 520, delay: 120 });
    }
  }

  reactLane(result) {
    if (result.ok) {
      this.play('audio.impact');
      if (this.foe) {
        this.tweens.add({ targets: this.foe, y: '-=70', alpha: 0, angle: 200, duration: 350 });
      }
      this.tweens.add({ targets: this.core, scaleX: 1.12, scaleY: 1.12, duration: 160, yoyo: true });
    } else {
      this.hurt();
      if (this.foe) {
        this.tweens.add({ targets: this.foe, x: W / 2, y: SH / 2, duration: 380, onComplete: () => this.foe?.destroy() });
      }
    }
  }

  reactMeter(result, step, last) {
    const [x, y] = point(this.cfg.layout.path[Math.min(step, last)]);
    const texture = result.ok ? this.cfg.assets.tile : this.obstacleTexture('spike');
    const sprite = this.fit(this.add.image(x, y, texture), 46).setDepth(5);
    const scale = sprite.scaleX;
    sprite.setScale(0);
    this.tweens.add({ targets: sprite, scale: scale, duration: 260, ease: 'Back.easeOut' });
    if (result.ok) this.play('audio.coin');
    else this.hurt();
    this.hop(step, result.ok, last);
  }

  reactSequence(result, step) {
    const chip = this.sequenceChips[Math.min(step - 1, this.sequenceChips.length - 1)];
    if (chip) {
      chip.rect.setFillStyle(result.ok ? this.accent : 0x7a2430, 0.9);
      chip.label.setText(result.ok ? 'OK' : 'ERR');
      chip.label.setColor(result.ok ? '#07101d' : '#ffe3e7');
      this.tweens.add({ targets: chip.rect, scaleX: 1.08, scaleY: 1.08, duration: 120, yoyo: true });
    }
    this.hop(step, result.ok, this.cfg.layout.path.length - 1);
  }

  reactRhythm(result, step) {
    const pad = this.beatPads?.[(step - 1) % this.beatPads.length];
    if (pad) {
      pad.setFillStyle(result.ok ? this.accent : 0x7a2430, 0.8);
      this.tweens.add({ targets: pad, scaleX: 1.35, scaleY: 1.35, duration: 140, yoyo: true });
      this.time.delayedCall(320, () => pad.setFillStyle(0x101826, 0.8));
    }
    if (result.ok) this.play('audio.coin');
    else this.hurt();
    this.hop(step, result.ok, this.cfg.layout.path.length - 1);
  }

  spawnFoe() {
    if (this.cfg.mode !== 'lane_defense') return;
    this.foe?.destroy();
    const spawn = this.cfg.features.lanes > 1 ? LANE_SPAWNS[this.round.i % LANE_SPAWNS.length] : [0.5, 6];
    this.foeFrom = point(spawn);
    this.foe = this.fit(this.add.image(this.foeFrom[0], this.foeFrom[1], this.enemyId), 56).setDepth(7);
  }

  hurt() {
    this.play('audio.hurt');
    this.hero.setTexture(this.pose('hit'));
    this.hero.setTint(0xff7777);
    this.cameras.main.shake(180, 0.008);
    this.time.delayedCall(420, () => this.hero.clearTint());
  }

  // ---------------------------------------------------------------------
  // HUD, timer, overlays
  // ---------------------------------------------------------------------

  limitMs() {
    const pacing = this.cfg.pacing;
    if (this.cfg.mode === 'lane_defense') return pacing.approach_s * 1000;
    if (this.cfg.mode === 'rhythm') return (pacing.timer_s || 12) * 1000;
    return pacing.timer_s > 0 ? pacing.timer_s * 1000 : 0;
  }

  refreshHud() {
    const limit = this.limitMs();
    const left = limit ? Math.max(0, Math.ceil((limit - this.elapsed) / 1000)) : null;
    this.hud.setText(
      `Lives ${this.round.lives}   Score ${this.round.score}   ${this.round.answered}/${this.round.qs.length}` +
        (left != null ? `   Time ${left}s` : ''),
    );
  }

  updateProgress() {
    const ratio = this.round.qs.length ? this.round.answered / this.round.qs.length : 0;
    this.progressFill.setSize(340 * Math.min(1, Math.max(0, ratio)), 8);
  }

  update(time, delta) {
    if (this.paused || this.locked || this.ended || !this.started) return;
    this.elapsed += delta;
    const limit = this.limitMs();
    if (!limit) return;

    const ratio = Math.min(1, this.elapsed / limit);
    if (this.foe && this.foeFrom) {
      const targetX = this.cfg.features.lanes > 1 ? W / 2 : this.hero.x;
      const targetY = this.cfg.features.lanes > 1 ? SH / 2 : this.hero.y;
      this.foe.x = this.foeFrom[0] + (targetX - this.foeFrom[0]) * ratio;
      this.foe.y = this.foeFrom[1] + (targetY - this.foeFrom[1]) * ratio;
    }
    if (this.beatMarker) {
      const start = W * 0.24;
      const end = W * 0.76;
      this.beatMarker.x = start + (end - start) * ((this.elapsed % 2000) / 2000);
    }

    const seconds = Math.ceil((limit - this.elapsed) / 1000);
    if (seconds !== this.lastSecond) {
      this.lastSecond = seconds;
      this.refreshHud();
    }
    if (ratio >= 1) this.submit(-1);
  }

  setPaused(paused) {
    if (!this.started || this.ended) return;
    this.paused = paused;
    if (paused) {
      this.pauseOverlay = this.add
        .text(W / 2, SH / 2, 'PAUSED\nEsc to resume', style({ fontSize: '42px', align: 'center', backgroundColor: '#000000cc', padding: { x: 24, y: 16 } }))
        .setOrigin(0.5)
        .setDepth(60);
      this.time.paused = true;
      this.tweens.pauseAll();
    } else {
      this.pauseOverlay?.destroy();
      this.pauseOverlay = null;
      this.time.paused = false;
      this.tweens.resumeAll();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.sound.mute = this.muted;
    this.muteButton.setText(this.muted ? 'sound off' : 'sound on');
  }

  useHint() {
    if (this.locked || this.ended || this.paused || !this.started) return;
    const index = this.round.hint();
    if (index == null) return;
    const button = this.buttons[index];
    button.rect.setFillStyle(0x101826, 1).disableInteractive();
    button.text.setAlpha(0.28);
    this.feedback.setText('Hint used: one wrong option has been removed.');
    this.feedback.setColor('#ffcf5c');
    this.emit('hint_used', { question_id: this.round.q.id });
  }

  finish() {
    if (this.ended) return;
    this.ended = true;
    this.locked = true;
    const result = this.round.result();
    this.play(result.won ? 'audio.goal' : 'audio.impact');
    for (const button of this.buttons) button.rect.disableInteractive();
    this.emit('activity_completed', { won: result.won, accuracy: result.accuracy });
    this.emit('game_over', {
      won: result.won,
      score: result.score,
      accuracy: result.accuracy,
      error_count: result.errors,
      hint_count: result.hints,
      reason: result.reason,
    });
    this.showResults(result);
  }

  showResults(result) {
    const depth = 100;
    this.add.rectangle(0, 0, W, H, 0x07101d, 0.94).setOrigin(0).setDepth(depth);
    this.add
      .text(W / 2, 130, result.won ? 'Route complete!' : 'Out of lives', style({ fontSize: '46px', fontStyle: 'bold', color: result.won ? '#b8f5d6' : '#ffb3c0' }))
      .setOrigin(0.5)
      .setDepth(depth + 1);
    this.add
      .text(
        W / 2,
        196,
        `Score ${result.score}   ·   Accuracy ${Math.round(result.accuracy * 100)}%   ·   Hints ${result.hints}`,
        style({ fontFamily: MONO, fontSize: '17px', color: '#d7e4f2' }),
      )
      .setOrigin(0.5)
      .setDepth(depth + 1);
    this.add
      .text(W / 2, 236, result.won ? 'Every question in this route is complete.' : 'The route ended early. Try again to finish it.', style({ fontSize: '16px', color: '#9fb1c8' }))
      .setOrigin(0.5)
      .setDepth(depth + 1);

    const button = (x, y, width, label, fill, textColor, onClick) => {
      const rect = this.add.rectangle(x, y, width, 52, fill, 1).setDepth(depth + 2).setInteractive({ useHandCursor: true });
      const text = this.add.text(x, y, label, style({ fontSize: '17px', fontStyle: 'bold', color: textColor })).setOrigin(0.5).setDepth(depth + 3);
      rect.on('pointerdown', onClick);
      rect.on('pointerover', () => rect.setFillStyle(0xffffff, 1));
      rect.on('pointerout', () => rect.setFillStyle(fill, 1));
      return { rect, text };
    };

    button(W / 2, H - 210, 300, 'Play again', this.accent, '#07101d', () => window.location.reload());
    button(W / 2, H - 148, 300, 'All variations', 0x162235, '#eef6ff', () => {
      window.location.href = this.cfg.urls.catalog;
    });
    if (this.cfg.urls.next) {
      button(W / 2, H - 86, 300, 'Next variation', 0x162235, '#eef6ff', () => {
        window.location.href = this.cfg.urls.next;
      });
    }
    window.dispatchEvent(
      new CustomEvent('logicade:results', {
        detail: {
          won: result.won,
          score: result.score,
          accuracy: result.accuracy,
          concept: this.cfg.display_name,
          variation: this.cfg.label,
        },
      }),
    );
  }

  banner(text) {
    const banner = this.add
      .text(W / 2, 100, text, style({ fontSize: '20px', align: 'center', backgroundColor: '#000000bb', padding: { x: 12, y: 7 } }))
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      y: 70,
      delay: 2200,
      duration: 600,
      onComplete: () => banner.destroy(),
    });
  }

  play(key) {
    try {
      if (this.cache.audio.exists(key)) this.sound.play(key);
    } catch {
      // Audio is optional; a blocked or unsupported codec must not stop play.
    }
  }

  announceQuestion(question) {
    window.dispatchEvent(
      new CustomEvent('logicade:question', {
        detail: {
          prompt: question.prompt,
          options: question.options,
          index: this.round.i + 1,
          total: this.round.qs.length,
        },
      }),
    );
  }

  announceFeedback(result) {
    window.dispatchEvent(
      new CustomEvent('logicade:feedback', {
        detail: {
          correct: result.ok,
          explanation: result.explanation,
          lives: this.round.lives,
          score: this.round.score,
        },
      }),
    );
  }
}
