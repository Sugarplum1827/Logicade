// The DSL interpreter (§11). Single reusable scene.

class GameScene extends Phaser.Scene {
    constructor() {
        super({key: 'GameScene'});
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
        };
        Telemetry.reset();
    }

    create() {
        this.state.startedAt = this.time.now;
        this._emit('level_start', {});

        this._buildLayout();
        this._buildMap();
        this._buildEntities();
        this._buildInput();
        this._buildHUD();

        this.time.addEvent({
            delay: 100,
            loop: true,
            callback: () => { this.state.timer += 0.1; },
        });

        this.cameras.main.setBackgroundColor('#1a1a2e');
    }

    update(time, delta) {
        if (this.state.gameOver) return;
        this._movePlayer(delta);
        this._evaluateRules();
        this._checkHazardCollision();
        this._checkWin();
        this._updateHUD();
    }

    // ── Construction ─────────────────────────────────────────────────

    _buildLayout() {
        const map = this.manifest.tilemaps.find(m => m.id === this.spec.map);
        const [cols, rows] = map.grid_size;
        this.layout = SpecRenderer.computeLayout({
            viewportW: this.scale.width,
            viewportH: this.scale.height,
            gridCols: cols,
            gridRows: rows,
            tileSize: map.tile_size,
        });
        this.gridCols = cols;
        this.gridRows = rows;
    }

    _buildMap() {
        const {displaySize, offsetX, offsetY} = this.layout;
        for (let r = 0; r < this.gridRows; r++) {
            for (let c = 0; c < this.gridCols; c++) {
                const {x, y} = SpecRenderer.cellCenter(this.layout, c, r);
                this.add.image(x, y, this.spec.map)
                    .setDisplaySize(displaySize, displaySize)
                    .setDepth(0);
            }
        }
    }

            _buildEntities() {
        const used = new Set();

        for (const ent of this.spec.entities) {
            let col, row;
            if (ent.role === 'player') {
                col = 0;
                row = Math.floor(this.gridRows / 2);
            } else {
                const pos = this._randomFreeCell(used, ent.role);
                col = pos.col;
                row = pos.row;
            }
            used.add(`${col},${row}`);

            const {x, y} = SpecRenderer.cellCenter(this.layout, col, row);
            const sprite = this.physics.add.sprite(x, y, ent.sprite);
            const size = this.layout.displaySize * 0.8;
            sprite.setDisplaySize(size, size);
            sprite.setData('entityId', ent.id);
            sprite.setData('role', ent.role);
            sprite.setDepth(10);
            sprite.body.setSize(size, size);

            this.state.entities[ent.id] = sprite;
            if (ent.role === 'player') this.player = sprite;
        }
    }

    _randomFreeCell(used, role) {
        const playerRow = Math.floor(this.gridRows / 2);
        for (let i = 0; i < 200; i++) {
            const col = Phaser.Math.Between(0, this.gridCols - 1);
            const row = Phaser.Math.Between(0, this.gridRows - 1);
            
            // Prevent hazards/obstacles from spawning on or right next to the player (col 0)
            if ((role === 'hazard' || role === 'obstacle') && col <= 2 && Math.abs(row - playerRow) <= 1) {
                continue; 
            }
            
            if (!used.has(`${col},${row}`)) return {col, row};
        }
        return {col: this.gridCols - 1, row: this.gridRows - 1};
    }

    _buildInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: 'W', down: 'S', left: 'A', right: 'D',
        });
        this.input.keyboard.on('keydown-R', () => this._restart());
        this.input.keyboard.on('keydown-H', () => this._showHint());
    }

    _buildHUD() {
        const style = {fontSize: '18px', color: '#ffffff', fontFamily: 'monospace'};
        this.add.text(12, 12, 'Score: 0', style).setDepth(100).setName('hudScore');
        this.add.text(12, 36, 'Time: 0.0', style).setDepth(100).setName('hudTimer');
        this.add.text(12, this.scale.height - 24, 'H = hint   R = restart',
            {...style, fontSize: '14px', color: '#9ca3af'}).setDepth(100);
    }

    // ── Player movement ──────────────────────────────────────────────

    _movePlayer(delta) {
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

        const margin = this.layout.displaySize / 2;
        this.player.x = Phaser.Math.Clamp(
            this.player.x,
            this.layout.offsetX + margin,
            this.layout.offsetX + this.gridCols * this.layout.displaySize - margin,
        );
        this.player.y = Phaser.Math.Clamp(
            this.player.y,
            this.layout.offsetY + margin,
            this.layout.offsetY + this.gridRows * this.layout.displaySize - margin,
        );
    }

    // ── Rule engine ──────────────────────────────────────────────────

    _evaluateRules() {
        for (let i = 0; i < this.spec.rules.length; i++) {
            const rule = this.spec.rules[i];
            const triggered = this._evaluateTrigger(rule.on);
            const was = this.state.lastTriggered[i] || false;
            if (triggered && !was) {
                if (this._evaluateCondition(rule.if)) {
                    for (const effect of rule.then) {
                        this._applyEffect(effect, i);
                    }
                }
            }
            this.state.lastTriggered[i] = triggered;
        }
    }

    _evaluateTrigger(onStr) {
        const parsed = this._parseOn(onStr);
        if (!parsed) return false;
        const {trigger, args} = parsed;

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
            args: m[2] ? m[2].split(',').map(s => s.trim()) : [],
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
        const carry = String(ifStr).match(/^carrying\((\w+)\)$/);
        if (carry) return this.state.carrying.has(carry[1]);
        return false;
    }

    _compare(a, op, b) {
        switch (op) {
            case '==': return a == b;
            case '!=': return a != b;
            case '>=': return a >= b;
            case '<=': return a <= b;
            case '>': return a > b;
            case '<': return a < b;
            default: return false;
        }
    }

    _applyEffect(effectStr, ruleIndex) {
        const s = String(effectStr).trim();

        let m = s.match(/^score\s*([+\-]=)\s*(\d+)$/);
        if (m) {
            const delta = m[1] === '+=' ? parseFloat(m[2]) : -parseFloat(m[2]);
            this.state.score += delta;
            this._emit('rule_triggered', { rule_id: `r${ruleIndex}`, payload: {effect: s, new_score: this.state.score} });
            return;
        }

        m = s.match(/^destroy\((\w+)\)$/);
        if (m) {
            const target = this.state.entities[m[1]];
            if (target && target.active) {
                target.destroy();
                this.state.destroyed.add(m[1]);
                this.state.count += 1;
                this._emit('collision', { entity_id: m[1], rule_id: `r${ruleIndex}`, payload: {effect: s} });
            }
            return;
        }

        m = s.match(/^spawn\((\w+)\)$/);
        if (m) {
            const x = Phaser.Math.Between(this.layout.offsetX, this.layout.offsetX + this.gridCols * this.layout.displaySize);
            const y = this.layout.offsetY - 50;
            // Use the sprite id from the effect, fallback to spike if not found
            const spriteId = m[1]; 
            const hazard = this.physics.add.sprite(x, y, spriteId === 'hazard' ? 'spike' : spriteId);
            hazard.setDisplaySize(this.layout.displaySize * 0.8, this.layout.displaySize * 0.8);
            hazard.setData('role', 'hazard');
            hazard.body.setVelocityY(150); // Fall down
            this.state.entities[`spawned_${Date.now()}`] = hazard;
            return;
        }

        if (s === 'reset') {
            this._finish(false, 'reset_triggered');
        }
    }

    // ── Win / lose ───────────────────────────────────────────────────

    _checkWin() {
        if (this.state.gameOver) return;
        const m = String(this.spec.win).match(/^(score|timer|count)\s*(==|>=|<=|>|<|!=)\s*(-?\d+(?:\.\d+)?)$/);
        if (!m) return;
        const [, name, op, num] = m;
        if (this._compare(this.state[name], op, parseFloat(num))) {
            this._finish(true, 'win_condition');
        }
    }

    _checkHazardCollision() {
        if (this.state.gameOver || !this.player) return;
        for (const [id, ent] of Object.entries(this.state.entities)) {
            if (!ent.active) continue;
            if (ent.getData('role') !== 'hazard') continue;
            if (this.physics.overlap(this.player, ent)) {
                this._finish(false, 'hit_hazard');
                return;
            }
        }
    }

    _finish(won, reason) {
        if (this.state.gameOver) return;
        this.state.gameOver = true;
        this.state.won = won;
        this._emit(won ? 'level_win' : 'level_lose', {payload: {reason}});
        if (this.player.body) this.player.body.setVelocity(0);

        // Clamp score between 0 and 1 so the difficulty engine doesn't crash
        const maxScore = Math.max(1, this.spec.rules.length);
        const safeScore = Math.max(0, Math.min(1, this.state.score / maxScore));

        this.registry.set('lastAttempt', {
            level_id: this.registry.get('level_id'),
            won,
            reason,
            score: safeScore,
            accuracy: safeScore,
            error_count: this.state.errorCount,
            hint_count: this.state.hintCount,
            completion_time_sec: (this.time.now - this.state.startedAt) / 1000,
            events: Telemetry.snapshot(),
        });

        this.time.delayedCall(300, () => {
            this.scene.start('LevelCompleteScene');
        });
    }

    _restart() {
        if (this.state.gameOver) return;
        this._emit('restart_level', {});
        this._finish(false, 'restart');
    }

    _showHint() {
        this.state.hintCount += 1;
        this._emit('hint_opened', {});
        const existing = this.children.getByName('hintText');
        if (existing) existing.destroy();
        this.add.text(
            this.scale.width / 2, 30, this.spec.hint || '(no hint)',
            {
                fontSize: '16px', color: '#fef08a', fontFamily: 'monospace',
                backgroundColor: '#000000cc', padding: {x: 10, y: 6},
            },
        ).setOrigin(0.5).setDepth(150).setName('hintText');
    }

    _updateHUD() {
        const score = this.children.getByName('hudScore');
        const timer = this.children.getByName('hudTimer');
        if (score) score.setText(`Score: ${this.state.score}`);
        if (timer) timer.setText(`Time: ${this.state.timer.toFixed(1)}`);
    }

    _emit(eventType, fields) {
        fields.t_ms_since_start = Math.round(this.time.now - this.state.startedAt);
        Telemetry.emit(eventType, fields);
    }
}