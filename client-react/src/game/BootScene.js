import Phaser from 'phaser';

const ASSET_ROOT = '/vendor/kenney/organized';
const backgroundForWeek = (weekValue) => {
  const week = Number(weekValue) || 1;
  return week === 2 || week === 9 ? 'background_color_desert.png'
    : week === 3 || week === 8 ? 'background_color_hills.png'
      : week === 4 ? 'background_color_mushrooms.png' : 'background_color_trees.png';
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const suppliedRegistry = this.registry.get('manifest');
    if (suppliedRegistry) this.cache.json.add('registry', suppliedRegistry);
    else this.load.json('registry', '/data/registry.json');

    const week = this.registry.get('week') || 1;
    const background = backgroundForWeek(week);
    this.load.image('game_background', `${ASSET_ROOT}/sprites/new_platformer_pack_1_1/backgrounds/1x/${background}`);
    this.load.audio('kenney_collect', `${ASSET_ROOT}/audio/interface/interface_sounds/confirmation_001.ogg`);
    this.load.audio('kenney_error', `${ASSET_ROOT}/audio/interface/interface_sounds/error_001.ogg`);
    this.load.audio('kenney_click', `${ASSET_ROOT}/audio/interface/interface_sounds/click_001.ogg`);

    const bar = this.add.graphics();
    bar.fillStyle(0x4ade80, 1);
    bar.fillRect(0, this.scale.height / 2 - 4, 0, 8);
    this.load.on('progress', (p) => {
      bar.clear();
      bar.fillStyle(0x4ade80, 1);
      bar.fillRect(
        40,
        this.scale.height / 2 - 4,
        (this.scale.width - 80) * p,
        8,
      );
    });
    this.load.on('loaderror', (file) => {
      console.error('[boot] FAILED to load asset:', file.key, '|', file.src);
    });
  }

  create() {
    const spec = this.registry.get('spec');
    const manifest = this.cache.json.get('registry');

    const templateRuntime = this.registry.get('template_runtime');
    if (templateRuntime?.config && templateRuntime?.questions?.length) {
      console.log('[boot] launching reusable Phaser template', {
        template_id: templateRuntime.config.template_id,
        variation_id: templateRuntime.config.variation_id,
      });
      this.scene.start('LogicadeTemplateScene', templateRuntime);
      return;
    }

    console.log('[boot] create() running', {
      hasSpec: !!spec,
      hasManifest: !!manifest,
      week: spec?.week,
      missionType: spec?.mission_type,
      gameType: spec?.game_type,
      entityCount: Array.isArray(spec?.entities) ? spec.entities.length : 0,
    });

    if (!spec || !manifest) {
      this.add.text(20, 100, 'Boot error: missing spec or registry', {
        color: '#f87171',
        fontSize: '20px',
        fontFamily: 'monospace',
      });
      return;
    }

    // ── Only v1-shaped specs have entities / map / rules to load ──
    if (Array.isArray(spec.entities)) {
      const tilemaps = Array.isArray(manifest.tilemaps) ? manifest.tilemaps : [];
      const sprites = Array.isArray(manifest.sprites) ? manifest.sprites : [];
      const map = tilemaps.find((m) => m.id === spec.map);
      const background = backgroundForWeek(spec.week || this.registry.get('week'));
      if (map) this.load.image(spec.map, `${ASSET_ROOT}/sprites/new_platformer_pack_1_1/backgrounds/1x/${background}`);

      const usedSpriteIds = new Set();
      for (const e of spec.entities) {
        if (e && e.sprite) usedSpriteIds.add(e.sprite);
      }
      if (Array.isArray(spec.rules)) {
        for (const rule of spec.rules) {
          for (const effect of rule.then || []) {
            const m = String(effect).match(/^spawn\((\w+)\)$/);
            if (m) usedSpriteIds.add(m[1]);
          }
        }
      }
      for (const s of sprites) {
        if (usedSpriteIds.has(s.id)) {
          const spritePath = s.role === 'player'
            ? 'sprites/new_platformer_pack_1_1/tiles/1x/hud_player_helmet_green.png'
            : s.role === 'collectible' || s.role === 'powerup'
              ? 'sprites/new_platformer_pack_1_1/tiles/1x/coin_gold.png'
              : s.role === 'hazard'
                ? 'sprites/new_platformer_pack_1_1/enemies/1x/slime_block_rest.png'
                : 'sprites/new_platformer_pack_1_1/tiles/1x/block_coin_active.png';
          this.load.image(s.id, `${ASSET_ROOT}/${spritePath}`);
        }
      }
    }

    // ── Choose target scene based on spec shape ──
    const missionType = spec.mission_type || spec.metadata?.mission_type;
    const hasWorldMap = Boolean(spec.map && Array.isArray(spec.entities));
    const sceneKey = hasWorldMap && !missionType ? 'GameScene' : 'MissionScene';

    let transitioned = false;
    const goToGame = () => {
      if (transitioned) return;
      transitioned = true;
      console.log('[boot] transitioning to', sceneKey);
      this.scene.start(sceneKey, { spec, manifest });
    };

    this.load.once('complete', goToGame);
    try {
      this.load.start();
    } catch (e) {
      console.error('[boot] load.start() threw:', e);
      goToGame();
    }
  }
}
