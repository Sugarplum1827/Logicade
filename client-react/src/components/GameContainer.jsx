import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { BootScene } from '../game/BootScene';
import { GameScene } from '../game/GameScene';
import { MissionScene } from '../game/MissionScene';
import { LogicadeTemplateScene } from '../game/templates/TemplateScene';
import { createTemplateRuntime, loadTemplateData } from '../game/templates/runtime';

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
  gameSessionId = 0,
  templateAssetBase = null,
  preloadedSpec,
  preloadedMeta,
  pauseForTutorial,
  onSpecLoaded,
}) {
  const gameRef = useRef(null);
  // Capture the first-run tutorial gate for this keyed game instance. When the
  // learner closes the tutorial, the scene resumes without rebuilding Phaser.
  const [tutorialPauseForRun] = useState(() => Boolean(pauseForTutorial));
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

        const sourceSpec = preloadedSpec;
        const sourceMeta =
          preloadedMeta || { verification_result: 'pass', model_tag: 'preloaded' };
        if (!sourceSpec) throw new Error('No game JSON was selected. Return to level select and choose a level again.');

        const week = Number(sourceSpec.week ?? sourceSpec.week_number ?? region?.week ?? 1);
        const difficulty = sourceMeta.difficulty_served || sourceMeta.difficulty || sourceSpec.difficulty || 'standard';
        let runtime = null;
        try {
          const [templateCatalog, templateAssets] = await loadTemplateData();
          runtime = createTemplateRuntime({
            catalog: templateCatalog,
            manifest: templateAssets,
            spec: sourceSpec,
            meta: sourceMeta,
            studentId,
            levelId,
            week,
            level,
            difficulty,
            runId: gameSessionId,
            assetBase: templateAssetBase,
          });
        } catch (templateError) {
          console.warn('[template] falling back to the existing Phaser JSON renderer:', templateError);
        }
        const spec = runtime?.spec || sourceSpec;
        const meta = runtime?.meta || sourceMeta;

        if (!isMounted) return;

        // Keep the learner page's source description stable. The runtime-only
        // template selection is recorded with the attempt and must not remount
        // this Phaser instance by changing the component input.
        onSpecLoaded?.(sourceSpec, sourceMeta);

        const config = {
          type: Phaser.AUTO,
          parent: gameRef.current,
          width: 14 * 64,
          height: 9 * 64 + 224,
          backgroundColor: '#050510',
          physics: {
            default: 'arcade',
            arcade: { gravity: { y: 0 }, debug: false },
          },
          scene: [BootScene, GameScene, MissionScene, LogicadeTemplateScene],
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
              g.registry.set('difficulty', difficulty);
              g.registry.set('student', studentId);
              g.registry.set('manifest', manifest);
              g.registry.set('spec', spec);
              g.registry.set('meta', meta);
              g.registry.set('pause_for_tutorial', tutorialPauseForRun);
              g.registry.set('template_runtime', runtime ? {
                ...runtime,
                studentId,
                levelId,
                week,
                level,
                difficulty,
                pauseForTutorial: tutorialPauseForRun,
              } : null);
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
  }, [studentId, region, level, levelId, gameSessionId, templateAssetBase, preloadedSpec, preloadedMeta, onSpecLoaded, tutorialPauseForRun]);

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
          <p style={{ color: '#9ca3af' }}>Loading your game template…</p>
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
