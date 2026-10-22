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

async function resolveDifficulty(studentId, week, level) {
  if (level <= 1) return 'standard';
  try {
    const db = await window.LogiCadeDB.openDB();
    const summaries = await new Promise((res, rej) => {
      const tx = db.transaction('level_summary', 'readonly');
      const req = tx.objectStore('level_summary').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
    const forWeek = summaries.filter(
      (s) => s.student_id === studentId && s.week === week,
    );
    if (forWeek.length === 0) return 'standard';
    forWeek.sort((a, b) => (b.level_index ?? 0) - (a.level_index ?? 0));
    const last = forWeek[0];
    const next = window.LogiCadeDifficulty.nextDifficulty(
      last.first_attempt_accuracy ?? 0.7,
      last.repeats_this_level ?? 0,
      last.total_errors ?? 0,
    );
    console.log(
      `[GameContainer] difficulty=${next} (acc=${last.first_attempt_accuracy}, repeats=${last.repeats_this_level})`,
    );
    return next;
  } catch (err) {
    console.warn('[GameContainer] difficulty lookup failed:', err);
    return 'standard';
  }
}

export default function GameContainer({
  studentId,
  region,
  level,
  levelId,
  preloadedSpec,
  preloadedMeta,
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

        let spec = preloadedSpec;
        let meta =
          preloadedMeta || { verification_result: 'pass', model_tag: 'preloaded' };

        if (!spec) {
          const week = region?.week || 1;
          const difficulty = await resolveDifficulty(studentId, week, level);
          console.log(
            `[GameContainer] Fetching week=${week} level=${level} difficulty=${difficulty} from /serve…`,
          );
          const specRes = await fetch('/serve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student_id: studentId,
              week,
              level,
              difficulty,
            }),
          });
          if (!specRes.ok) throw new Error(`/serve ${specRes.status}`);
          const data = await specRes.json();
          spec = data.spec;
          meta = data.meta;
        }

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
