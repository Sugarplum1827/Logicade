import { useState, useEffect, useRef } from 'react';
import { lazy, Suspense } from 'react';
import { useCallback } from 'react';
import LandingPage from './components/LandingPage';
import LandingSplash from './components/LandingSplash';
import AuthPage from './components/AuthPage';
import AvatarSelect from './components/AvatarSelect';
import SubjectSelect from './components/SubjectSelect';
import PrologueVideo from './components/PrologueVideo';
import WorldMap from './components/WorldMap';
import LevelSelect from './components/LevelSelect';
const GameContainer = lazy(() => import('./components/GameContainer'));
import GamePackageFrame from './components/GamePackageFrame';
import CodeGateModal from './components/CodeGateModal';
import PauseExitModal from './components/PauseExitModal';
import GameResultModal from './components/GameResultModal';
import HintConfirmModal from './components/HintConfirmModal';
import GameTutorialModal from './components/GameTutorialModal';
import OracleDialogue from './components/OracleDialogue';
import OracleHint from './components/OracleHint';
import OracleCompanion from './components/OracleCompanion';
import { playButtonClick } from './game/audio';
import { resolveStageDifficulty, cacheServerDifficulty } from './game/difficultyDecisions';
import { unfinishedPerformance } from './game/unfinishedAttempt';
import { stageCountForWeek } from './game/stageCatalog';
import { createWalletRefreshController, readUnconfirmedCoinJobs, walletStatusText } from './game/walletBalance';

const normalizedDifficulty = (value) => {
  const name = String(value || '').toLowerCase().replace(/[ _-]/g, '');
  return ['needsupport', 'needssupport', 'needassistance'].includes(name) ? 'needs_support'
    : ['advance', 'advanced'].includes(name) ? 'advanced' : 'standard';
};
const hintMessage = (value) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(hintMessage).filter(Boolean).join(' ');
  if (value && typeof value === 'object') {
    return hintMessage(value.message ?? value.text ?? value.description ?? value.hint ?? value.objective);
  }
  return '';
};

