import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { BootScene } from '../game/BootScene';
import { GameScene } from '../game/GameScene';
import { LevelCompleteScene } from '../game/LevelCompleteScene';

import '../game/telemetry';
import '../game/SpecRenderer';
import '../game/db/local';
import '../game/db/write';
import '../game/db/rollups';
import '../game/engine/difficulty';
import '../game/sync/worker';

export default function GameContainer({ studentId, region, level, preloadedSpec }) {
  const gameRef = useRef(null);

  useEffect(() => {
    let game = null;
    let isMounted = true;

    async function startGame() {
      try {
        const manifestRes = await fetch('/data/registry.json');
        const manifest = await manifestRes.json();

        let spec = preloadedSpec;
        let meta = { verification_result: 'pass', model_tag: 'preloaded' };

        // If no spec was passed, fetch it (Fallback)
        if (!spec) {
          const week = region?.week || 1;
          let difficulty = 'needs_support';
          if (level > 3) difficulty = 'standard';
          if (level > 7) difficulty = 'advanced';

          const specRes = await fetch('/serve', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ student_id: studentId, week: week, difficulty: difficulty })
          });
          const data = await specRes.json();
          spec = data.spec;
          meta = data.meta;
        }

        // ── LOG AFTER META IS DEFINED ──
        console.log('[game] Spec loaded:', {
          week: spec?.week,
          difficulty: spec?.difficulty,
          win: spec?.win,
          rules: spec?.rules?.length,
          entities: spec?.entities?.length,
          verification_result: meta?.verification_result,
          model_tag: meta?.model_tag,
        });

        if (!isMounted) return;

        const config = {
          type: Phaser.AUTO,
          parent: gameRef.current,
          width: 800, height: 600, backgroundColor: '#050510',
          physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
          scene: [BootScene, GameScene, LevelCompleteScene],
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
          callbacks: {
            preBoot: (g) => {
              g.registry.set('student_id', studentId);
              g.registry.set('level_id', crypto.randomUUID());
              g.registry.set('week', region?.week || 1);
              g.registry.set('difficulty', spec?.difficulty || 'standard');
              g.registry.set('student', studentId);
              g.registry.set('manifest', manifest);
              g.registry.set('spec', spec);
              g.registry.set('meta', meta);
              g.registry.set('level_num', level);
            }
          }
        };

        game = new Phaser.Game(config);
      } catch (err) {
        console.error("Failed to start game:", err);
      }
    }

    startGame();

    return () => {
      isMounted = false;
      if (game) game.destroy(true);
    };
  }, [studentId, region, level, preloadedSpec]);

  return <div ref={gameRef} className="game-container" />;
}