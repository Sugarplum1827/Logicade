import { useEffect, useRef, useState } from 'react';
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let game = null;
    let isMounted = true;

    async function startGame() {
      try {
        setIsLoading(true);
        setError(null);

        const manifestRes = await fetch('/data/registry.json');
        const manifest = await manifestRes.json();

        let spec = preloadedSpec;
        let meta = { verification_result: 'pass', model_tag: 'preloaded' };

        // ⭐ Fetch only happens HERE, right when the game is about to mount
        if (!spec) {
          const week = region?.week || 1;
          let difficulty = 'needs_support';
          if (level > 3) difficulty = 'standard';
          if (level > 7) difficulty = 'advanced';

          console.log(`[GameContainer] Fetching level ${level} from /serve...`);
          const specRes = await fetch('/serve', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ student_id: studentId, week: week, difficulty: difficulty })
          });
          const data = await specRes.json();
          spec = data.spec;
          meta = data.meta;
        }

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
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to start game:", err);
        if (isMounted) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    }

    startGame();

    return () => {
      isMounted = false;
      if (game) game.destroy(true);
    };
  }, [studentId, region, level, preloadedSpec]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000' }}>
      {isLoading && (
        <div style={{ 
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: '#fff',
          fontFamily: 'monospace', zIndex: 10 
        }}>
          <h2>Summoning Level {level}...</h2>
          <p style={{ color: '#9ca3af' }}>Generating adaptive challenge...</p>
        </div>
      )}
      
      {error && (
        <div style={{ 
          position: 'absolute', inset: 0, display: 'flex', 
          alignItems: 'center', justifyContent: 'center', color: '#f87171',
          fontFamily: 'monospace', zIndex: 10 
        }}>
          <h2>Error: {error}</h2>
        </div>
      )}

      <div ref={gameRef} className="game-container" />
    </div>
  );
}