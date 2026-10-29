import * as Phaser from '../../../vendor/phaser.esm.min.js';
import { fallbackDescription } from '../../data/fallbackDescription.js';
import { validateDescription, validateManifest } from '../validation.js';
import { COLORS } from '../constants.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.json('asset_manifest', './public/data/asset_manifest.json');
    this.load.json('level_description', './public/data/description.json');

    const title = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 66, 'PLATFORMER QUEST', {
        fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
        fontSize: '42px',
        fontStyle: 'bold',
        color: '#fff6e5',
      })
      .setOrigin(0.5);
    title.setShadow(0, 4, '#000000', 12, false, true);

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 18, 'FORKED ROUTES', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '16px',
        color: '#7ee2b8',
      })
      .setOrigin(0.5);

    const track = this.add.graphics();
    track.fillStyle(0x263248, 1).fillRoundedRect(this.scale.width / 2 - 170, this.scale.height / 2 + 34, 340, 10, 5);

    const bar = this.add.graphics();
    const redraw = (progress) => {
      bar.clear();
      bar.fillStyle(COLORS.mint, 1).fillRoundedRect(
        this.scale.width / 2 - 170,
        this.scale.height / 2 + 34,
        Math.max(10, 340 * progress),
        10,
        5,
      );
    };
    redraw(0.05);
    this.load.on('progress', redraw);
    this.load.on('loaderror', (file) => {
      console.warn('[boot] could not load', file.key, file.src);
    });
  }

  create() {
    const manifest = validateManifest(this.cache.json.get('asset_manifest'));
    if (!manifest.ok) {
      this.showFatal('The local asset manifest is missing or invalid.');
      return;
    }

    const fetched = validateDescription(this.cache.json.get('level_description'));
    const fallback = validateDescription(fallbackDescription);
    const description = fetched.ok ? fetched.description : fallback.description;
    const source = fetched.ok ? 'description.json' : 'bundled fallback';

    if (!description) {
      this.showFatal('No valid level description could be loaded.');
      return;
    }

    // PreloadScene makes the final choice so a host initialize message that
    // arrives while the assets are loading is still honoured.
    this.registry.set('assets', manifest.assets);
    this.registry.set('descriptionFallback', description);
    this.registry.set('descriptionFallbackSource', source);

    this.scene.start('PreloadScene');
  }

  showFatal(message) {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, message, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '20px',
        color: '#ff6b81',
        align: 'center',
        wordWrap: { width: 760 },
      })
      .setOrigin(0.5);
  }
}
