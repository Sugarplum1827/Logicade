import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
    constructor() {
        super({key: 'BootScene'});
    }

    preload() {
        this.load.json('registry', '/data/registry.json');

        // Progress bar
        const bar = this.add.graphics();
        bar.fillStyle(0x4ade80, 1);
        bar.fillRect(0, this.scale.height / 2 - 4, 0, 8);
        this.load.on('progress', (p) => {
            bar.clear();
            bar.fillStyle(0x4ade80, 1);
            bar.fillRect(
                40, this.scale.height / 2 - 4,
                (this.scale.width - 80) * p, 8,
            );
        });

        // Log any failed loads
        this.load.on('loaderror', (file) => {
            console.error('[boot] FAILED to load asset:', file.key, '|', file.src);
        });
    }

    create() {
        const spec = this.registry.get('spec');
        const manifest = this.cache.json.get('registry');

        console.log('[boot] create() running', {
            hasSpec: !!spec,
            hasManifest: !!manifest,
            week: spec?.week,
            map: spec?.map,
            entities: spec?.entities?.length
        });

        if (!spec || !manifest) {
            this.add.text(20, 100, 'Boot error: missing spec or registry', {
                color: '#f87171', fontSize: '20px', fontFamily: 'monospace'
            });
            this.add.text(20, 140, 'Check browser console for details', {
                color: '#fbbf24', fontSize: '16px', fontFamily: 'monospace'
            });
            return;
        }

        // Queue assets needed for this level
        const map = manifest.tilemaps.find(m => m.id === spec.map);
        if (map) {
            this.load.image(spec.map, `/client/assets/${map.tileset}`);
        } else {
            console.warn('[boot] map not found in manifest:', spec.map);
        }

        const usedSpriteIds = new Set(spec.entities.map(e => e.sprite));
        for (const rule of spec.rules) {
            for (const effect of rule.then) {
                const m = String(effect).match(/^spawn\((\w+)\)$/);
                if (m) usedSpriteIds.add(m[1]);
            }
        }

        let queued = 0;
        for (const s of manifest.sprites) {
            if (usedSpriteIds.has(s.id)) {
                this.load.image(s.id, `/client/assets/${s.sprite_key}`);
                queued++;
            }
        }
        console.log('[boot] queued', queued, 'sprite assets');

        // ── TRANSITION GUARD ──
        let transitioned = false;
        const goToGame = () => {
            if (transitioned) return;
            transitioned = true;
            console.log('[boot] transitioning to GameScene');
            this.scene.start('GameScene', {spec, manifest});
        };

        // Normal path: loader completes
        this.load.once('complete', goToGame);

        // Fallback: if complete never fires (Phaser 4 quirk), force transition after 2s
        this.time.delayedCall(2000, () => {
            if (!transitioned) {
                console.warn('[boot] loader did not complete — forcing transition after 2s');
                goToGame();
            }
        });

        // Start the second-pass load with safety
        try {
            this.load.start();
        } catch (e) {
            console.error('[boot] load.start() threw:', e);
            goToGame();
        }
    }
}