export default function App() {
  const [bootState] = useState(() => {
    const user = localStorage.getItem('logicade_current_user') || '';
    const token = localStorage.getItem('logicade_session_token') || '';
    const savedView = localStorage.getItem('logicade_current_view') || '';
    let selectedRegion = null;
    let activeGame = null;
    try { selectedRegion = JSON.parse(localStorage.getItem('logicade_selected_region') || 'null'); } catch { /* use no saved region */ }
    if (user) {
      try { activeGame = JSON.parse(localStorage.getItem(`logicade_active_game_${user}`) || 'null'); } catch { /* use no saved game */ }
    }
    const pendingPrologue = user
      ? localStorage.getItem(`logicade_new_account_prologue_pending_${user}`) === '1'
      : false;
    return { user, token, savedView, selectedRegion, activeGame, pendingPrologue };
  });

  const [view, setView] = useState(() => {
    if (!bootState.user || !bootState.token) return bootState.savedView === 'auth' ? 'auth' : 'landing';
    if (bootState.savedView === 'prologue' && bootState.pendingPrologue) return 'prologue';
    if (bootState.savedView === 'game' && bootState.activeGame?.spec && bootState.selectedRegion) return 'game';
    if (bootState.savedView === 'level' && bootState.selectedRegion) return 'level';
    if (bootState.savedView === 'region') return 'region';
    if (bootState.savedView === 'avatar') return 'avatar';
    return 'subject';
  });
  const [showLandingSplash, setShowLandingSplash] = useState(() => view === 'landing');
  const finishLandingSplash = useCallback(() => setShowLandingSplash(false), []);

  const [studentId, setStudentId] = useState(
    () => bootState.user,
  );
  const [avatar, setAvatar] = useState(
    () => localStorage.getItem('logicade_avatar') || '/assets/ui/avatar1.png',
  );
  const [selectedRegion, setSelectedRegion] = useState(() => {
    return bootState.selectedRegion;
  });

  const [currentSubject, setCurrentSubject] = useState('cp1');

  const [currentLevel, setCurrentLevel] = useState(() => bootState.activeGame?.level || 1);
  const [currentLevelId, setCurrentLevelId] = useState(() => bootState.activeGame?.levelId || crypto.randomUUID());
  const [difficultyAssignments, setDifficultyAssignments] = useState({});
  const [currentSpec, setCurrentSpec] = useState(() => bootState.savedView === 'game' ? bootState.activeGame?.spec || null : null);
  const [currentMeta, setCurrentMeta] = useState(() => bootState.savedView === 'game' ? bootState.activeGame?.meta || null : null);
  const [currentPackageUrl, setCurrentPackageUrl] = useState(null);
  const [currentPackageId, setCurrentPackageId] = useState(null);
  const [currentPackageAssetBase, setCurrentPackageAssetBase] = useState(null);
  const [gameSessionId, setGameSessionId] = useState(() => bootState.activeGame?.gameSessionId || 0);
  const [isRestoringGame, setIsRestoringGame] = useState(() => Boolean(bootState.savedView === 'game' && bootState.activeGame?.spec));
  const [pageWipe, setPageWipe] = useState(null);
  const navigationBusy = useRef(false);
  const gameActionBusy = useRef(false);
  const difficultyResolutions = useRef(new Map());
  const difficultyScope = useRef(null);
  difficultyScope.current = { studentId, regionId: selectedRegion?.id };
  const gameOpenedAtRef = useRef(0);
  const poppedOpenCodeGames = useRef(new Map());

  const [activeGate, setActiveGate] = useState(null);

  // ── Per-user wallet / progress ────────────────────────────────
  const [coins, setCoins] = useState(20);
  const [xp, setXp] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [walletOwner, setWalletOwner] = useState('');
  const [walletStatus, setWalletStatus] = useState({ status: 'unverified' });
  const walletScope = useRef(null);
  walletScope.current = { studentId, gameKey: `${view}:${currentLevelId}:${gameSessionId}` };
  const walletRefreshRef = useRef(null);
  if (!walletRefreshRef.current) {
    walletRefreshRef.current = createWalletRefreshController({
      getScope: () => ({
        ...walletScope.current,
        studentId: localStorage.getItem('logicade_current_user') === walletScope.current.studentId ? walletScope.current.studentId : '',
        token: localStorage.getItem('logicade_session_token') || '',
      }),
      isOnline: () => navigator.onLine,
      readCoinJobs: (owner) => readUnconfirmedCoinJobs(() => window.LogiCadeDB.openDB(), owner),
      fetchBalance: async ({ token }) => {
        const response = await fetch('/api/coins/balance', {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`Coin verification failed (${response.status}).`);
        return response.json();
      },
      onBalance: setCoins,
      onState: setWalletStatus,
    });
  }
  const walletRefresh = walletRefreshRef.current;

  const [showPauseExit, setShowPauseExit] = useState(false);
  const [tutorialPending, setTutorialPending] = useState(false);
  const [showGameTutorial, setShowGameTutorial] = useState(false);
  const [gameGuidanceActive, setGameGuidanceActive] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [hintError, setHintError] = useState('');
  const [hintSpending, setHintSpending] = useState(false);
  const [oracleHint, setOracleHint] = useState('');
  const [oracleVoiceBlocked, setOracleVoiceBlocked] = useState(false);
  const [showPlayerOnboarding, setShowPlayerOnboarding] = useState(() => Boolean(
    bootState.user && localStorage.getItem(`logicade_onboarding_pending_${bootState.user}`) === '1',
  ));
  const [tutorialStep, setTutorialStep] = useState(() => {
    if (!bootState.user) return 0;
    const storedStep = Number(localStorage.getItem(`logicade_tutorial_step_${bootState.user}`)) || 0;
    const onboardingPending = localStorage.getItem(`logicade_onboarding_pending_${bootState.user}`) === '1';
    return onboardingPending && storedStep === 0 ? 1 : storedStep;
  });
  const [showHintTutorial, setShowHintTutorial] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [gameActionMessage, setGameActionMessage] = useState('');
  const backgroundMusicRef = useRef(null);
  const oracleVoiceRef = useRef(null);
  const [musicNeedsGesture, setMusicNeedsGesture] = useState(false);

  useEffect(() => {
    gameOpenedAtRef.current = view === 'game' ? Date.now() : 0;
    setHintSpending(false);
  }, [view, gameSessionId]);

  const startBackgroundMusic = useCallback(() => {
    const music = backgroundMusicRef.current;
    if (!music) return;
    music.muted = false;
    music.play()
      .then(() => setMusicNeedsGesture(false))
      .catch(() => setMusicNeedsGesture(true));
  }, []);

  const playOracleVoice = useCallback(() => {
    const voice = oracleVoiceRef.current;
    if (!voice) return;
    voice.currentTime = 0;
    voice.play()
      .then(() => setOracleVoiceBlocked(false))
      .catch(() => setOracleVoiceBlocked(true));
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
    if (view === 'game' || view === 'prologue' || showLandingSplash) {
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
  }, [view, showLandingSplash, startBackgroundMusic]);

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
      setWalletOwner('');
      setCoins(20);
      setXp(0);
      setPlayerLevel(1);
      return;
    }
    const savedValue = (key, defaultValue) => {
      const raw = localStorage.getItem(key);
      const value = raw === null ? NaN : Number(raw);
      return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : defaultValue;
    };
    // Global legacy values have no reliable owner. Keep them available for
    // manual recovery rather than assigning one learner's wallet to another.
    setCoins(savedValue(`logicade_coins_${studentId}`, 20));
    setXp(savedValue(`logicade_xp_${studentId}`, 0));
    setPlayerLevel(Math.max(1, savedValue(`logicade_level_${studentId}`, 1)));
    setWalletOwner(studentId);

    // Per-user preference restore
    const subj = localStorage.getItem(`logicade_current_subject_${studentId}`);
    if (subj) setCurrentSubject(subj);
  }, [studentId]);

  useEffect(() => {
    walletRefresh.invalidate();
    if (studentId) walletRefresh.refresh();
    return () => walletRefresh.invalidate(null);
  }, [studentId, view, currentLevelId, gameSessionId, walletRefresh]);

  useEffect(() => {
    const refresh = (event) => {
      const owner = event?.detail?.student_id || event?.detail?.studentId;
      if (owner && owner !== localStorage.getItem('logicade_current_user')) return;
      walletRefresh.refresh();
    };
    window.addEventListener('logicade:sync_completed', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    return () => {
      window.removeEventListener('logicade:sync_completed', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
    };
  }, [walletRefresh]);

  // ── Persist per-user wallet on change ────────────────────────
  useEffect(() => {
    if (studentId && walletOwner === studentId) {
      localStorage.setItem(`logicade_coins_${studentId}`, String(coins));
    }
  }, [studentId, walletOwner, coins]);

  useEffect(() => {
    if (studentId && walletOwner === studentId) {
      localStorage.setItem(`logicade_xp_${studentId}`, String(xp));
    }
  }, [studentId, walletOwner, xp]);

  useEffect(() => {
    if (studentId && walletOwner === studentId) {
      localStorage.setItem(`logicade_level_${studentId}`, String(playerLevel));
    }
  }, [studentId, walletOwner, playerLevel]);

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

  useEffect(() => {
    if (!studentId) return;
    if (isRestoringGame) return;
    const key = `logicade_active_game_${studentId}`;
    if (view !== 'game') {
      localStorage.removeItem(key);
      return;
    }
    if (!currentSpec || !selectedRegion) return;
    try {
      localStorage.setItem(key, JSON.stringify({
        spec: currentSpec,
        meta: currentMeta,
        region: selectedRegion,
        level: currentLevel,
        levelId: currentLevelId,
        gameSessionId,
        packageId: currentPackageId,
        packageUrl: currentPackageUrl,
      }));
    } catch (error) {
      console.warn('[navigation] could not save the active game for reload:', error);
    }
  }, [studentId, view, currentSpec, currentMeta, selectedRegion, currentLevel, currentLevelId, gameSessionId, currentPackageId, currentPackageUrl, isRestoringGame]);

  const resolveDifficultyForLevel = useCallback(async (stage, region = selectedRegion, previousLevelId) => {
    const token = localStorage.getItem('logicade_session_token');
    const scopeKey = `${studentId}:${region?.id}:${stage}`;
    if (difficultyResolutions.current.has(scopeKey)) return difficultyResolutions.current.get(scopeKey);
    const pending = (async () => {
      const { difficulty } = await resolveStageDifficulty({
        studentId, regionId: region?.id, week: region?.week, stage, previousLevelId,
        storage: localStorage,
        openDB: () => window.LogiCadeDB.openDB(),
        persistDecision: (decision) => window.LogiCadeWrite.recordDifficultyDecision(decision),
        fetchServerDecision: navigator.onLine ? async (week,level) => {
          await window.LogiCadeSync?.drainQueue();
          const response=await fetch(`/api/difficulty/resolve?week=${week}&level=${level}`,{
            headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
          if(!response.ok){const data=await response.json().catch(()=>({}));throw Object.assign(new Error(data.detail||'Could not recover this stage’s difficulty history.'),{userMessage:data.detail||'Synchronize this account before continuing.'});}
          return response.json();
        } : undefined,
        chooseDifficulty: (...inputs) => window.LogiCadeDifficulty.nextDifficulty(...inputs),
        isCurrentSession: () => localStorage.getItem('logicade_current_user') === studentId
          && localStorage.getItem('logicade_session_token') === token
          && difficultyScope.current.studentId === studentId
          && difficultyScope.current.regionId === region?.id,
      });
      if (difficultyScope.current.studentId === studentId && difficultyScope.current.regionId === region?.id) {
        setDifficultyAssignments((assignments) => ({ ...assignments, [stage]: difficulty }));
      }
      return difficulty;
    })();
    difficultyResolutions.current.set(scopeKey, pending);
    try { return await pending; }
    finally { difficultyResolutions.current.delete(scopeKey); }
  }, [studentId, selectedRegion]);

  // ── Window event plumbing ────────────────────────────────────
  useEffect(() => {
    const handleGate = (e) => setActiveGate(e.detail);
    const handleCoinsUpdate = (e) => {
      if (e.detail?.student_id !== studentId || !Number.isSafeInteger(e.detail?.coins) || e.detail.coins < 0) return;
      if (e.detail.level_id && e.detail.level_id !== currentLevelId) return;
      walletRefresh.invalidate('pending');
      setCoins(e.detail.coins);
      walletRefresh.refresh();
    };
    const handleGamePaused = () => setShowPauseExit(true);
    const handleTutorialReady = () => setShowGameTutorial(true);

    const handleGameOver = (e) => {
      const result = e.detail;
      if (view !== 'game' || result?.student_id !== studentId || result?.level_id !== currentLevelId) return;
      console.log('[App] game_over received:', result);
      setShowHintModal(false);
      setHintError('');
      setShowGameTutorial(false);
      setOracleHint('');

      if (result.spec) setCurrentSpec(result.spec);
      if (result.meta) setCurrentMeta(result.meta);

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

            const finishWalletMutation = walletRefresh.beginMutation();
            setCoins((balance) => balance + coinReward);
            Promise.resolve(window.LogiCadeWrite?.recordCoinTransaction({
              studentId,
              amount: coinReward,
              reason: 'first_level_completion_reward',
              levelId: currentLevelId,
            })).catch((err) => console.warn('[wallet] reward queued locally but could not be recorded:', err))
              .finally(() => { finishWalletMutation(); walletRefresh.refresh(); });

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
      if (result.won && selectedRegion && currentLevel < stageCountForWeek(selectedRegion.week)) {
        resolveDifficultyForLevel(currentLevel + 1, selectedRegion, currentLevelId).catch((error) =>
          console.warn('[difficulty] next-stage choice will be retried when its node is selected:', error),
        );
      }
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
  }, [view, selectedRegion, currentLevel, currentLevelId, studentId, coins, xp, playerLevel, resolveDifficultyForLevel, walletRefresh]);

  // ── Auth / avatar ─────────────────────────────────────────────
  const handleLogin = (id) => {
    localStorage.setItem('logicade_current_user', id);
    setStudentId(id);
    window.dispatchEvent(new Event('logicade:session_changed'));
    const needsFirstLoginSetup = localStorage.getItem(`logicade_new_account_prologue_pending_${id}`) === '1';
    setShowPlayerOnboarding(localStorage.getItem(`logicade_onboarding_pending_${id}`) === '1');
    const savedTutorialStep = Number(localStorage.getItem(`logicade_tutorial_step_${id}`)) || 0;
    const tutorialPending = localStorage.getItem(`logicade_onboarding_pending_${id}`) === '1';
    setTutorialStep(tutorialPending && savedTutorialStep === 0 ? 1 : savedTutorialStep);
    if (tutorialPending && savedTutorialStep === 0) localStorage.setItem(`logicade_tutorial_step_${id}`, '1');

    const savedAvatar = localStorage.getItem(`logicade_avatar_${id}`);
    if (savedAvatar) {
      setAvatar(savedAvatar);
      localStorage.setItem('logicade_avatar', savedAvatar);
    } else {
      localStorage.removeItem('logicade_avatar');
      setAvatar('/assets/ui/avatar1.png');
    }

    transitionTo(needsFirstLoginSetup ? 'avatar' : 'subject');
    // Login is not a generation action. LLM work is requested explicitly
    // through the game repeat flow so opening the app cannot start generation.
  };

  const handleNewUser = (id) => {
    localStorage.setItem(`logicade_new_account_prologue_pending_${id}`, '1');
    localStorage.setItem(`logicade_onboarding_pending_${id}`, '1');
    localStorage.setItem(`logicade_tutorial_step_${id}`, '1');
  };

  const advanceTutorial = (nextStep) => {
    if (nextStep > 5) {
      if (studentId) {
        localStorage.removeItem(`logicade_onboarding_pending_${studentId}`);
        localStorage.removeItem(`logicade_tutorial_step_${studentId}`);
      }
      setTutorialStep(0);
      setShowPlayerOnboarding(false);
      return;
    }
    setTutorialStep(nextStep);
    if (studentId) localStorage.setItem(`logicade_tutorial_step_${studentId}`, String(nextStep));
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
    setShowLandingSplash(true);
    setShowPlayerOnboarding(false);
    setTutorialStep(0);
    setShowHintTutorial(false);
    setShowHintModal(false);
    setHintError('');
    setHintSpending(false);
    setOracleHint('');
    if (studentId) localStorage.removeItem(`logicade_active_game_${studentId}`);
    localStorage.removeItem('logicade_current_user');
    localStorage.removeItem('logicade_session_token');
    localStorage.removeItem('logicade_current_view');
    localStorage.removeItem('logicade_selected_region');
    localStorage.removeItem('logicade_username');
    localStorage.removeItem('logicade_avatar');
    window.dispatchEvent(new Event('logicade:session_changed'));
    setStudentId('');
    setAvatar('/assets/ui/avatar1.png');
    setSelectedRegion(null);
    transitionTo('landing');
  };

  // ── Navigation ────────────────────────────────────────────────
  const handleSelectSubject = (subjectId = 'cp1') => {
    setCurrentSubject(subjectId);
    const prologueKey = `logicade_new_account_prologue_pending_${studentId}`;
    if (studentId && localStorage.getItem(prologueKey) === '1') {
      transitionTo('prologue');
      return;
    }
    transitionTo('region');
  };

  const handlePrologueComplete = () => {
    if (studentId) localStorage.removeItem(`logicade_new_account_prologue_pending_${studentId}`);
    transitionTo('region');
  };

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

  useEffect(() => {
    const key = `logicade_difficulty_${studentId}_${selectedRegion?.id}`;
    try {
      const stored = studentId && selectedRegion?.id ? JSON.parse(localStorage.getItem(key) || '{}') : {};
      setDifficultyAssignments(stored && !Array.isArray(stored) && typeof stored === 'object' ? stored : {});
    } catch {
      setDifficultyAssignments({});
    }
  }, [studentId, selectedRegion?.id]);

  const popGeneratedGame = useCallback(async (spec, meta) => {
    const fileId = spec?.file_id || spec?.game_id;
    const generatedGameId = meta?.generated_game?.variation_id;
    if (!fileId || !generatedGameId) return null;
    // A source can return after the pool cycles; pop it once for each run.
    const key = `${gameSessionId}:${fileId}:${generatedGameId}`;
    const existing = poppedOpenCodeGames.current.get(key);
    if (existing) return existing;
    const pending = (async () => {
      const response = await fetch('/api/games/mark-used', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('logicade_session_token') || ''}`,
        },
        body: JSON.stringify({ file_id: fileId, generated_game_id: generatedGameId,
          content_revision: meta?.generated_game?.content_revision || undefined,
          consumption_token: meta?.consumption_token || undefined }),
      });
      if (!response.ok) throw new Error(`Could not pop the used game package (${response.status}).`);
      return response.json();
    })();
    poppedOpenCodeGames.current.set(key, pending);
    try {
      return await pending;
    } catch (error) {
      poppedOpenCodeGames.current.delete(key);
      throw error;
    }
  }, [gameSessionId]);

  const prepareMissionPackage = async (spec, meta = null) => {
    const fileId = spec?.file_id || spec?.game_id;
    if (!fileId) return { runtime: 'phaser', launch_url: null };
    const response = await fetch('/api/games/prepare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('logicade_session_token') || ''}`,
      },
      body: JSON.stringify({
        file_id: fileId,
        ...(meta?.generated_game?.variation_id
          ? { generated_game_id: meta.generated_game.variation_id,
              content_revision: meta.generated_game.content_revision || undefined }
          : {}),
      }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail || `Could not prepare the game package (${response.status}).`);
    }
    return response.json();
  };

  const releaseGamePackage = async (packageId) => {
    if (!packageId) return;
    const response = await fetch('/api/games/release', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('logicade_session_token') || ''}`,
      },
      body: JSON.stringify({ package_id: packageId }),
    });
    if (!response.ok) throw new Error(`Could not clean up the extracted package (${response.status}).`);
  };

  useEffect(() => {
    if (!isRestoringGame || !currentSpec) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const saved=bootState.activeGame;
        const id=saved?.packageId;
        const url=saved?.packageUrl;
        if (typeof id==='string' && /^[a-f0-9]{64}-[a-f0-9]{32}$/.test(id) && url===`/game-builds/${id}/index.html`) {
          const available = !navigator.onLine || (await fetch(url,{method:'HEAD',cache:'no-store'})).ok;
          if (available && !cancelled) {
            setCurrentPackageUrl(url);setCurrentPackageId(id);setCurrentPackageAssetBase(null);
            return;
          }
        }
        const prepared = await prepareMissionPackage(currentSpec, currentMeta);
        if (cancelled) {
          if (prepared?.package_id) await releaseGamePackage(prepared.package_id);
          return;
        }
        setCurrentPackageUrl(prepared?.runtime === 'html5_package' ? prepared.launch_url : null);
        setCurrentPackageId(prepared?.package_id || null);
        setCurrentPackageAssetBase(prepared?.runtime === 'phaser_assets' ? prepared.asset_base : null);
        if (prepared?.generated_game) setCurrentMeta(previous=>({...previous,
          generated_game:prepared.generated_game,game_description:prepared.game_description,
          consumption_token:prepared.consumption_token || previous?.consumption_token}));
        if (prepared?.phaser_template) {
          setCurrentSpec((previous) => previous ? { ...previous, phaser_template: prepared.phaser_template } : previous);
          setCurrentMeta((previous) => ({ ...(previous || {}), ...prepared.phaser_template }));
        }
      } catch (error) {
        if (currentMeta?.generated_game?.runtime==='native_canvas') {
          console.info('[navigation] previous game revision is unavailable; select a fresh mission:',error);
          setCurrentSpec(null);setCurrentMeta(null);setCurrentPackageUrl(null);setCurrentPackageId(null);
          transitionTo('level');
        } else console.warn('[navigation] could not re-prepare the active game after reload:', error);
      } finally {
        if (!cancelled) setIsRestoringGame(false);
      }
    })();
    return () => { cancelled = true; };
    // Startup restoration uses the initial saved game exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartLevel = async (region, level, spec, meta, preparedPackage) => {
    const startToken=localStorage.getItem('logicade_session_token');
    const sameStartSession=()=>localStorage.getItem('logicade_current_user')===studentId && localStorage.getItem('logicade_session_token')===startToken;
    const assignedDifficulty=await resolveDifficultyForLevel(level, region);
    if(!sameStartSession())throw new Error('The account changed. Select the stage again.');
    const servedDifficulty=normalizedDifficulty(meta?.difficulty || spec?.difficulty);
    if(assignedDifficulty!==servedDifficulty)throw new Error('This mission has an older difficulty assignment. Select the stage again.');
    const levelKey = `logicade_level_id_${studentId}_${region.id}_${level}`;
    const levelId = localStorage.getItem(levelKey) || crypto.randomUUID();
    localStorage.setItem(levelKey, levelId);
    await window.LogiCadeWrite.ensureLevel({
      studentId, levelId, week: region.week || spec.week || 1,
      stageNumber: level,
      difficulty: servedDifficulty, assignedDifficulty, spec, meta,
    });
    if(meta?.generated_game?.runtime==='native_canvas'){
      await window.LogiCadeSync?.drainQueue();
      if(!sameStartSession())throw new Error('The account changed. Select the stage again.');
      const response=await fetch('/api/difficulty/start',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${startToken||''}`},body:JSON.stringify({file_id:spec.file_id,level_id:levelId,
        content_revision:preparedPackage?.generated_game?.content_revision||meta.generated_game.content_revision,
        consumption_token:preparedPackage?.consumption_token||meta.consumption_token})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.detail||'Could not confirm the assigned difficulty. Try Start again.');
      await cacheServerDifficulty({data,studentId,regionId:region.id,storage:localStorage,openDB:()=>window.LogiCadeDB.openDB(),isCurrentSession:sameStartSession});
    }
    // A preview does not mean the learner played at this difficulty.
    const decisionsKey = `logicade_difficulty_decisions_${studentId}_${region.id}`;
    const decisions = JSON.parse(localStorage.getItem(decisionsKey) || '{}');
    if (meta?.generated_game?.runtime!=='native_canvas' && decisions[level] && !decisions[level].difficulty_served) {
      const served = { ...decisions[level],
        next_level_id: levelId,
        inputs: { ...decisions[level].inputs, served_level_id: levelId, served_file_id: spec?.file_id },
        difficulty_served: normalizedDifficulty(meta?.difficulty || spec?.difficulty) };
      await window.LogiCadeWrite?.recordDifficultyDecision(served);
      decisions[level] = served;
      localStorage.setItem(decisionsKey, JSON.stringify(decisions));
    }
    if(!sameStartSession())throw new Error('The account changed. Select the stage again.');
    const packageUrl = preparedPackage?.runtime === 'html5_package'
      ? preparedPackage.launch_url : null;
    const gameDescription = preparedPackage?.game_description;
    const gameSpec = gameDescription
      ? {
          ...spec,
          game_title: gameDescription.title || preparedPackage?.generated_game?.display_name || spec?.game_title,
          player_objective: gameDescription.objective || spec?.player_objective,
          win_condition: gameDescription.win_condition || spec?.win_condition,
          lose_condition: gameDescription.lose_condition || spec?.lose_condition,
          hint: gameDescription.hint || spec?.hint,
        }
      : preparedPackage?.runtime === 'phaser_assets' && preparedPackage?.phaser_template
        ? { ...spec, phaser_template: preparedPackage.phaser_template }
        : spec;
    setCurrentLevel(level);
    setCurrentSpec(gameSpec);
    setCurrentMeta(preparedPackage?.game_description
      ? { ...(meta || {}), game_description: preparedPackage.game_description,
          consumption_token: preparedPackage.consumption_token || meta?.consumption_token,
          generated_game: preparedPackage.generated_game || meta?.generated_game }
      : meta);
    setCurrentPackageUrl(packageUrl);
    setCurrentPackageId(preparedPackage?.package_id || null);
    setCurrentPackageAssetBase(preparedPackage?.runtime === 'phaser_assets' ? preparedPackage.asset_base : null);
    setIsRestoringGame(false);
    setCurrentLevelId(levelId);
    setGameSessionId((prev) => prev + 1);
    setGameResult(null);
    setShowPauseExit(false);
    setShowGameTutorial(false);
    setTutorialPending(true);
    window.LogiCadeSync?.drainQueue().catch((error) => console.warn('[sync] started level remains queued:', error));
    transitionTo('game');
  };

  const handlePackagePause = useCallback(() => setShowPauseExit(true), []);
  const handlePackageGameOver = useCallback((result) => {
    window.dispatchEvent(new CustomEvent('logicade:game_over', { detail: result }));
    if (currentMeta?.generated_game?.variation_id) {
      popGeneratedGame(currentSpec, currentMeta).catch((error) =>
        console.warn('[game usage] completion cleanup will retry on exit or replay:', error),
      );
    }
  }, [currentMeta, currentSpec, popGeneratedGame]);

  const handleExitGame = () => {
    if (currentPackageId) releaseGamePackage(currentPackageId).catch((error) =>
      console.warn('[package] game extraction cleanup deferred:', error),
    );
    setShowPauseExit(false);
    setShowHintModal(false);
    setHintError('');
    setOracleHint('');
    setShowGameTutorial(false);
    setTutorialPending(false);
    setGameResult(null);
    setCurrentSpec(null);
    setCurrentMeta(null);
    setCurrentPackageUrl(null);
    setCurrentPackageId(null);
    setCurrentPackageAssetBase(null);
    setIsRestoringGame(false);
    transitionTo('level');
  };

  const regenerateCurrentGame = async (actionName) => {
    const fileId = currentSpec?.file_id || currentSpec?.game_id;
    if (fileId && String(currentSpec?.source_path || '').replaceAll('\\', '/').startsWith('data/fallback_pool/')) {
      try {
        const response = await fetch('/api/games/regenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('logicade_session_token') || ''}` },
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
    const currentVariationId = currentMeta?.generated_game?.variation_id;
    if (currentVariationId && selectedRegion) {
      const oldPackageId = currentPackageId;
      const difficulty = normalizedDifficulty(currentSpec?.difficulty || currentMeta?.difficulty);
      const response = await fetch('/serve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('logicade_session_token') || ''}`,
        },
        body: JSON.stringify({
          student_id: studentId,
          week: selectedRegion.week || 1,
          level: currentLevel,
          difficulty,
        }),
      });
      if (!response.ok) throw new Error(`A different game could not be selected (${response.status}).`);
      const nextGame = await response.json();
      if (!nextGame?.spec || !nextGame?.meta?.generated_game?.variation_id) {
        throw new Error('The server did not return a new Canvas game.');
      }
      const prepared = await prepareMissionPackage(nextGame.spec, nextGame.meta);
      if (prepared?.runtime !== 'html5_package' || !prepared.launch_url) {
        if (prepared?.package_id) await releaseGamePackage(prepared.package_id);
        throw new Error('The new game ZIP could not be prepared.');
      }
      const nextDescription = prepared.game_description || nextGame.meta.game_description;
      setCurrentSpec(nextDescription ? {
        ...nextGame.spec,
        game_title: nextDescription.title || prepared.generated_game?.display_name || nextGame.spec.game_title,
        player_objective: nextDescription.objective || nextGame.spec.player_objective,
        win_condition: nextDescription.win_condition || nextGame.spec.win_condition,
        lose_condition: nextDescription.lose_condition || nextGame.spec.lose_condition,
        hint: nextDescription.hint || nextGame.spec.hint,
      } : nextGame.spec);
      setCurrentMeta({
        ...(nextGame.meta || {}),
        difficulty,
        game_description: nextDescription,
        consumption_token: prepared.consumption_token || nextGame.meta?.consumption_token,
        generated_game: prepared.generated_game || nextGame.meta.generated_game,
      });
      setCurrentPackageUrl(prepared.launch_url);
      setCurrentPackageId(prepared.package_id || null);
      setCurrentPackageAssetBase(null);
      setIsRestoringGame(false);
      setShowPauseExit(false);
      setShowGameTutorial(false);
      setTutorialPending(false);
      setOracleHint('');
      setGameResult(null);
      setGameSessionId((previous) => previous + 1);
      if (oldPackageId) {
        window.requestAnimationFrame(() => {
          releaseGamePackage(oldPackageId).catch((error) =>
            console.warn('[package] replaced game extraction cleanup deferred:', error),
          );
        });
      }
      return;
    }

    // Legacy games may still use the server replacement generator. Template
    // games rotate their deterministic template/variation without rewriting
    // the source description JSON.
    const templateDriven = Boolean(currentMeta?.template_id || currentSpec?.phaser_template?.template_id);
    if (gameResult?.won && !currentPackageUrl && !templateDriven) await regenerateCurrentGame('Repeat');
    if (templateDriven && currentSpec?.phaser_template) {
      const sourceDescription = { ...currentSpec };
      delete sourceDescription.phaser_template;
      setCurrentSpec(sourceDescription);
    }
    setShowPauseExit(false);
    setShowGameTutorial(false);
    setTutorialPending(true);
    setGameResult(null);
    setGameSessionId((prev) => prev + 1);
  };

  const handleNextLevel = async () => {
    const nextLevel = currentLevel + 1;
    if (currentLevel < stageCountForWeek(selectedRegion?.week)) {
      // Resolve before clearing the finished game so a storage failure keeps
      // the result and its recovery controls available.
      await resolveDifficultyForLevel(nextLevel, selectedRegion, currentLevelId);
    }
    if (currentPackageId) releaseGamePackage(currentPackageId).catch((error) =>
      console.warn('[package] game extraction cleanup deferred:', error),
    );
    setGameResult(null);
    setCurrentSpec(null);
    setCurrentMeta(null);
    setCurrentPackageUrl(null);
    setCurrentPackageId(null);
    setCurrentPackageAssetBase(null);
    setIsRestoringGame(false);
    if (currentLevel < stageCountForWeek(selectedRegion?.week)) {
      setCurrentLevel(nextLevel);
      setCurrentLevelId(crypto.randomUUID());
      setGameSessionId((prev) => prev + 1);
    }
    transitionTo('level');
  };

  const afterMarkingGameUsed = async (action) => {
    if (gameActionBusy.current) return;
    gameActionBusy.current = true;
    let replacementFailed = false;
    try {
      // Preserve a real event-backed record when a learner exits or restarts
      // before a game-over result exists. Completed/failed rounds are already
      // persisted by their renderer, so never create a second attempt for them.
      if (!gameResult && currentSpec && studentId && currentLevelId) {
        const events = window.Telemetry?.snapshot?.() || [];
        const started = events.some((event) => ['level_start', 'game_started'].includes(event.event_type));
        const finished = events.some((event) => ['level_win', 'level_lose', 'game_over'].includes(event.event_type));
        if (started && !finished) {
          const restarting = action === handleReplayLevel;
          const eventType = restarting ? 'level_restart' : 'level_abandoned';
          window.Telemetry?.emit(eventType, {
            t_ms_since_start: Math.max(0, Date.now() - (gameOpenedAtRef.current || Date.now())),
            payload: { reason: restarting ? 'player_restarted_before_completion' : 'player_exited_before_completion' },
          });
          const snapshot = window.Telemetry?.snapshot?.() || [];
          const incorrect = snapshot.filter((event) =>
            event.event_type === 'answer_incorrect'
            || event.event_type === 'collision'
            || (event.event_type === 'question_answered'
              && (event.payload?.correct === false || event.payload?.ok === false)),
          ).length;
          const hints = snapshot.filter((event) => event.event_type === 'hint_used').length;
          const partialPerformance=unfinishedPerformance(snapshot);
          const elapsedSec = Math.max(0, (Date.now() - (gameOpenedAtRef.current || Date.now())) / 1000);
          try {
            await window.LogiCadeWrite?.persistAttempt({
              studentId, levelId: currentLevelId,
              week: selectedRegion?.week || currentSpec.week || 1,
              stageNumber: currentLevel,
              difficulty: normalizedDifficulty(currentSpec.difficulty || currentMeta?.difficulty),
              spec: currentSpec, meta: currentMeta,
              score: partialPerformance.score, accuracy: partialPerformance.accuracy, errorCount: incorrect, hintCount: hints,
              completionTimeSec: elapsedSec, won: false,
              status: restarting ? 'restarted' : 'abandoned',
            });
          } catch (error) {
            console.error('[game action] unfinished attempt could not be queued:', error);
          }
        }
      }
      const fileId = currentSpec?.file_id || currentSpec?.game_id;
      const generatedGameId = currentMeta?.generated_game?.variation_id;
      const templateDriven = Boolean(currentMeta?.template_id || currentSpec?.phaser_template?.template_id);
      if (fileId) {
        try {
          const lost = gameResult?.won === false;
          if (lost && action === handleExitGame && !currentPackageUrl && !templateDriven) {
            // Exit immediately; generation is best-effort background work.
            fetch('/api/games/consume-and-regenerate', {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('logicade_session_token') || ''}` },
              body: JSON.stringify({ file_id: fileId, request_id: crypto.randomUUID() }),
            }).catch((error) => console.warn('[game usage] background replacement failed:', error));
            await action();
            return;
          }
          if (action === handleReplayLevel && generatedGameId) {
            setGameActionMessage('Preparing a different game…');
          } else if (generatedGameId) {
            setGameActionMessage(action === handleNextLevel ? 'Preparing the next level…' : 'Returning to level selection…');
          } else if (lost) setGameActionMessage('Creating a fresh verified challenge… This can take a little while.');
          const shouldRegenerate = lost && !currentPackageUrl && !templateDriven;
          if (generatedGameId) {
            await popGeneratedGame(currentSpec, currentMeta);
          } else {
            const response = await fetch(shouldRegenerate ? '/api/games/consume-and-regenerate' : '/api/games/mark-used', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('logicade_session_token') || ''}` },
              body: JSON.stringify(shouldRegenerate
                ? { file_id: fileId, request_id: crypto.randomUUID() }
                : { file_id: fileId }),
            });
            if (!response.ok) throw new Error(`Could not consume game JSON (${response.status})`);
            if (shouldRegenerate) {
              const data = await response.json();
              setCurrentSpec(data.spec);
              setCurrentMeta(data.meta || null);
            }
          }
        } catch (error) {
          console.warn('[game usage] could not consume or replace JSON:', error);
          replacementFailed = gameResult?.won === false;
        }
      }
      if (replacementFailed && action === handleReplayLevel) {
        setGameActionMessage(currentPackageUrl
          ? 'Could not record this game action. Check the server connection, then try again.'
          : 'Could not create a fresh game. Check that Ollama is running, then try again.');
        return;
      }
      try {
        await action();
      } catch (error) {
        console.error('[game action] could not prepare the next game:', error);
        replacementFailed = true;
        setGameActionMessage(`Could not create a different game. ${error?.message || 'Check the server and try again.'}`);
      }
    } finally {
      gameActionBusy.current = false;
      if (!replacementFailed) setGameActionMessage('');
    }
  };

  const handleUseHint = async () => {
    const hintCost = 6;
    if (hintSpending || coins < hintCost || !currentSpec) return;
    setHintError('');
    setHintSpending(true);
    const requestedSession = localStorage.getItem('logicade_session_token');
    const requestedRun = gameOpenedAtRef.current;
    const finishWalletMutation = walletRefresh.beginMutation();
    const isCurrentHint = () => localStorage.getItem('logicade_current_user') === studentId
      && localStorage.getItem('logicade_session_token') === requestedSession
      && gameOpenedAtRef.current === requestedRun && Boolean(requestedRun);
    let transaction;
    try {
      transaction = await window.LogiCadeWrite?.recordCoinTransaction({
        studentId,
        amount: -hintCost,
        reason: 'hint_used',
        levelId: currentLevelId,
        requireServer: true,
      });
      if (!transaction) throw new Error('The hint purchase could not be saved. Please try again.');
    } catch (error) {
      if (isCurrentHint()) {
        setHintError(error?.message || 'The coin balance could not be verified. Try again when connected.');
        setHintSpending(false);
      }
      finishWalletMutation();
      walletRefresh.refresh();
      return;
    }
    if (!isCurrentHint()) {
      finishWalletMutation();
      walletRefresh.refresh();
      return;
    }
    // Preserve unsynchronized local rewards until the outbox is confirmed.
    // A fresh authoritative balance replaces this provisional value afterward.
    setCoins((balance) => Math.max(0, balance - hintCost));
    finishWalletMutation();
    walletRefresh.refresh();
    setHintSpending(false);
    setShowHintModal(false);
    const hint = hintMessage(currentSpec.hint || currentSpec.player_objective) || 'Review the code and objective, then try one small change.';
    setOracleHint(hint);
    playOracleVoice();
    window.dispatchEvent(
      new CustomEvent('logicade:show_hint', {
        detail: { hint },
      }),
    );
  };

  return (
    <div className="app-wrapper">
      <audio ref={backgroundMusicRef} src={`${import.meta.env.BASE_URL}assets/bg_song.mp3`} loop preload="auto" autoPlay playsInline />
      <audio ref={oracleVoiceRef} src={`${import.meta.env.BASE_URL}assets/oracles_voice.mp3`} preload="auto" />
      {view === 'landing' && showLandingSplash && <LandingSplash onComplete={finishLandingSplash} />}
      {view === 'landing' && !showLandingSplash && <LandingPage onStart={() => {
        localStorage.setItem('logicade_auth_mode', 'login');
        startBackgroundMusic();
        transitionTo('auth');
      }} />}
      {view !== 'game' && !showLandingSplash && musicNeedsGesture && (
        <button
          className="music-start-prompt"
          onClick={startBackgroundMusic}
          title="Your browser requires one interaction before it allows sound to play."
          aria-label="Enable background music"
        >
          🔊 ENABLE MUSIC
        </button>
      )}
      {view === 'auth' && (
        <AuthPage
          onLogin={handleLogin}
          onNewUser={handleNewUser}
          onBack={() => transitionTo('landing')}
        />
      )}
      {view === 'avatar' && <AvatarSelect onSelect={handleAvatarSelected} />}
      {view === 'subject' && (
        <SubjectSelect
          studentId={studentId}
          onSelectSubject={handleSelectSubject}
          onLogout={handleLogout}
          tutorial={showPlayerOnboarding && tutorialStep === 1 ? (
            <OracleDialogue step={1} title="Keeper of the surviving records" text="Welcome, learner. Choose the CP1 lesson to begin your programming journey. Your first stop is the Kingdom, where you will learn how to explore LogiCade." onNext={() => advanceTutorial(2)} />
          ) : null}
        />
      )}

      {view === 'prologue' && (
        <PrologueVideo onComplete={handlePrologueComplete} />
      )}

      {view === 'region' && (
        <WorldMap
          studentId={studentId}
          coins={coins}
          walletStatus={walletStatus}
          avatar={avatar}
          playerLevel={playerLevel}
          xp={xp}
          currentSubject={currentSubject}
          onSwitchSubject={handleSwitchSubject}
          onEnterRegion={handleSelectRegion}
          onBack={() => transitionTo('subject')}
          onLogout={handleLogout}
          tutorial={showPlayerOnboarding && tutorialStep === 2 ? (
            <OracleDialogue step={2} title="Keeper of the surviving records" text="This is your world map. Each region holds a lesson topic. Begin with The Kingdom, then return here as new regions unlock." onNext={() => advanceTutorial(3)} />
          ) : null}
        />
      )}

      {view === 'level' && selectedRegion && (
        <LevelSelect
          studentId={studentId}
          region={selectedRegion}
          difficultyAssignments={difficultyAssignments}
          onResolveDifficulty={resolveDifficultyForLevel}
          onStartLevel={handleStartLevel}
          onPrepareMission={prepareMissionPackage}
          onReleasePackage={releaseGamePackage}
          onBack={() => transitionTo('region')}
          tutorialStep={showPlayerOnboarding ? tutorialStep : 0}
          onAdvanceTutorial={advanceTutorial}
        />
      )}

      {view === 'level' && showPlayerOnboarding && tutorialStep === 3 && (
        <OracleDialogue step={3} title="Keeper of the surviving records" text="These are the level nodes. Choose an unlocked level to load its mission, read the objective and rewards, then select View Mission and Start when ready." onNext={() => advanceTutorial(4)} />
      )}

      {view === 'game' && selectedRegion && (
        <div style={{ position: 'relative', width: '100vw', height: '100dvh', minHeight: '100svh' }}>
          <button
            onClick={() => window.dispatchEvent(new Event('logicade:pause_game'))}
            className="in-game-back-btn"
          >
            ← Back
          </button>

          <div className="game-hud-right">
            <div className="coin-display" title={walletStatusText(walletStatus)} aria-label={`${coins} coins. ${walletStatusText(walletStatus)}`}>
              <img src="/assets/gold_coin.png" alt="Coin" />
              <span>{coins}</span>
              {walletStatus.status !== 'verified' && <span aria-hidden="true" style={{ fontSize: '0.65em' }}>*</span>}
            </div>
          </div>

          {!gameGuidanceActive && !gameResult && !showPauseExit && !showHintModal && !showHintTutorial && !oracleHint && (
            <OracleCompanion
              onClick={() => {
                if (showPlayerOnboarding && tutorialStep === 5) setShowHintTutorial(true);
                else setShowHintModal(true);
              }}
              disabled={!currentSpec}
            />
          )}

          {isRestoringGame || !currentSpec ? (
            <div role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', background: '#050510', color: '#b8f2c8', fontFamily: 'monospace' }}>
              {isRestoringGame ? 'Restoring your game…' : 'Returning to stages…'}
            </div>
          ) : currentPackageUrl ? (
            <GamePackageFrame
              key={`${currentLevelId}-${gameSessionId}`}
              launchUrl={currentPackageUrl}
              studentId={studentId}
              levelId={currentLevelId}
              week={currentSpec?.week ?? currentSpec?.week_number ?? selectedRegion?.week ?? 1}
              level={currentLevel}
              difficulty={currentMeta?.difficulty ?? currentSpec?.difficulty ?? 'Standard'}
              spec={currentSpec}
              meta={currentMeta}
              onPause={handlePackagePause}
              onGuidanceChange={setGameGuidanceActive}
              onGameOver={handlePackageGameOver}
            />
          ) : (
            <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#101814', color: '#b8f2c8', zIndex: 50 }}>Preparing the game…</div>}>
              <GameContainer
                key={`${currentLevelId}-${gameSessionId}`}
                studentId={studentId}
                region={selectedRegion}
                level={currentLevel}
                levelId={currentLevelId}
                gameSessionId={gameSessionId}
                templateAssetBase={currentPackageAssetBase}
                preloadedSpec={currentSpec}
                preloadedMeta={currentMeta}
                pauseForTutorial={tutorialPending}
                onSpecLoaded={handleSpecLoaded}
              />
            </Suspense>
          )}
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
          cost={6}
          coins={coins}
          error={hintError}
          busy={hintSpending}
          onConfirm={handleUseHint}
          onCancel={() => { setHintError(''); setShowHintModal(false); }}
        />
      )}

      {oracleHint && view === 'game' && !gameResult && (
        <OracleHint hint={oracleHint} voiceBlocked={oracleVoiceBlocked} onPlayVoice={playOracleVoice} onClose={() => setOracleHint('')} />
      )}

      {showHintTutorial && view === 'game' && (
        <OracleDialogue
          step={5}
          title="Keeper of the surviving records"
          text="Hints reveal a clue for your current challenge and cost 6 coins. When you are ready, choose Next to confirm the purchase. I will speak the hint aloud."
          nextLabel="CONTINUE"
          onNext={() => {
            setShowHintTutorial(false);
            advanceTutorial(6);
            setShowHintModal(true);
          }}
        />
      )}

      {showPauseExit && !gameResult && (
        <PauseExitModal
          onResume={() => {
            setShowPauseExit(false);
            setOracleHint('');
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
          nextLabel={currentLevel >= stageCountForWeek(selectedRegion?.week) ? 'BACK TO STAGES' : 'NEXT'}
          onRepeat={() => afterMarkingGameUsed(handleReplayLevel)}
          onExit={() => afterMarkingGameUsed(handleExitGame)}
        />
      )}
      {gameActionMessage && (
        <div role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.72)', color: 'white', fontSize: 22, textAlign: 'center', padding: 24 }}>
          <div>{gameActionMessage}<div style={{ fontSize: 15, marginTop: 12 }}>Please keep this window open.</div>
            {gameActionMessage.startsWith('Could not create') && <button style={{ marginTop: 18 }} onClick={() => setGameActionMessage('')}>Dismiss and try again</button>}
          </div>
        </div>
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
