// §14.2 + §14.3 + §10 — the level-complete flow.
// Builds the attempt row, does the atomic IndexedDB write, rebuilds local
// rollups, computes the next difficulty from those rollups (§2.6 — gameplay
// never awaits the network), and lets the player continue.

class LevelCompleteScene extends Phaser.Scene {
    constructor() {
        super({key: 'LevelCompleteScene'});
    }

    async create() {
        const lastAttempt = this.registry.get('lastAttempt');
        const studentId = this.registry.get('student') || 'demo-student';
        const week = this.registry.get('week');
        const difficulty = this.registry.get('difficulty');
        const levelId = this.registry.get('level_id');
        const spec = this.registry.get('spec');
        const meta = this.registry.get('meta') || {};

        const won = !!lastAttempt.won;
        const title = won ? 'Level Complete' : (lastAttempt.reason === 'restart' ? 'Level Restarted' : 'Game Over');

        this.add.text(this.scale.width / 2, 60, title, {
            fontSize: '36px',
            color: won ? '#4ade80' : '#f87171',
            fontFamily: 'monospace',
        }).setOrigin(0.5, 0);

        this.add.text(this.scale.width / 2, 130,
            `Score: ${Math.round((lastAttempt.score || 0) * 100)}%\n` +
            `Time: ${(lastAttempt.completion_time_sec || 0).toFixed(1)}s\n` +
            `Hints: ${lastAttempt.hint_count}`,
            {fontSize: '20px', color: '#ffffff', fontFamily: 'monospace', align: 'center'})
            .setOrigin(0.5, 0);

        const statusText = this.add.text(this.scale.width / 2, 240, 'saving…', {
            fontSize: '14px', color: '#9ca3af', fontFamily: 'monospace',
        }).setOrigin(0.5, 0);

        try {
            const db = await LogiCadeDB.openDB();
            
            // Ensure student row exists in IndexedDB and queue
            await LogiCadeWrite.ensureStudent(studentId);

            // Determine attempt_number from existing summary
            const existingSummary = await new Promise((resolve, reject) => {
                const tx = db.transaction('level_summary', 'readonly');
                const req = tx.objectStore('level_summary').get(levelId);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            const attemptNumber = (existingSummary?.total_attempts || 0) + 1;
            const isReplay = attemptNumber > 1;

            // Ensure the level row is present and queued for sync
            const existingLevel = await new Promise((resolve, reject) => {
                const tx = db.transaction('levels', 'readonly');
                const req = tx.objectStore('levels').get(levelId);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });

            if (!existingLevel) {
                // Calculate next level_index
                const allLevels = await new Promise((resolve, reject) => {
                    const tx = db.transaction('levels', 'readonly');
                    const req = tx.objectStore('levels').getAll();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
                const studentWeekLevels = allLevels.filter(
                    l => l.student_id === studentId && l.week === week
                );
                const nextLevelIndex = studentWeekLevels.length;

                const levelRow = {
                    level_id: levelId,
                    student_id: studentId,
                    week,
                    level_index: nextLevelIndex,
                    difficulty_assigned: difficulty,
                    difficulty_served: difficulty,
                    game_type: spec.game_type,
                    map_id: spec.map,
                    sprite_ids: spec.entities.map(e => e.sprite),
                    fingerprint: spec.fingerprint,
                    verification_result: meta.verification_result || 'unknown',
                    pool_status: meta.pool_status || 'served',
                    generated_at: new Date().toISOString(),
                };

                // Atomically save level and its queue job
                await new Promise((resolve, reject) => {
                    const tx = db.transaction(['levels', 'sync_queue'], 'readwrite');
                    tx.objectStore('levels').put(levelRow);
                    
                    const job = {
                        job_id: crypto.randomUUID(),
                        created_at: new Date().toISOString(),
                        table: 'levels',
                        op: 'upsert',
                        payload: levelRow,
                        status: 'pending',
                        attempts: 0,
                        last_error: null,
                        next_retry_at: null,
                    };
                    tx.objectStore('sync_queue').put(job);
                    tx.oncomplete = resolve;
                    tx.onerror = () => reject(tx.error);
                });
            }

            const endedAt = new Date();
            const startedAt = new Date(endedAt.getTime() - (lastAttempt.completion_time_sec || 0) * 1000);
            const attempt = {
                attempt_id: crypto.randomUUID(),
                level_id: levelId,
                student_id: studentId,
                attempt_number: attemptNumber,
                is_replay: isReplay,
                score: lastAttempt.score ?? 0,
                accuracy: lastAttempt.accuracy ?? 0,
                in_activity_attempts: 1,
                error_count: lastAttempt.error_count ?? 0,
                completion_time_sec: lastAttempt.completion_time_sec ?? 0,
                hint_count: lastAttempt.hint_count ?? 0,
                activity_retries: 0,
                completed: won,
                started_at: startedAt.toISOString(),
                ended_at: endedAt.toISOString(),
                week,
                level_index: 0,
            };

            // Atomic write + local rollup rebuild (§14.2, §14.3)
            await LogiCadeWrite.recordAttempt(attempt);
            statusText.setText('saved to device');

            // Local-only difficulty decision (§2.6)
            const summary = await new Promise((resolve, reject) => {
                const tx = db.transaction('level_summary', 'readonly');
                const req = tx.objectStore('level_summary').get(levelId);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });

            let nextDiff = difficulty;
            if (summary) {
                nextDiff = LogiCadeDifficulty.nextDifficulty(
                    summary.first_attempt_accuracy ?? 0,
                    summary.repeats_this_level ?? 0,
                    summary.total_errors ?? 0,
                );
            }
            statusText.setText(`saved • next difficulty: ${nextDiff}`);
            this.registry.set('next_difficulty', nextDiff);

            // Sync (respects syncTriggerMode)
            if (LogiCadeSync.syncTriggerMode === 'level_end') {
                await LogiCadeSync.drainQueue();
                statusText.setText(`saved • synced • next difficulty: ${nextDiff}`);
            } else {
                LogiCadeSync.drainQueue().catch(() => {});
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[LevelComplete] persist failed', err);
            statusText.setText(`save error: ${err.message}`);
            statusText.setColor('#f87171');
        }

        // Continue button
        const buttonText = won ? 'Next Level' : 'Retry Level';
        const btn = this.add.text(this.scale.width / 2, this.scale.height - 80,
            buttonText, {
                fontSize: '24px', color: '#000000',
                backgroundColor: '#4ade80',
                padding: {x: 24, y: 12},
                fontFamily: 'monospace',
            }).setOrigin(0.5).setInteractive({useHandCursor: true});

        btn.on('pointerover', () => btn.setStyle({backgroundColor: '#86efac'}));
        btn.on('pointerout', () => btn.setStyle({backgroundColor: '#4ade80'}));
        btn.on('pointerdown', () => this._startNextLevel(won));
    }

    async _startNextLevel(won) {
        const levelId = this.registry.get('level_id');
        const studentId = this.registry.get('student') || 'demo-student';
        const week = this.registry.get('week');
        const nextDiff = this.registry.get('next_difficulty')
            || this.registry.get('difficulty');

        const nextLevelId = won ? crypto.randomUUID() : levelId;
        this.registry.set('level_id', nextLevelId);
        this.registry.set('difficulty', nextDiff);

        try {
            const r = await fetch('/serve', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    student_id: studentId,
                    week,
                    difficulty: nextDiff,
                }),
            });
            if (!r.ok) throw new Error(`/serve ${r.status}`);
            const j = await r.json();
            this.registry.set('spec', j.spec);
            this.registry.set('meta', j.meta);

            const manifest = this.registry.get('manifest');
            this.scene.start('GameScene', {spec: j.spec, manifest});
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[LevelComplete] next-level fetch failed', err);
            const t = this.add.text(this.scale.width / 2, 340,
                `error: ${err.message}`, {
                    fontSize: '16px', color: '#f87171', fontFamily: 'monospace',
                }).setOrigin(0.5, 0);
            this.time.delayedCall(3000, () => t.destroy());
        }
    }
}