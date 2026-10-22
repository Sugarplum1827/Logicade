import { useState, useEffect, useRef } from 'react';
import { lazy, Suspense } from 'react';
import { useCallback } from 'react';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import AvatarSelect from './components/AvatarSelect';
import SubjectSelect from './components/SubjectSelect';
import WorldMap from './components/WorldMap';
import LevelSelect from './components/LevelSelect';
const GameContainer = lazy(() => import('./components/GameContainer'));
import CodeGateModal from './components/CodeGateModal';
import PauseExitModal from './components/PauseExitModal';
import GameResultModal from './components/GameResultModal';
import HintConfirmModal from './components/HintConfirmModal';
import GameTutorialModal from './components/GameTutorialModal';
import { playButtonClick } from './game/audio';

const MAX_LEVEL = 10;

export default function App() {
  const [view, setView] = useState(() => {
    const savedView = localStorage.getItem('logicade_current_view');
    const user = localStorage.getItem('logicade_current_user');
    const resumableViews = ['auth', 'avatar', 'subject', 'region', 'level'];
    if (savedView === 'auth') return 'auth';
    if (user && resumableViews.includes(savedView)) {
      return savedView;
    }
    return 'landing';
  });

  const [studentId, setStudentId] = useState(
    () => localStorage.getItem('logicade_current_user') || '',
  );
  const [avatar, setAvatar] = useState(
    () => localStorage.getItem('logicade_avatar') || '/assets/ui/avatar1.png',
  );
  const [selectedRegion, setSelectedRegion] = useState(() => {
    const saved = localStorage.getItem('logicade_selected_region');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentSubject, setCurrentSubject] = useState('cp1');

  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentLevelId, setCurrentLevelId] = useState(() => crypto.randomUUID());
  const [currentSpec, setCurrentSpec] = useState(null);
  const [currentMeta, setCurrentMeta] = useState(null);
  const [gameSessionId, setGameSessionId] = useState(0);
  const [pageWipe, setPageWipe] = useState(null);
  const navigationBusy = useRef(false);
  const gameActionBusy = useRef(false);

  const [activeGate, setActiveGate] = useState(null);

  // ── Per-user wallet / progress ────────────────────────────────
  const [coins, setCoins] = useState(50);
  const [xp, setXp] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);

  const [showPauseExit, setShowPauseExit] = useState(false);
  const [tutorialPending, setTutorialPending] = useState(false);
  const [showGameTutorial, setShowGameTutorial] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const backgroundMusicRef = useRef(null);
  const [musicNeedsGesture, setMusicNeedsGesture] = useState(false);

  const startBackgroundMusic = useCallback(() => {
    const music = backgroundMusicRef.current;
    if (!music) return;
    music.muted = false;
    music.play()
      .then(() => setMusicNeedsGesture(false))
      .catch(() => setMusicNeedsGesture(true));
  }, []);

  const transitionTo = useCallback(async (nextView) => {
    if (navigationBusy.current || nextView === view) return;
    navigationBusy.current = true;
    const x = window.innerWidth / 2;
    const y = window.innerHeight / 2;
    setPageWipe({ x, y, phase: 'cover' });
    await new Promise((resolve) => window.setTimeout(resolve, 460));
    setView(nextView);
    setPageWipe({ x, y, phase: 'reveal' });
    await new Promise((resolve) => window.setTimeout(resolve, 460));
    setPageWipe(null);
    navigationBusy.current = false;
  }, [view]);

  useEffect(() => {
    const music = backgroundMusicRef.current;
    if (!music) return;
    if (view === 'game') {
      music.pause();
    } else {
      // Keep an explicit gesture fallback visible until audible playback is
      // confirmed; this also avoids a silent, nonresponsive landing screen.
      setMusicNeedsGesture(true);
      music.muted = false;
      music.play().then(() => setMusicNeedsGesture(false)).catch(() => {
        // Start playback muted where autoplay policy blocks audio. The first
        // gesture below unmutes it without restarting the track.
        music.muted = true;
        music.play()
          .then(() => setMusicNeedsGesture(true))
          .catch(() => setMusicNeedsGesture(true));
      });
      document.addEventListener('pointerdown', startBackgroundMusic, { once: true });
      document.addEventListener('keydown', startBackgroundMusic, { once: true });
      return () => {
        document.removeEventListener('pointerdown', startBackgroundMusic);
        document.removeEventListener('keydown', startBackgroundMusic);
      };
    }
  }, [view, startBackgroundMusic]);

  useEffect(() => {
    const handleButtonClick = (event) => {
      if (event.target instanceof Element && event.target.closest('button, [role="button"]')) {
        playButtonClick();
      }
    };
    document.addEventListener('click', handleButtonClick, true);
    return () => document.removeEventListener('click', handleButtonClick, true);
  }, []);

  const handleSpecLoaded = useCallback((spec, meta) => {
    setCurrentSpec(spec || null);
    setCurrentMeta(meta || null);
  }, []);

  // ── Load per-user wallet when identity changes ──────────────
  useEffect(() => {
    if (!studentId) {
      setCoins(50);
      setXp(0);
      setPlayerLevel(1);
      return;
    }
    // One-time migration from legacy global keys
    const migrate = (oldKey, newKey, defaultValue) => {
      const existing = localStorage.getItem(newKey);
      if (existing !== null) return parseInt(existing, 10);
      const legacy = localStorage.getItem(oldKey);
      if (legacy !== null) {
        localStorage.setItem(newKey, legacy);
        return parseInt(legacy, 10);
      }
      return defaultValue;
    };
    setCoins(migrate('logicade_coins', `logicade_coins_${studentId}`, 50));
    setXp(migrate('logicade_xp', `logicade_xp_${studentId}`, 0));
    setPlayerLevel(migrate('logicade_level', `logicade_level_${studentId}`, 1));

    // Per-user preference restore
    const subj = localStorage.getItem(`logicade_current_subject_${studentId}`);
    if (subj) setCurrentSubject(subj);
  }, [studentId]);

  // ── Persist per-user wallet on change ────────────────────────
  useEffect(() => {
    if (studentId) {
      localStorage.setItem(`logicade_coins_${studentId}`, String(coins));
    }
  }, [studentId, coins]);

  useEffect(() => {
    if (studentId) {
      localStorage.setItem(`logicade_xp_${studentId}`, String(xp));
    }
  }, [studentId, xp]);

  useEffect(() => {
    if (studentId) {
      localStorage.setItem(`logicade_level_${studentId}`, String(playerLevel));
    }
  }, [studentId, playerLevel]);

  useEffect(() => {
    if (studentId) {
      localStorage.setItem(`logicade_current_subject_${studentId}`, currentSubject);
    }
  }, [studentId, currentSubject]);

  // ── Navigation persistence (global; navigation state) ────────
  useEffect(() => {
    localStorage.setItem('logicade_current_view', view);
    if (studentId) localStorage.setItem('logicade_current_user', studentId);
  }, [view, studentId]);

  useEffect(() => {
    if (selectedRegion) {
      localStorage.setItem('logicade_selected_region', JSON.stringify(selectedRegion));
    }
  }, [selectedRegion]);

  // ── Window event plumbing ────────────────────────────────────
  useEffect(() => {
    const handleGate = (e) => setActiveGate(e.detail);
    const handleCoinsUpdate = (e) => setCoins(e.detail.coins);
    const handleGamePaused = () => setShowPauseExit(true);
    const handleTutorialReady = () => setShowGameTutorial(true);

    const handleGameOver = (e) => {
      const result = e.detail;
      console.log('[App] game_over received:', result);
      setShowGameTutorial(false);

      if (result.spec) setCurrentSpec(result.spec);

      let coinReward = 0;
      let xpReward = 0;
      let isFirstTime = false;

      try {
        if (result.won && selectedRegion && studentId) {
          const key = `logicade_levels_${studentId}_${selectedRegion.id}`;
          const raw = localStorage.getItem(key);
          let saved = [];
          try {
            saved = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(saved)) saved = [];
          } catch {
            saved = [];
          }

          isFirstTime = !saved.includes(currentLevel);

          if (isFirstTime) {
            coinReward = 10;
            xpReward = 50;

            saved.push(currentLevel);
            localStorage.setItem(key, JSON.stringify(saved));

            const newCoins = coins + coinReward;
            setCoins(newCoins);
            window.LogiCadeWrite?.recordCoinTransaction({
              studentId,
              amount: coinReward,
              reason: 'first_level_completion_reward',
              levelId: currentLevelId,
            }).catch((err) => console.warn('[wallet] reward queued locally but could not be recorded:', err));

            let newXp = xp + xpReward;
            let newPlayerLevel = playerLevel;
            let xpToNext = newPlayerLevel * 100;
            while (newXp >= xpToNext) {
              newXp -= xpToNext;
              newPlayerLevel += 1;
              xpToNext = newPlayerLevel * 100;
            }
            setXp(newXp);
            setPlayerLevel(newPlayerLevel);
          }
        }
      } catch (err) {
        console.error('[App] Error processing game over:', err);
      }

      setGameResult({ ...result, coinReward, xpReward, isFirstTime });
    };

    window.addEventListener('logicade:gate_opened', handleGate);
    window.addEventListener('logicade:coins_updated', handleCoinsUpdate);
    window.addEventListener('logicade:game_over', handleGameOver);
    window.addEventListener('logicade:game_paused', handleGamePaused);
    window.addEventListener('logicade:tutorial_ready', handleTutorialReady);

    return () => {
      window.removeEventListener('logicade:gate_opened', handleGate);
      window.removeEventListener('logicade:coins_updated', handleCoinsUpdate);
      window.removeEventListener('logicade:game_over', handleGameOver);
      window.removeEventListener('logicade:game_paused', handleGamePaused);
      window.removeEventListener('logicade:tutorial_ready', handleTutorialReady);
    };
  }, [selectedRegion, currentLevel, currentLevelId, studentId, coins, xp, playerLevel]);

  // ── Auth / avatar ─────────────────────────────────────────────
  const migrateLegacyProgress = (studentId) => {
    // played_regions
    if (!localStorage.getItem(`logicade_played_regions_${studentId}`)) {
      const legacy = localStorage.getItem('logicade_played_regions');
      if (legacy) {
        localStorage.setItem(`logicade_played_regions_${studentId}`, legacy);
      }
    }
    // per-region level lists
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        k.startsWith('logicade_levels_') &&
        !k.startsWith(`logicade_levels_${studentId}_`)
      ) {
        keys.push(k);
      }
    }
    for (const k of keys) {
      const regionId = k.replace('logicade_levels_', '');
      const target = `logicade_levels_${studentId}_${regionId}`;
      if (!localStorage.getItem(target)) {
        localStorage.setItem(target, localStorage.getItem(k));
      }
    }
  };

  const handleLogin = (id) => {
    setStudentId(id);
    migrateLegacyProgress(id);

    const savedAvatar = localStorage.getItem(`logicade_avatar_${id}`);
    if (savedAvatar) {
      setAvatar(savedAvatar);
      localStorage.setItem('logicade_avatar', savedAvatar);
    } else {
      localStorage.removeItem('logicade_avatar');
      setAvatar('/assets/ui/avatar1.png');
    }

    transitionTo('subject');
    // Login is not a generation action. LLM work is requested explicitly
    // through the game repeat flow so opening the app cannot start generation.
  };

  const handleNewUser = (id) => {
    setStudentId(id);
    transitionTo('avatar');
  };

  const handleAvatarSelected = (chosenAvatar) => {
    setAvatar(chosenAvatar);
    localStorage.setItem('logicade_avatar', chosenAvatar);
    if (studentId) {
      localStorage.setItem(`logicade_avatar_${studentId}`, chosenAvatar);
    }
    transitionTo('subject');
  };

  const handleLogout = () => {
    localStorage.removeItem('logicade_current_user');
    localStorage.removeItem('logicade_current_view');
    localStorage.removeItem('logicade_selected_region');
    setStudentId('');
    setSelectedRegion(null);
    transitionTo('auth');
  };

  // ── Navigation ────────────────────────────────────────────────
  const handleSelectSubject = () => transitionTo('region');

  const handleSwitchSubject = (id) => {
    if (!id || id === currentSubject) return;
    setCurrentSubject(id);
    setSelectedRegion(null);
    transitionTo('region');
  };

  const handleSelectRegion = (region) => {
    setSelectedRegion(region);
    transitionTo('level');
  };

  const handleStartLevel = (region, level, spec, meta) => {
    setCurrentLevel(level);
    setCurrentSpec(spec);
    setCurrentMeta(meta);
    setCurrentLevelId(crypto.randomUUID());
    setGameSessionId((prev) => prev + 1);
    setGameResult(null);
    setShowPauseExit(false);
    setShowGameTutorial(false);
    setTutorialPending(true);
    transitionTo('game');
  };

  const handleExitGame = () => {
    setShowPauseExit(false);
    setShowGameTutorial(false);
    setTutorialPending(false);
    setGameResult(null);
    setCurrentSpec(null);
    setCurrentMeta(null);
    transitionTo('level');
  };

  const regenerateCurrentGame = async (actionName) => {
    const fileId = currentSpec?.file_id || currentSpec?.game_id;
    if (fileId && String(currentSpec?.source_path || '').replaceAll('\\', '/').startsWith('data/fallback_pool/')) {
      try {
        const response = await fetch('/api/games/regenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: fileId, request_id: crypto.randomUUID() }),
        });
        if (!response.ok) throw new Error(`Game generation failed for ${actionName} (${response.status})`);
        const data = await response.json();
        if (data.spec) {
          setCurrentSpec(data.spec);
          setCurrentMeta(data.meta || null);
        }
      } catch (error) {
        // Keep the requested modal action usable if generation is unavailable.
        console.warn(`[game action] generation unavailable for ${actionName}; continuing with the loaded JSON:`, error);
      }
    }
  };

  const handleReplayLevel = async () => {
    await regenerateCurrentGame('Repeat');
    setShowPauseExit(false);
    setShowGameTutorial(false);
    setTutorialPending(true);
    setGameResult(null);
    setGameSessionId((prev) => prev + 1);
  };

  const handleNextLevel = () => {
    setGameResult(null);
    setCurrentSpec(null);
    setCurrentMeta(null);
    if (currentLevel >= MAX_LEVEL) {
      transitionTo('level');
      return;
    }
    setCurrentLevel((prev) => prev + 1);
    setCurrentLevelId(crypto.randomUUID());
    setGameSessionId((prev) => prev + 1);
    transitionTo('level');
  };

  const afterMarkingGameUsed = async (action) => {
    if (gameActionBusy.current) return;
    gameActionBusy.current = true;
    try {
      const fileId = currentSpec?.file_id || currentSpec?.game_id;
      if (fileId) {
        try {
          const response = await fetch('/api/games/mark-used', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: fileId }),
          });
          if (!response.ok) throw new Error(`mark-used failed (${response.status})`);
        } catch (error) {
          console.warn('[game usage] could not mark JSON as used:', error);
        }
      }
      await action();
    } finally {
      gameActionBusy.current = false;
    }
  };

  const handleUseHint = () => {
    if (coins < 1 || !currentSpec) return;
    setCoins(coins - 1);
    window.LogiCadeWrite?.recordCoinTransaction({
      studentId,
      amount: -1,
      reason: 'hint_used',
      levelId: currentLevelId,
    }).catch((err) => console.warn('[wallet] hint spend queued locally but could not be recorded:', err));
    setShowHintModal(false);
    window.dispatchEvent(
      new CustomEvent('logicade:show_hint', {
        detail: { hint: currentSpec.hint || currentSpec.player_objective || 'Review the code and objective, then try one small change.' },
      }),
    );
  };

  return (
    <div className="app-wrapper">
      <audio ref={backgroundMusicRef} src={`${import.meta.env.BASE_URL}assets/bg_song.mp3`} loop preload="auto" autoPlay playsInline />
      {view === 'landing' && <LandingPage onStart={() => {
        startBackgroundMusic();
        transitionTo('auth');
      }} />}
      {view !== 'game' && musicNeedsGesture && (
        <button
          className="music-start-prompt"
          onClick={startBackgroundMusic}
          title="Your browser requires one interaction before it allows sound to play."
          aria-label="Enable background music"
        >
          🔊 ENABLE MUSIC
        </button>
      )}
      {view === 'auth' && <AuthPage onLogin={handleLogin} onNewUser={handleNewUser} />}
      {view === 'avatar' && <AvatarSelect onSelect={handleAvatarSelected} />}
      {view === 'subject' && (
        <SubjectSelect
          studentId={studentId}
          onSelectSubject={handleSelectSubject}
          onLogout={handleLogout}
        />
      )}

      {view === 'region' && (
        <WorldMap
          studentId={studentId}
          coins={coins}
          avatar={avatar}
          playerLevel={playerLevel}
          xp={xp}
          currentSubject={currentSubject}
          onSwitchSubject={handleSwitchSubject}
          onEnterRegion={handleSelectRegion}
          onLogout={handleLogout}
        />
      )}

      {view === 'level' && selectedRegion && (
        <LevelSelect
          studentId={studentId}
          region={selectedRegion}
          onStartLevel={handleStartLevel}
          onBack={() => transitionTo('region')}
        />
      )}

      {view === 'game' && selectedRegion && (
        <div style={{ position: 'relative', width: '100vw', height: '100dvh', minHeight: '100svh' }}>
          <button
            onClick={() => window.dispatchEvent(new Event('logicade:pause_game'))}
            className="in-game-back-btn"
          >
            ← Back
          </button>

          {currentSpec?.source_path && (
            <div className="game-file-label" title={currentSpec.source_path}>
              JSON: {currentSpec.source_path.split(/[\\/]/).pop()}
            </div>
          )}

          <div className="game-hud-right">
            <div className="coin-display">
              <img src="/assets/gold_coin.png" alt="Coin" />
              <span>{coins}</span>
            </div>
            <button
              className="hint-btn"
              onClick={() => setShowHintModal(true)}
              title={currentSpec ? 'Use a hint (1 coin)' : 'Loading level data'}
              disabled={!currentSpec}
            >
              💡 Hint
            </button>
          </div>

          <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#101814', color: '#b8f2c8', zIndex: 50 }}>Preparing the game…</div>}>
            <GameContainer
              key={`${currentLevelId}-${gameSessionId}`}
              studentId={studentId}
              region={selectedRegion}
              level={currentLevel}
              levelId={currentLevelId}
              preloadedSpec={currentSpec}
              preloadedMeta={currentMeta}
              pauseForTutorial={tutorialPending}
              onSpecLoaded={handleSpecLoaded}
            />
          </Suspense>
        </div>
      )}

      {view === 'game' && showGameTutorial && (
        <GameTutorialModal
          spec={currentSpec}
          onStart={() => {
            setShowGameTutorial(false);
            setTutorialPending(false);
            window.dispatchEvent(new Event('logicade:resume_game'));
          }}
        />
      )}

      {activeGate && (
        <CodeGateModal
          gateData={activeGate}
          onResolve={(correct) => {
            setActiveGate(null);
            window.dispatchEvent(
              new CustomEvent('logicade:gate_resolved', { detail: { correct } }),
            );
          }}
        />
      )}

      {showHintModal && !gameResult && (
        <HintConfirmModal
          cost={1}
          coins={coins}
          onConfirm={handleUseHint}
          onCancel={() => setShowHintModal(false)}
        />
      )}

      {showPauseExit && !gameResult && (
        <PauseExitModal
          onResume={() => {
            setShowPauseExit(false);
            window.dispatchEvent(new Event('logicade:resume_game'));
          }}
          onRestart={() => afterMarkingGameUsed(handleReplayLevel)}
          onExit={() => afterMarkingGameUsed(handleExitGame)}
        />
      )}

      {gameResult && (
        <GameResultModal
          result={gameResult}
          spec={currentSpec}
          onNext={() => afterMarkingGameUsed(handleNextLevel)}
          onRepeat={() => afterMarkingGameUsed(handleReplayLevel)}
          onExit={() => afterMarkingGameUsed(handleExitGame)}
        />
      )}
      {pageWipe && (
        <div
          aria-hidden="true"
          className={`page-circle-wipe ${pageWipe.phase}`}
          style={{ left: pageWipe.x, top: pageWipe.y }}
        />
      )}
    </div>
  );
}
