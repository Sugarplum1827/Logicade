// Preloads the registry and the assets referenced by the served spec (§11).
// The two-pass load (registry first, then spec-referenced sprites) keeps
// boot time proportional to what the level actually needs, not the whole
// 1741-file manifest.

class BootScene extends Phaser.Scene {
    constructor() {
        super({key: 'BootScene'});
    }

    preload() {
        this.load.json('registry', '/data/registry.json');

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
    }

        create() {
        const spec = this.registry.get('spec');
        const manifest = this.cache.json.get('registry');
        if (!spec || !manifest) {
            this.add.text(20, 20, 'boot error: missing spec or registry',
                {color: '#f87171'});
            return;
        }

        const map = manifest.tilemaps.find(m => m.id === spec.map);
        if (map) this.load.image(spec.map, `/client/assets/${map.tileset}`);

        const usedSpriteIds = new Set(spec.entities.map(e => e.sprite));
        
        // FIX: Scan rules for spawn(sprite_id) to load those textures too
        for (const rule of spec.rules) {
            for (const effect of rule.then) {
                const m = String(effect).match(/^spawn\((\w+)\)$/);
                if (m) usedSpriteIds.add(m[1]);
            }
        }

        for (const s of manifest.sprites) {
            if (usedSpriteIds.has(s.id)) {
                this.load.image(s.id, `/client/assets/${s.sprite_key}`);
            }
        }

        this.registry.set('manifest', manifest);

        this.load.once('complete', () => {
            this.scene.start('GameScene', {spec, manifest});
        });
        this.load.start();
    }
}