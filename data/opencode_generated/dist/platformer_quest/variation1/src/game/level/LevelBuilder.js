import * as Phaser from '../../../vendor/phaser.esm.min.js';
import { COLORS, DEPTH, WORLD } from '../constants.js';
import { LEVEL_CONFIG } from '../../data/levelConfig.js';

const TILE = WORLD.tile;

export class LevelBuilder {
  constructor(scene) {
    this.scene = scene;
    this.config = LEVEL_CONFIG;
    this.solids = scene.physics.add.staticGroup();
    this.coins = scene.physics.add.staticGroup();
    this.hazards = scene.physics.add.staticGroup();
    this.gates = {};
    this.enemies = [];
  }

  build() {
    this.buildBackground();
    const layer = this.buildGround();
    this.buildPlatforms();
    this.buildWallsAndDoors();
    this.buildCoins();
    this.buildHazards();
    this.buildClue();
    this.buildGoal();
    this.buildEnemies();
    this.buildDecor();
    return {
      layer,
      solids: this.solids,
      coins: this.coins,
      hazards: this.hazards,
      gates: this.gates,
      enemies: this.enemies,
      goal: this.config.goal,
      clue: this.config.clue,
    };
  }

  addSolid(x, y, w, h) {
    const body = this.solids.create(x, y, 'pixel');
    body.setVisible(false);
    body.setDisplaySize(w, h);
    body.refreshBody();
    return body;
  }

