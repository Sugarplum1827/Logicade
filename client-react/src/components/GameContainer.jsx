import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { BootScene } from '../game/BootScene';
import { GameScene } from '../game/GameScene';
import { MissionScene } from '../game/MissionScene';

import '../game/SpecRenderer';

let spriteRegistryPromise;

function loadSpriteRegistry() {
  if (!spriteRegistryPromise) {
    spriteRegistryPromise = fetch('/data/registry.json', { cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`Sprite registry request failed (${res.status})`);
        return res.json();
      })
      .catch((error) => {
        spriteRegistryPromise = null;
        throw error;
      });
  }
  return spriteRegistryPromise;
}

export default function GameContainer({
  studentId,
  region,
  level,
  levelId,
  preloadedSpec,
  preloadedMeta,
  pauseForTutorial,
  onSpecLoaded,
}) {
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

        window.LogiCadeSync?.init();
        const manifest = await loadSpriteRegistry();

        const spec = preloadedSpec;
        let meta =
          preloadedMeta || { verification_result: 'pass', model_tag: 'preloaded' };
        if (!spec) throw new Error('No game JSON was selected. Return to level select and choose a level again.');

        if (!isMounted) return;

        onSpecLoaded?.(spec, meta);

        const config = {
          type: Phaser.AUTO,
          parent: gameRef.current,
          width: 800,
          height: 600,
          backgroundColor: '#050510',
          physics: {
            default: 'arcade',
            arcade: { gravity: { y: 0 }, debug: false },
          },
          scene: [BootScene, GameScene, MissionScene],
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          callbacks: {
            preBoot: (g) => {
              g.registry.set('student_id', studentId);
              g.registry.set('level_id', levelId);
              g.registry.set('week', region?.week || 1);
              g.registry.set('level_num', level);
              g.registry.set('difficulty', spec?.difficulty || 'standard');
              g.registry.set('student', studentId);
              g.registry.set('manifest', manifest);
              g.registry.set('spec', spec);
              g.registry.set('meta', meta);
              g.registry.set('pause_for_tutorial', pauseForTutorial);
            },
          },
        };

        game = new Phaser.Game(config);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to start game:', err);
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
  }, [studentId, region, level, levelId, preloadedSpec, preloadedMeta, onSpecLoaded]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100dvh',
        minHeight: '100svh',
        background: '#000',
      }}
    >
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontFamily: 'monospace',
            zIndex: 10,
          }}
        >
          <h2>Summoning Level {level}…</h2>
          <p style={{ color: '#9ca3af' }}>Generating adaptive challenge…</p>
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f87171',
            fontFamily: 'monospace',
            zIndex: 10,
          }}
        >
          <h2>Error: {error}</h2>
        </div>
      )}

      <div ref={gameRef} className="game-container" />
    </div>
  );
}
