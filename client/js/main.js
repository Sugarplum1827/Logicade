// Phase 4 entry point (§11).
// URL params:
//   ?spec=fallback&week=3&difficulty=standard   (default)
//   ?spec=inline                                 (embedded example)
//   ?spec=server&student=stu-001&week=3&difficulty=standard  (POST /serve)
//
// `?week` and `?difficulty` are always read; `spec=server` additionally
// uses them to request a level from the pool worker.

(async function bootstrap() {
    const params = new URLSearchParams(location.search);
    const mode = params.get('spec') || 'fallback';
    const week = parseInt(params.get('week') || '3', 10);
    const difficulty = params.get('difficulty') || 'standard';
    const student = params.get('student') || 'demo-student';

    const loadingEl = document.getElementById('loading');

    try {
        const {spec, meta, source} = await loadSpec({mode, week, difficulty, student});

        if (!spec) throw new Error('no spec returned');

        // Validate shape minimally — full validation is server-side (§9)
        if (!spec.entities || !spec.rules || !spec.map) {
            throw new Error('spec missing required fields');
        }

        const config = {
            type: Phaser.AUTO,
            parent: 'game',
            width: 800,
            height: 600,
            backgroundColor: '#1a1a2e',
            physics: {
                default: 'arcade',
                arcade: {gravity: {y: 0}, debug: false},
            },
            scene: [BootScene, GameScene, LevelCompleteScene],
            callbacks: {
                preBoot: (game) => {
                    game.registry.set('spec', spec);
                    game.registry.set('meta', meta);
                    game.registry.set('source', source);
                    game.registry.set('week', week);
                    game.registry.set('difficulty', difficulty);
                    game.registry.set('student', student);
                    game.registry.set('level_id', crypto.randomUUID());
                },
            },
        };

        if (loadingEl) loadingEl.style.display = 'none';
        new Phaser.Game(config);
    } catch (err) {
        if (loadingEl) {
            loadingEl.textContent = `error: ${err.message}`;
        } else {
            document.body.innerHTML = `<div style="color:#f87171;font-family:monospace;padding:20px;">Fatal error: ${err.message}</div>`;
        }
        // eslint-disable-next-line no-console
        console.error('[main] bootstrap failed', err);
    }
})();

async function loadSpec({mode, week, difficulty, student}) {
    if (mode === 'inline') {
        return {spec: INLINE_SPEC, meta: {verification_result: 'inline'}, source: 'inline'};
    }
    if (mode === 'server') {
        const r = await fetch('/serve', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ student_id: student, week, difficulty }),
        });
        if (!r.ok) throw new Error(`/serve ${r.status}`);
        const j = await r.json();
        return {spec: j.spec, meta: j.meta, source: 'server'};
    }
    
    // Load from the 30 game pool (game_00.json to game_29.json)
    const gameIdx = Math.floor(Math.random() * 30);
    const url = `/data/fallback_pool/game_${String(gameIdx).padStart(2, '0')}.json`;
    
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fetch ${url} → ${r.status}`);
    const spec = await r.json();
    return {spec, meta: {verification_result: 'fallback', source: url}, source: 'fallback'};
}

// Minimal valid example so the client runs even if /data isn't mounted.
const INLINE_SPEC = {
    week: 1,
    concept: 'orientation_vmgo_computing_basics',
    ilo: 'CP1-W1-ILO1',
    difficulty: 'standard',
    game_type: 'collect',
    fingerprint: '00000000',
    entities: [
        {id: 'player', sprite: 'player_knight', role: 'player'},
        {id: 'coin0', sprite: 'coin', role: 'collectible'},
        {id: 'coin1', sprite: 'coin', role: 'collectible'},
        {id: 'coin2', sprite: 'coin', role: 'collectible'},
    ],
    map: 'grid_12x9_forest',
    rules: [
        {on: 'collision(player,coin0)', if: 'always', then: ['score += 1', 'destroy(coin0)']},
        {on: 'collision(player,coin1)', if: 'always', then: ['score += 1', 'destroy(coin1)']},
        {on: 'collision(player,coin2)', if: 'always', then: ['score += 1', 'destroy(coin2)']},
    ],
    win: 'score == 3',
    hint: 'Walk into each coin to collect it.',
    tutor_note: 'Each collision adds 1 to your score.',
};

// Wire the sync worker once at app startup.
LogiCadeSync.init();