import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import AvatarSelect from './components/AvatarSelect';
import SubjectSelect from './components/SubjectSelect';
import WorldMap from './components/WorldMap';
import LevelSelect from './components/LevelSelect';
import GameContainer from './components/GameContainer';
import CodeGateModal from './components/CodeGateModal';
import PauseExitModal from './components/PauseExitModal';
import GameResultModal from './components/GameResultModal';
import HintConfirmModal from './components/HintConfirmModal';

export default function App() {
  const [view, setView] = useState(() => {
    const savedView = localStorage.getItem('logicade_current_view');
    const user = localStorage.getItem('logicade_current_user');
    if (user && savedView && !['landing', 'auth', 'avatar', 'game'].includes(savedView)) return savedView;
    return 'landing';
  });

  const [studentId, setStudentId] = useState(() => localStorage.getItem('logicade_current_user') || '');
  const [avatar, setAvatar] = useState(() => localStorage.getItem('logicade_avatar') || '/assets/ui/avatar1.png');
  const [selectedRegion, setSelectedRegion] = useState(() => {
    const saved = localStorage.getItem('logicade_selected_region');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentSpec, setCurrentSpec] = useState(null);
  const [gameSessionId, setGameSessionId] = useState(0);
  
  const [activeGate, setActiveGate] = useState(null);
  const [coins, setCoins] = useState(() => parseInt(localStorage.getItem('logicade_coins') || '50'));
  const [xp, setXp] = useState(() => parseInt(localStorage.getItem('logicade_xp') || '0'));
  const [playerLevel, setPlayerLevel] = useState(() => parseInt(localStorage.getItem('logicade_level') || '1'));

  const [showPauseExit, setShowPauseExit] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [gameResult, setGameResult] = useState(null);

  useEffect(() => {
    setCoins(parseInt(localStorage.getItem('logicade_coins') || '50'));
    setXp(parseInt(localStorage.getItem('logicade_xp') || '0'));
    setPlayerLevel(parseInt(localStorage.getItem('logicade_level') || '1'));
    localStorage.setItem('logicade_current_view', view);
    if (studentId) localStorage.setItem('logicade_current_user', studentId);
  }, [view, studentId]);

  useEffect(() => {
    if (selectedRegion) localStorage.setItem('logicade_selected_region', JSON.stringify(selectedRegion));
  }, [selectedRegion]);

  // ⭐ FIXED: Event Listeners
  useEffect(() => {
    const handleGate = (e) => setActiveGate(e.detail);
    const handleCoinsUpdate = (e) => setCoins(e.detail.coins);
    const handleGamePaused = () => setShowPauseExit(true);
    
    const handleGameOver = (e) => {
      const result = e.detail;
      console.log('[App] game_over received:', result);

      let coinReward = 0;
      let xpReward = 0;
      let isFirstTime = false;

      try {
        if (result.won && selectedRegion) {
          const key = `logicade_levels_${selectedRegion.id}`;
          const raw = localStorage.getItem(key);
          let saved = [];
          try {
            saved = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(saved)) saved = [];
          } catch (err) {
            saved = [];
          }

          isFirstTime = !saved.includes(currentLevel);

          if (isFirstTime) {
            coinReward = 10;
            xpReward = 50;

            saved.push(currentLevel);
            localStorage.setItem(key, JSON.stringify(saved));

            const currentCoins = parseInt(localStorage.getItem('logicade_coins') || '50');
            const newCoins = currentCoins + coinReward;
            localStorage.setItem('logicade_coins', String(newCoins));
            setCoins(newCoins);

            const currentXp = parseInt(localStorage.getItem('logicade_xp') || '0');
            let newXp = currentXp + xpReward;
            let newPlayerLevel = parseInt(localStorage.getItem('logicade_level') || '1');
            let xpToNext = newPlayerLevel * 100;
            
            while (newXp >= xpToNext) {
              newXp -= xpToNext;
              newPlayerLevel += 1;
              xpToNext = newPlayerLevel * 100;
            }
            localStorage.setItem('logicade_xp', String(newXp));
            localStorage.setItem('logicade_level', String(newPlayerLevel));
            setXp(newXp);
            setPlayerLevel(newPlayerLevel);
          }
        }
      } catch (err) {
        console.error('[App] Error processing game over:', err);
      }

      setGameResult({
        ...result,
        coinReward,
        xpReward,
        isFirstTime,
      });
    };

    window.addEventListener('logicade:gate_opened', handleGate);
    window.addEventListener('logicade:coins_updated', handleCoinsUpdate);
    window.addEventListener('logicade:game_over', handleGameOver);
    window.addEventListener('logicade:game_paused', handleGamePaused);
    
    return () => {
      window.removeEventListener('logicade:gate_opened', handleGate);
      window.removeEventListener('logicade:coins_updated', handleCoinsUpdate);
      window.removeEventListener('logicade:game_over', handleGameOver);
      window.removeEventListener('logicade:game_paused', handleGamePaused);
    };
  }, [selectedRegion, currentLevel]); // Only re-bind if region or level changes

  const handleLogin = (id) => {
    setStudentId(id);
    setView('subject');
    fetch('/reset_pools', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ student_id: id })
    }).catch(err => console.warn('[reset_pools] failed:', err));
    fetch('/warm_pool', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ student_id: id, weeks: [1, 2, 3] })
    }).catch(err => console.warn('[warm_pool] failed:', err));
  };

  const handleNewUser = (id) => { setStudentId(id); setView('avatar'); };
  const handleAvatarSelected = (chosenAvatar) => { setAvatar(chosenAvatar); localStorage.setItem('logicade_avatar', chosenAvatar); setView('subject'); };
  const handleLogout = () => { setStudentId(''); setView('auth'); localStorage.clear(); };
  const handleSelectSubject = () => setView('region');
  const handleSelectRegion = (region) => { setSelectedRegion(region); setView('level'); };
  const handleStartLevel = (region, level, spec) => { 
    setCurrentLevel(level); 
    setCurrentSpec(spec); 
    setView('game'); 
  };

  const handleExitGame = () => {
    setShowPauseExit(false);
    setGameResult(null);
    setCurrentSpec(null);
    setView('level');
  };

  const handleRestartGame = () => {
    setShowPauseExit(false);
    setGameResult(null);
    setGameSessionId(prev => prev + 1);
  };

  const handleNextLevel = () => {
    setGameResult(null);
    setCurrentSpec(null);
    setCurrentLevel(prev => prev + 1);
    setView('level');
  };

  const handleRepeatLevel = () => {
    setGameResult(null);
    setGameSessionId(prev => prev + 1);
  };

  const handleUseHint = () => {
    if (coins < 1) return;
    const newCoins = coins - 1;
    localStorage.setItem('logicade_coins', String(newCoins));
    setCoins(newCoins);
    setShowHintModal(false);
    window.dispatchEvent(new CustomEvent('logicade:show_hint', {
      detail: { hint: currentSpec?.hint || 'No hint available.' }
    }));
  };

  return (
    <div className="app-wrapper">
      {view === 'landing' && <LandingPage onStart={() => setView('auth')} />}
      {view === 'auth' && <AuthPage onLogin={handleLogin} onNewUser={handleNewUser} />}
      {view === 'avatar' && <AvatarSelect onSelect={handleAvatarSelected} />}
      {view === 'subject' && <SubjectSelect studentId={studentId} onSelectSubject={handleSelectSubject} onLogout={handleLogout} />}
      
      {view === 'region' && (
        <WorldMap coins={coins} avatar={avatar} playerLevel={playerLevel} xp={xp} onEnterRegion={handleSelectRegion} onLogout={handleLogout} />
      )}
      
      {view === 'level' && selectedRegion && (
        <LevelSelect region={selectedRegion} onStartLevel={handleStartLevel} onBack={() => setView('region')} />
      )}
      
      {/* ⭐ FIX: Removed `&& currentSpec` so it mounts and fetches the game */}
      {view === 'game' && selectedRegion && (
        <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
          <button 
            onClick={() => window.dispatchEvent(new Event('logicade:pause_game'))} 
            className="in-game-back-btn"
          >
            ← Back
          </button>

          <div className="game-hud-right">
            <div className="coin-display">
              <img src="/assets/gold_coin.png" alt="Coin" />
              <span>{coins}</span>
            </div>
            <button 
              className="hint-btn" 
              onClick={() => setShowHintModal(true)}
              title="Use a hint (1 coin)"
            >
              💡 Hint
            </button>
          </div>
          
          <GameContainer 
            key={`${currentLevel}-${gameSessionId}`}
            studentId={studentId} 
            region={selectedRegion} 
            level={currentLevel}
            preloadedSpec={currentSpec}
          />
        </div>
      )}

      {activeGate && <CodeGateModal gateData={activeGate} onResolve={(correct) => {
        setActiveGate(null);
        window.dispatchEvent(new CustomEvent('logicade:gate_resolved', { detail: { correct } }));
      }} />}

      {showHintModal && !gameResult && (
        <HintConfirmModal
          cost={1}
          coins={coins}
          hintText={currentSpec?.hint || 'Generating hint...'}
          onConfirm={handleUseHint}
          onCancel={() => setShowHintModal(false)}
        />
      )}

      {showPauseExit && !gameResult && (
        <PauseExitModal 
          onResume={() => { setShowPauseExit(false); window.dispatchEvent(new Event('logicade:resume_game')); }}
          onRestart={handleRestartGame}
          onExit={handleExitGame}
        />
      )}

      {gameResult && (
        <GameResultModal 
          result={gameResult}
          spec={currentSpec}
          onNext={handleNextLevel}
          onRepeat={handleRepeatLevel}
          onExit={handleExitGame}
        />
      )}
    </div>
  );
}