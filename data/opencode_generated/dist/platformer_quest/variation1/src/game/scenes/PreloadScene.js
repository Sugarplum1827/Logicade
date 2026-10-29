import * as Phaser from '../../../vendor/phaser.esm.min.js';
import { COLORS } from '../constants.js';
import { LEVEL_CONFIG } from '../../data/levelConfig.js';
import { hostBridge } from '../hostBridge.js';
import { createGeneratedTextures } from '../textures.js';

const keyFor = (assetId) => assetId.split('.').pop();

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    const assets = this.registry.get('assets') || [];
    this.load.setBaseURL('./public/');

    const bar = this.add.graphics();
    const label = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 64, 'loading sprites and sound…', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '13px',
        color: '#9fb1c8',
      })
      .setOrigin(0.5);

    const draw = (progress) => {
      bar.clear();
      bar.fillStyle(0x263248, 1).fillRoundedRect(this.scale.width / 2 - 170, this.scale.height / 2 + 34, 340, 10, 5);
      bar
        .fillStyle(COLORS.mint, 1)
        .fillRoundedRect(
          this.scale.width / 2 - 170,
          this.scale.height / 2 + 34,
          Math.max(10, 340 * progress),
          10,
          5,
        );
      label.setText(`loading sprites and sound… ${Math.round(progress * 100)}%`);
    };
    draw(0.02);
    this.load.on('progress', draw);

    for (const asset of assets) {
      const key = keyFor(asset.id);
      if (/\.png$/i.test(asset.path)) {
        this.load.image(key, asset.path);
      } else if (/\.ogg$/i.test(asset.path)) {
        this.load.audio(key, asset.path);
      }
    }

    // Derived from the kit backgrounds: pure-white sky keyed to transparency so
    // the gradient sky shows through. Regenerate with scripts/derive_backgrounds.ps1.
    this.load.image('forest_alpha', 'assets/backgrounds/forest_alpha.png');
    this.load.image('hills_alpha', 'assets/backgrounds/hills_alpha.png');

    this.load.on('loaderror', (file) => {
      console.error('[preload] failed:', file.key, file.src);
    });
  }

  create() {
    createGeneratedTextures(this);
    this.registerAnimations();

    let description = this.registry.get('descriptionFallback');
    let source = this.registry.get('descriptionFallbackSource');
    const host = hostBridge.initialized;
    if (host?.description) {
      description = host.description;
      source = 'host initialize';
    }

    this.registry.set('description', description);
    this.registry.set('descriptionSource', source);
    this.registry.set('seed', LEVEL_CONFIG.seed);
    hostBridge.setMeta({
      game_id: description.game_id,
      variation_id: description.variation_id,
      seed: LEVEL_CONFIG.seed,
    });
    console.info(`[boot] ${description.title} — ${description.subtitle} (${source})`);

    this.scene.start('GameScene');
  }

  registerAnimations() {
    const add = (key, textures, frameRate, repeat = -1) => {
      if (this.anims.exists(key)) return;
      const frames = textures
        .filter((texture) => this.textures.exists(texture))
        .map((texture) => ({ key: texture }));
      if (!frames.length) return;
      this.anims.create({ key, frames, frameRate, repeat });
    };

    add('player-idle', ['green_idle'], 3, -1);
    add('player-walk', ['green_walk_a', 'green_walk_b'], 9);
    add('player-jump', ['green_jump'], 2, -1);
    add('player-hit', ['green_hit'], 2, -1);
    add('slime-walk', ['slime_walk_a', 'slime_walk_b'], 5);
    add('bee-fly', ['bee_fly_a', 'bee_fly_b'], 14);
  }
}
