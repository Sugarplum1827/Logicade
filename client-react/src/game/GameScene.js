import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
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
            paused: false,
        };
        Telemetry.reset();
    }

    create() {
        this.state.startedAt = this.time.now;
        this._emit('level_start', {});

        // ── Listeners ────────────────────────────────────────────────
        this._onGateResult = this._onGateResult.bind(this);
        window.addEventListener('logicade:gate_resolved', this._onGateResult);

        // Pause uses ONLY a state flag. Phaser 4's scene.pause() and
        // TimerEvent.paused have both caused freezes when combined, so
        // we avoid them entirely. update() and the timer callback both
        // check the flag.
        this._pauseHandler = () => {
            if (!this.state.gameOver && !this.state.paused) {
                this.state.paused = true;
                window.dispatchEvent(new Event('logicade:game_paused'));
            }
        };
        window.addEventListener('logicade:pause_game', this._pauseHandler);

        this._resumeHandler = () => {
            this.state.paused = false;
        };
        window.addEventListener('logicade:resume_game', this._resumeHandler);

        // Hint display triggered from React (when the confirm modal is accepted)
        this._onShowHint = (event) => {
            const existing = this.children.getByName('hintText');
            if (existing) existing.destroy();

            this.add.text(
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
                }
            ).setOrigin(0.5, 0).setDepth(150).setName('hintText');

            this.time.delayedCall(6000, () => {
                const t = this.children.getByName('hintText');
                if (t) t.destroy();
            });
        };
        window.addEventListener('logicade:show_hint', this._onShowHint);

        // ── Audio unlock ─────────────────────────────────────────────
        const unlockAudio = () => {
            const ctx = this.sound.context;
            if (ctx.state === 'suspended') ctx.resume();
        };
        this.input.on('pointerdown', unlockAudio);
        this.input.keyboard.on('keydown', unlockAudio);

        const soundKeys = ['sfx_collect', 'sfx_destroy', 'sfx_win', 'sfx_lose', 'sfx_click', 'sfx_error'];
        for (const key of soundKeys) {
            if (this.cache.audio.exists(key) && !this.sound.get(key)) {
                this.sound.add(key, { volume: 0.4 });
            }
        }

        // ── Build the scene ──────────────────────────────────────────
        this._buildLayout();
        this._buildMap();
        this._buildEntities();
        this._buildInput();
        this._buildHUD();

        // ── Level timer ──────────────────────────────────────────────
        // Timer increments only when not paused and not game over.
        this._timerEvent = this.time.addEvent({
            delay: 100,
            loop: true,
            callback: () => {
                if (!this.state.paused && !this.state.gameOver) {
                    this.state.timer += 0.1;
                }
            },
        });

        this.cameras.main.setBackgroundColor('#1a1a2e');

        // ── Cleanup ──────────────────────────────────────────────────
        this.events.once('shutdown', () => {
            window.removeEventListener('logicade:gate_resolved', this._onGateResult);
            window.removeEventListener('logicade:pause_game', this._pauseHandler);
            window.removeEventListener('logicade:resume_game', this._resumeHandler);
            window.removeEventListener('logicade:show_hint', this._onShowHint);
        });
    }

    update(time, delta) {
        if (this.state.gameOver) return;
        if (this.state.paused) return;
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
        const { displaySize } = this.layout;
        for (let r = 0; r < this.gridRows; r++) {
            for (let c = 0; c < this.gridCols; c++) {
                const { x, y } = SpecRenderer.cellCenter(this.layout, c, r);
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

            const { x, y } = SpecRenderer.cellCenter(this.layout, col, row);
            const sprite = this.physics.add.sprite(x, y, ent.sprite);
            const size = this.layout.displaySize * 0.8;
            sprite.setDisplaySize(size, size);
            sprite.setData('entityId', ent.id);
            sprite.setData('role', ent.role);
            sprite.setDepth(10);
            sprite.body.setSize(size, size);

            if (ent.role === 'player') {
                this.tweens.add({
                    targets: sprite,
                    scaleX: sprite.scaleX * 1.05,
                    scaleY: sprite.scaleY * 1.05,
                    duration: 800,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
            } else if (ent.role === 'collectible' || ent.role === 'powerup') {
                this.tweens.add({
                    targets: sprite,
                    angle: 360,
                    duration: 3000,
                    repeat: -1,
                    ease: 'Linear',
                });
            } else if (ent.role === 'hazard') {
                this.tweens.add({
                    targets: sprite,
                    scaleX: sprite.scaleX * 1.1,
                    scaleY: sprite.scaleY * 1.1,
                    duration: 500,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
            } else if (ent.role === 'gate') {
                this.tweens.add({
                    targets: sprite,
                    alpha: 0.5,
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                });
            }

            this.state.entities[ent.id] = sprite;
            if (ent.role === 'player') this.player = sprite;
        }
    }

    _randomFreeCell(used, role) {
        const playerRow = Math.floor(this.gridRows / 2);
        for (let i = 0; i < 200; i++) {
            const col = Phaser.Math.Between(0, this.gridCols - 1);
            const row = Phaser.Math.Between(0, this.gridRows - 1);
            if ((role === 'hazard' || role === 'obstacle') &&
                col <= 2 && Math.abs(row - playerRow) <= 1) continue;
            if (!used.has(`${col},${row}`)) return { col, row };
        }
        return { col: this.gridCols - 1, row: this.gridRows - 1 };
    }

    _buildInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: 'W', down: 'S', left: 'A', right: 'D',
        });
        this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,W,A,S,D');
        // Only ESC for pause. No H (hint is HTML button), no R (restart is
        // in the pause modal).
        this.input.keyboard.on('keydown-ESC', () => this._pauseHandler());
    }

    _buildHUD() {
        const style = { fontSize: '18px', color: '#ffffff', fontFamily: 'monospace' };
        this.add.text(12, 12, 'Score: 0', style).setDepth(100).setName('hudScore');
        this.add.text(12, 36, 'Time: 0.0', style).setDepth(100).setName('hudTimer');

        // Human-readable goal — never shows the raw spec.win string.
        const win = String(this.spec.win || '');
        let goalText = 'Complete the level';
        let m;
        if ((m = win.match(/^score\s*(>=|==|>)\s*(\d+)/))) {
            goalText = `Collect ${m[2]} items`;
        } else if ((m = win.match(/^timer\s*(>=|>)\s*(\d+)/))) {
            goalText = `Survive ${m[2]} seconds`;
        } else if ((m = win.match(/^count\s*(>=|==|>)\s*(\d+)/))) {
            goalText = `Destroy ${m[2]} objects`;
        }
        this.add.text(12, 60, `🎯 ${goalText}`, {
            fontSize: '16px',
            color: '#ffca28',
            fontFamily: 'monospace',
            backgroundColor: '#00000088',
            padding: { x: 8, y: 4 },
        }).setDepth(100).setName('hudGoal');

        this.add.text(12, this.scale.height - 24, 'ESC = pause',
            { ...style, fontSize: '14px', color: '#9ca3af' }).setDepth(100);
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
                    for (const effect of rule.then) this._applyEffect(effect, i);
                }
            }
            this.state.lastTriggered[i] = triggered;
        }
    }

    _evaluateTrigger(onStr) {
        const parsed = this._parseOn(onStr);
        if (!parsed) return false;
        const { trigger, args } = parsed;

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

        // score += n  /  score -= n
        let m = s.match(/^score\s*([+\-]=)\s*(\d+)$/);
        if (m) {
            const delta = m[1] === '+=' ? parseFloat(m[2]) : -parseFloat(m[2]);
            this.state.score += delta;
            this._playSfx(delta > 0 ? 'sfx_collect' : 'sfx_error');
            this._emit('rule_triggered', {
                rule_id: `r${ruleIndex}`,
                payload: { effect: s, new_score: this.state.score },
            });
            return;
        }

        // destroy(target_id)
        m = s.match(/^destroy\((\w+)\)$/);
        if (m) {
            const target = this.state.entities[m[1]];
            if (target && target.active) {
                this._burst(target.x, target.y, 0xfde047);
                target.destroy();
                this.state.destroyed.add(m[1]);
                this.state.count += 1;
                this._playSfx('sfx_destroy');
                this._emit('collision', {
                    entity_id: m[1],
                    rule_id: `r${ruleIndex}`,
                    payload: { effect: s },
                });
            }
            return;
        }

        // spawn(sprite_id)
        m = s.match(/^spawn\((\w+)\)$/);
        if (m) {
            const spriteId = m[1];
            const x = Phaser.Math.Between(
                this.layout.offsetX,
                this.layout.offsetX + this.gridCols * this.layout.displaySize,
            );
            const y = this.layout.offsetY - 50;
            const hazard = this.physics.add.sprite(
                x, y, spriteId === 'hazard' ? 'spike' : spriteId
            );
            hazard.setDisplaySize(
                this.layout.displaySize * 0.8,
                this.layout.displaySize * 0.8,
            );
            hazard.setData('role', 'hazard');
            hazard.body.setVelocityY(150);
            this.state.entities[`spawned_${Date.now()}`] = hazard;
            return;
        }

        // open_code_gate
        if (s === 'open_code_gate') {
            this._triggerCodeGate(ruleIndex);
            return;
        }

        // reset — ends the level
        if (s === 'reset') {
            this._finish(false, 'reset_triggered');
        }
    }

    // ── Code Gate (C-programming modal) ──────────────────────────────

    _triggerCodeGate(ruleIndex) {
        this.state.paused = true;
        const questions = [
            {
                q: 'if (score ___ 5) // to pass when score is exactly 5',
                opts: ['if (score > 5)', 'if (score >= 5)', 'if (score == 5)', 'if (score != 5)'],
                correct: 1,
            },
            {
                q: 'if (lives ___ 0) // to trigger game over',
                opts: ['if (lives < 0)', 'if (lives == 0)', 'if (lives <= 0)', 'if (lives != 0)'],
                correct: 2,
            },
        ];
        const data = questions[Math.floor(Math.random() * questions.length)];
        window.dispatchEvent(new CustomEvent('logicade:gate_opened', {
            detail: { question: data.q, options: data.opts, correct: data.correct },
        }));
    }

    _onGateResult(event) {
        this.state.paused = false;
        if (event.detail.correct) {
            this._playSfx('sfx_win');
            this.state.score += 5;
            this._emit('rule_triggered', {
                payload: { effect: 'gate_opened', new_score: this.state.score },
            });
            for (const [id, ent] of Object.entries(this.state.entities)) {
                if (ent.getData('role') === 'gate' && ent.active) {
                    this._burst(ent.x, ent.y, 0x00ffff);
                    ent.destroy();
                }
            }
        } else {
            this._playSfx('sfx_error');
            this.state.score = Math.max(0, this.state.score - 1);
        }
    }

    // ── Audio & effects ──────────────────────────────────────────────

    _playSfx(key) {
        if (!this.cache.audio.exists(key)) return;
        const ctx = this.sound.context;
        if (ctx.state === 'suspended') { ctx.resume(); return; }
        try { this.sound.play(key); } catch (e) { /* ignored */ }
    }

    _burst(x, y, color) {
        const emitter = this.add.particles(x, y, 'gem', {
            speed: { min: 80, max: 200 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.4, end: 0 },
            lifespan: 500,
            quantity: 10,
            blendMode: 'ADD',
            tint: color,
        });
        this.time.delayedCall(600, () => emitter.destroy());
    }

    // ── Win / lose ───────────────────────────────────────────────────

    _checkWin() {
        if (this.state.gameOver) return;
        const m = String(this.spec.win).match(
            /^(score|timer|count)\s*(==|>=|<=|>|<|!=)\s*(-?\d+(?:\.\d+)?)$/,
        );
        if (!m) return;
        const [, name, op, num] = m;
        if (this._compare(this.state[name], op, parseFloat(num))) {
            this._finish(true, 'win_condition');
        }
    }

    _checkHazardCollision() {
        if (this.state.gameOver || !this.player) return;
        for (const [, ent] of Object.entries(this.state.entities)) {
            if (!ent.active || ent.getData('role') !== 'hazard') continue;
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
        this.state.paused = true;

        try {
            this._emit(won ? 'level_win' : 'level_lose', { payload: { reason } });
        } catch (e) {
            console.error('[finish] telemetry error:', e);
        }

        this._playSfx(won ? 'sfx_win' : 'sfx_lose');
        if (this.player.body) this.player.body.setVelocity(0);

        const maxScore = Math.max(1, this.spec.rules.length);
        const safeScore = Math.max(0, Math.min(1, this.state.score / maxScore));

        const payload = {
            won,
            time: this.state.timer,
            score: safeScore,
        };
        console.log('[finish] dispatching game_over:', payload);
        window.dispatchEvent(new CustomEvent('logicade:game_over', { detail: payload }));

        // Big win/lose text in Phaser, visible behind the React modal.
        this.add.text(
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
        ).setOrigin(0.5).setDepth(200);

        // Save to IndexedDB in the background — never blocks the modal.
        (async () => {
            try {
                const levelId = this.registry.get('level_id');
                const studentId = this.registry.get('student_id');
                const week = this.registry.get('week');

                if (window.LogiCadeWrite && window.LogiCadeWrite.ensureStudent) {
                    await window.LogiCadeWrite.ensureStudent(studentId);
                }
                const db = await window.LogiCadeDB.openDB();

                const existingLevel = await new Promise((res, rej) => {
                    const tx = db.transaction('levels', 'readonly');
                    const req = tx.objectStore('levels').get(levelId);
                    req.onsuccess = () => res(req.result);
                    req.onerror = () => rej(req.error);
                });

                if (!existingLevel) {
                    const allLevels = await new Promise((res, rej) => {
                        const tx = db.transaction('levels', 'readonly');
                        const req = tx.objectStore('levels').getAll();
                        req.onsuccess = () => res(req.result);
                        req.onerror = () => rej(req.error);
                    });
                    const studentWeekLevels = allLevels.filter(
                        l => l.student_id === studentId && l.week === week,
                    );

                    const levelRow = {
                        level_id: levelId,
                        student_id: studentId,
                        week: week,
                        level_index: studentWeekLevels.length,
                        difficulty_assigned: this.registry.get('difficulty'),
                        difficulty_served: this.registry.get('difficulty'),
                        game_type: this.spec.game_type,
                        map_id: this.spec.map,
                        sprite_ids: this.spec.entities.map(e => e.sprite),
                        fingerprint: this.spec.fingerprint,
                        verification_result: 'pass',
                        pool_status: 'served',
                        generated_at: new Date().toISOString(),
                    };

                    await new Promise((res, rej) => {
                        const tx = db.transaction(['levels', 'sync_queue'], 'readwrite');
                        tx.objectStore('levels').put(levelRow);
                        tx.objectStore('sync_queue').put({
                            job_id: crypto.randomUUID(),
                            created_at: new Date().toISOString(),
                            table: 'levels',
                            op: 'upsert',
                            payload: levelRow,
                            status: 'pending',
                            attempts: 0,
                        });
                        tx.oncomplete = res;
                        tx.onerror = () => rej(tx.error);
                    });
                }

                const attempt = {
                    attempt_id: crypto.randomUUID(),
                    level_id: levelId,
                    student_id: studentId,
                    attempt_number: 1,
                    is_replay: false,
                    score: safeScore,
                    accuracy: safeScore,
                    in_activity_attempts: 1,
                    error_count: this.state.errorCount,
                    completion_time_sec: this.state.timer,
                    hint_count: this.state.hintCount,
                    activity_retries: 0,
                    completed: won,
                    started_at: new Date(
                        Date.now() - this.state.timer * 1000
                    ).toISOString(),
                    ended_at: new Date().toISOString(),
                    week: week,
                    level_index: 0,
                };

                await window.LogiCadeWrite.recordAttempt(attempt);
                await window.LogiCadeSync.drainQueue();
            } catch (err) {
                console.error('Failed to save attempt in background:', err);
            }
        })();
    }

    // ── HUD ──────────────────────────────────────────────────────────

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