  buildBackground() {
    const { scene } = this;

    const sky = scene.add.graphics().setDepth(DEPTH.sky);
    sky.fillGradientStyle(COLORS.skyTop, COLORS.skyTop, COLORS.skyBottom, COLORS.skyBottom, 1);
    sky.fillRect(0, 0, WORLD.width, WORLD.height);

    scene.add
      .image(1090, 92, 'glow')
      .setDisplaySize(420, 420)
      .setTint(0xfff3b0)
      .setAlpha(0.55)
      .setDepth(DEPTH.background);

    // The kit backgrounds are 256px tiles with a white sky. The derived
    // *_alpha copies key the sky out so the gradient shows through.
    for (let i = -1; i <= 2; i += 1) {
      scene.add
        .image(220 + i * 480, 596, 'hills_alpha')
        .setOrigin(0.5, 1)
        .setDisplaySize(640, 640)
        .setTint(0xdff2ff)
        .setAlpha(0.5)
        .setDepth(DEPTH.background);
    }
    for (let i = 0; i < 5; i += 1) {
      scene.add
        .image(128 + i * 256, 512, 'forest_alpha')
        .setOrigin(0.5, 1)
        .setAlpha(0.82)
        .setDepth(DEPTH.background + 1);
    }

    // Soft cloud clusters drifting above the hills.
    const clouds = [
      { x: 180, y: 104, scale: 1.05, speed: 5200 },
      { x: 620, y: 74, scale: 0.8, speed: 6800 },
      { x: 980, y: 138, scale: 0.65, speed: 7600 },
    ];
    for (const cloud of clouds) {
      const group = scene.add.container(cloud.x, cloud.y).setDepth(DEPTH.farDecor).setAlpha(0.85);
      const puffs = [
        { x: 0, y: 0, r: 30 },
        { x: 34, y: 6, r: 24 },
        { x: -32, y: 8, r: 22 },
        { x: 12, y: -12, r: 20 },
      ];
      for (const puff of puffs) {
        group.add(scene.add.circle(puff.x, puff.y, puff.r, 0xffffff, 0.82));
      }
      scene.tweens.add({
        targets: group,
        x: cloud.x + 90,
        duration: cloud.speed,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Pollen / firefly motes.
    scene.add
      .particles(0, 0, 'spark', {
        x: { min: 0, max: WORLD.width },
        y: { min: 180, max: 520 },
        lifespan: 7200,
        speedX: { min: -8, max: 8 },
        speedY: { min: -14, max: -3 },
        scale: { start: 0.35, end: 0 },
        alpha: { start: 0.5, end: 0 },
        quantity: 1,
        frequency: 280,
        tint: [0xfff3b0, 0xbaf7e0],
        blendMode: 'ADD',
      })
      .setDepth(DEPTH.farDecor);

    // Chasm shaft. Keep it above the parallax layers but below the ground.
    const pit = scene.add.graphics().setDepth(DEPTH.ground - 1);
    pit.fillGradientStyle(0x1b2638, 0x1b2638, 0x05080d, 0x05080d, 1);
    pit.fillRect(9 * TILE, 8 * TILE, TILE, WORLD.height - 8 * TILE);
    pit.fillStyle(0x000000, 0.35);
    pit.fillRect(9 * TILE, 8 * TILE, TILE, 18);

    const danger = scene.add
      .text(9 * TILE + TILE / 2, 8 * TILE - 22, '!', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffcf5c',
        stroke: '#1b2433',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.foreground);
    scene.tweens.add({
      targets: danger,
      alpha: 0.35,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
  }

  buildGround() {
    const { scene } = this;
    const data = [];
    for (let row = 0; row < WORLD.rows; row += 1) {
      const line = new Array(WORLD.cols).fill(-1);
      if (row >= this.config.ground.topRow) {
        for (const [from, to] of this.config.ground.segments) {
          for (let col = from; col <= to; col += 1) line[col] = 0;
        }
      }
      data.push(line);
    }

    const map = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('terrain', 'dirt', TILE, TILE, 0, 0);
    if (!tileset) {
      throw new Error('Could not create the dirt tileset.');
    }
    const layer = map.createLayer(0, tileset, 0, 0);
    layer.setDepth(DEPTH.ground);
    layer.setCollisionByExclusion([-1]);

    // Continuous grassy lip, then individual tufts on top.
    const lip = scene.add.graphics().setDepth(DEPTH.grass);
    for (const [from, to] of this.config.ground.segments) {
      lip.fillStyle(0x2ecc71, 1).fillRect(from * TILE, 8 * TILE, (to - from + 1) * TILE, 9);
      lip.fillStyle(0x25b562, 1).fillRect(from * TILE, 8 * TILE + 9, (to - from + 1) * TILE, 3);
    }

    for (const [from, to] of this.config.ground.segments) {
      for (let col = from; col <= to; col += 1) {
        if (col === 6 || col === 16) continue;
        if ((col * 5 + 3) % 3 === 0) {
          const x = col * TILE + 18 + ((col * 13) % 28);
          scene.add
            .image(x, 8 * TILE + 2, 'grass')
            .setOrigin(0.5, 1)
            .setScale(0.78 + ((col * 7) % 5) * 0.05)
            .setDepth(DEPTH.grass + 1);
        }
      }
    }

    return layer;
  }

  buildPlatforms() {
    const { scene } = this;

    for (const platform of this.config.platforms) {
      this.addSolid(platform.x + platform.w / 2, platform.y + 12, platform.w, 24);
      for (let x = platform.x; x < platform.x + platform.w; x += TILE) {
        scene.add.image(x + 32, platform.y, 'wood').setOrigin(0.5, 0).setDepth(DEPTH.platform);
      }
      // Supports.
      const support = scene.add.graphics().setDepth(DEPTH.platform - 1);
      support.fillStyle(0x5b3d28, 0.9);
      support.fillRect(platform.x + 12, platform.y + 24, 6, 26);
      support.fillRect(platform.x + platform.w - 18, platform.y + 24, 6, 26);
    }
  }

  buildWallsAndDoors() {
    const { scene } = this;

    for (const wall of this.config.walls) {
      const cx = wall.col * TILE + TILE / 2;
      for (const row of wall.blockRows) {
        const cy = row * TILE + TILE / 2;
        scene.add.image(cx, cy, 'castle_block').setDepth(DEPTH.wall);
        this.addSolid(cx, cy, TILE, TILE);
      }
      // A restrained vertical highlight so the tower reads against the sky.
      scene.add
        .rectangle(wall.col * TILE + 6, 256, 3, 512, 0xffffff, 0.08)
        .setDepth(DEPTH.wall + 1);
    }

    for (const door of this.config.doors) {
      this.buildDoor(door);
    }
  }

  buildDoor(door) {
    const { scene } = this;
    const { x, y, w, h, tint } = door;

    // Stone surround so each doorway reads as a recess in the gate tower even
    // though the tower is only one tile wide.
    const frame = scene.add.graphics().setDepth(DEPTH.door - 1);
    frame.fillStyle(0x7b8da4, 1);
    frame.fillRect(x - 5, y - 5, w + 10, h + 10);
    frame.fillStyle(0x5a6a80, 1);
    frame.fillRect(x - 5, y - 5, w + 10, 6);
    frame.fillStyle(0x9fb1c8, 0.45);
    frame.fillRect(x - 5, y - 5, 4, h + 10);
    frame.fillStyle(0x8fa2b8, 1);
    frame.fillRect(x + w / 2 - 10, y - 9, 20, 8);
    frame.lineStyle(2, 0x2b3445, 0.9);
    frame.strokeRect(x - 5, y - 5, w + 10, h + 10);
    frame.strokeRect(x + w / 2 - 10, y - 9, 20, 8);

    const interior = scene.add.graphics().setDepth(DEPTH.door);
    interior.fillGradientStyle(0x0a0f18, 0x0a0f18, 0x1d2a3d, 0x1d2a3d, 1);
    interior.fillRect(x + 4, y, w - 8, h);
    interior.lineStyle(4, 0x2b3445, 1);
    interior.strokeRect(x + 1, y, w - 2, h);
    interior.lineStyle(2, 0x9fb1c8, 0.28);
    interior.strokeRect(x + 5, y + 4, w - 10, h - 8);

    const labelText = scene.add
      .text(x + w / 2, y - 23, door.label, {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color: `#${tint.toString(16).padStart(6, '0')}`,
        stroke: '#0b1220',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.label);

    const container = scene.add.container(x + w / 2, y).setDepth(DEPTH.gate);
    const glow = scene.add
      .image(0, h / 2, 'glow')
      .setDisplaySize(w * 2.2, h * 1.35)
      .setTint(tint)
      .setAlpha(0.32)
      .setBlendMode(Phaser.BlendModes.ADD);
    const fill = scene.add.rectangle(0, h / 2, w - 8, h - 6, tint, 0.1);
    const bars = [];
    for (let i = 0; i < 4; i += 1) {
      bars.push(scene.add.rectangle(-w / 2 + 12 + i * 13, h / 2, 3, h - 10, tint, 0.7));
    }
    const capTop = scene.add.rectangle(0, 3, w - 6, 4, tint, 0.85);
    const capBottom = scene.add.rectangle(0, h - 3, w - 6, 4, tint, 0.85);
    const rune = scene.add
      .text(0, h / 2, '?', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(0.75);
    container.add([glow, fill, ...bars, capTop, capBottom, rune]);

    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.18, to: 0.42 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: rune,
      y: h / 2 - 4,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const blocker = this.addSolid(x + w / 2, y + h / 2, w, h);

    const emitter = scene.add
      .particles(x + w / 2, y + h / 2, 'spark', {
        x: { min: -w / 2, max: w / 2 },
        y: { min: -h / 2, max: h / 2 },
        lifespan: 900,
        speedY: { min: -22, max: -6 },
        speedX: { min: -8, max: 8 },
        scale: { start: 0.32, end: 0 },
        alpha: { start: 0.55, end: 0 },
        frequency: 130,
        quantity: 1,
        tint,
        blendMode: 'ADD',
      })
      .setDepth(DEPTH.gate - 1);

    this.gates[door.id] = {
      ...door,
      container,
      blocker,
      emitter,
      labelText,
      rune,
      opened: false,
      zone: {
        x1: x - 56,
        x2: x + w + 20,
        y1: y - 18,
        y2: y + h,
      },
      centerX: x + w / 2,
      centerY: y + h / 2,
    };
  }

  buildCoins() {
    const { scene } = this;
    for (const coin of this.config.coins) {
      const glow = scene.add
        .image(coin.x, coin.y, 'glow')
        .setDisplaySize(70, 70)
        .setTint(0xffe08a)
        .setAlpha(0.28)
        .setDepth(DEPTH.coin - 1)
        .setBlendMode(Phaser.BlendModes.ADD);
      const sprite = this.coins.create(coin.x, coin.y, 'coin');
      sprite.setScale(0.7);
      sprite.refreshBody();
      sprite.setDepth(DEPTH.coin);
      sprite.setData('glow', glow);
      scene.tweens.add({
        targets: [sprite, glow],
        y: coin.y - 5,
        duration: 1300 + (coin.x % 7) * 40,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  buildHazards() {
    const { scene } = this;
    for (const spike of this.config.spikes) {
      scene.add
        .image(spike.x, spike.feetY + 2, 'spikes')
        .setOrigin(0.5, 1)
        .setScale(0.85)
        .setDepth(DEPTH.platform);
      const body = this.hazards.create(spike.x, spike.feetY - 17, 'pixel');
      body.setVisible(false);
      body.setDisplaySize(54, 34);
      body.refreshBody();
    }
  }

  buildClue() {
    const { scene } = this;
    const clue = this.config.clue;
    const glow = scene.add
      .image(clue.x, clue.y, 'glow')
      .setDisplaySize(150, 150)
      .setTint(0x7ee2ff)
      .setAlpha(0.4)
      .setDepth(DEPTH.coin - 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    const orb = scene.add
      .image(clue.x, clue.y, 'clue')
      .setDepth(DEPTH.coin + 1)
      .setScale(0.92);
    scene.tweens.add({
      targets: orb,
      y: clue.y - 10,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.25, to: 0.5 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
    });
    scene.add
      .text(clue.x, clue.y - 48, 'BONUS CLUE', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '10px',
        color: '#bff6ff',
        stroke: '#0b1220',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.label);
    this.clueVisual = { glow, orb };
  }

  buildGoal() {
    const { scene } = this;
    const goal = this.config.goal;

    scene.add
      .image(goal.x, goal.feetY - 34, 'glow')
      .setDisplaySize(190, 190)
      .setTint(0xffe08a)
      .setAlpha(0.35)
      .setDepth(DEPTH.coin - 1)
      .setBlendMode(Phaser.BlendModes.ADD);

    const flag = scene.add
      .image(goal.x, goal.feetY, 'flag')
      .setOrigin(0.5, 1)
      .setScale(1.35)
      .setDepth(DEPTH.coin);
    scene.tweens.add({
      targets: flag,
      scaleX: 1.39,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    scene.add
      .text(goal.x, goal.feetY - 122, 'GOAL', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffcf5c',
        stroke: '#0b1220',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.label);

    scene.add
      .particles(goal.x, goal.feetY - 50, 'spark', {
        x: { min: -22, max: 22 },
        y: { min: -70, max: 30 },
        lifespan: 1200,
        speedY: { min: -24, max: -8 },
        scale: { start: 0.35, end: 0 },
        alpha: { start: 0.7, end: 0 },
        frequency: 320,
        quantity: 1,
        tint: [0xffcf5c, 0xfff6e5],
        blendMode: 'ADD',
      })
      .setDepth(DEPTH.coin - 1);
  }

  buildEnemies() {
    const { scene } = this;
    for (const spec of this.config.enemies) {
      if (spec.type === 'slime') {
        const sprite = scene.physics.add.sprite(spec.x, spec.feetY - 32, 'slime_rest');
        sprite.setBodySize(40, 32);
        sprite.setOffset(12, 30);
        sprite.body.setAllowGravity(false);
        sprite.setImmovable(true);
        sprite.setDepth(DEPTH.enemy);
        sprite.body.setVelocityX(spec.speed);
        sprite.play('slime-walk');
        sprite.setData('spec', spec);
        const shadow = scene.add
          .image(spec.x, spec.feetY - 3, 'shadow')
          .setDisplaySize(62, 18)
          .setAlpha(0.45)
          .setDepth(DEPTH.enemy - 1);
        this.enemies.push({ type: 'slime', sprite, spec, shadow });
      } else if (spec.type === 'bee') {
        const sprite = scene.physics.add.sprite(spec.x, spec.y, 'bee_rest');
        sprite.setBodySize(36, 28);
        sprite.setOffset(14, 18);
        sprite.body.setAllowGravity(false);
        sprite.setImmovable(true);
        sprite.setDepth(DEPTH.enemy);
        sprite.play('bee-fly');
        sprite.setData('spec', spec);
        scene.tweens.add({
          targets: sprite,
          x: spec.maxX,
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        scene.tweens.add({
          targets: sprite,
          y: spec.minY,
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.enemies.push({ type: 'bee', sprite, spec });
      }
    }
  }

  buildDecor() {
    const { scene } = this;
    const bushes = [128, 680, 1200];
    for (const x of bushes) {
      scene.add
        .image(x, 8 * TILE + 2, 'bush')
        .setOrigin(0.5, 1)
        .setScale(1.05)
        .setDepth(DEPTH.grass + 2);
    }

    // Small flowers.
    const flowers = [
      { x: 208, color: 0xffd166 },
      { x: 340, color: 0xff8fa3 },
      { x: 720, color: 0xffd166 },
      { x: 940, color: 0xb9a7ff },
      { x: 1210, color: 0xff8fa3 },
    ];
    const g = scene.add.graphics().setDepth(DEPTH.grass + 2);
    for (const flower of flowers) {
      g.lineStyle(2, 0x2f9e74, 1);
      g.beginPath();
      g.moveTo(flower.x, 512);
      g.lineTo(flower.x, 502);
      g.strokePath();
      g.fillStyle(flower.color, 1);
      g.fillCircle(flower.x, 498, 4);
      g.fillStyle(0xfff6e5, 1);
      g.fillCircle(flower.x, 498, 1.5);
    }

    // Fork signpost: the upper route needs a jump, the lower route is direct.
    const sign = scene.add.graphics().setDepth(DEPTH.grass + 3);
    sign.fillStyle(0x5b3d28, 1);
    sign.fillRect(244, 470, 8, 42);
    sign.fillStyle(0x8a5a36, 1);
    sign.fillRoundedRect(188, 424, 120, 50, 8);
    sign.lineStyle(3, 0x2b3445, 1);
    sign.strokeRoundedRect(188, 424, 120, 50, 8);
    scene.add
      .text(248, 440, 'UPPER ↑\nLOWER →', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fff6e5',
        align: 'center',
        lineSpacing: 3,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.grass + 4);

    // Where the high road drops back to the main path.
    scene.add
      .text(832, 376, 'ROUTES\nREJOIN', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#cfe0ff',
        align: 'center',
        lineSpacing: 2,
        stroke: '#0b1220',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.label)
      .setAlpha(0.9);
  }

  destroy() {
    this.solids.destroy(true);
    this.coins.destroy(true);
    this.hazards.destroy(true);
  }
}
