import { useState, useEffect } from 'react';
import MissionTargetModal from './MissionTargetModal';

export default function LevelSelect({ region, onStartLevel, onBack }) {
  const [completedLevels, setCompletedLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [levelSpec, setLevelSpec] = useState(null);
  const [loadingSpec, setLoadingSpec] = useState(false);
  const [showMissionModal, setShowMissionModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`logicade_levels_${region.id}`);
    setCompletedLevels(saved ? JSON.parse(saved) : []);
  }, [region.id]);

  useEffect(() => {
    if (!selectedLevel) return;
    
    setLoadingSpec(true);
    setLevelSpec(null);

    let difficulty = 'needs_support';
    if (selectedLevel.week > 3) difficulty = 'standard';
    if (selectedLevel.week > 7) difficulty = 'advanced';

    fetch('/serve', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ 
        student_id: localStorage.getItem('logicade_current_user') || 'guest', 
        week: selectedLevel.week, 
        difficulty 
      })
    })
    .then(res => res.json())
    .then(data => {
      setLevelSpec(data.spec);
      setLoadingSpec(false);
    })
    .catch(err => {
      console.error("Failed to load spec:", err);
      setLoadingSpec(false);
    });
  }, [selectedLevel]);

  const levels = Array.from({ length: 10 }, (_, i) => i + 1);
  const isUnlocked = (num) => num === 1 || completedLevels.includes(num - 1);

  const formatObjective = (winStr) => {
    if (!winStr) return "Complete the level";
    if (winStr.includes('score')) {
      const match = winStr.match(/score\s*(==|>=|>)\s*(\d+)/);
      if (match) return `Collect ${match[2]} items`;
    }
    if (winStr.includes('timer')) {
      const match = winStr.match(/timer\s*(==|>=|>)\s*(\d+)/);
      if (match) return `Survive for ${match[2]} seconds`;
    }
    if (winStr.includes('count')) {
       const match = winStr.match(/count\s*(==|>=|>)\s*(\d+)/);
       if (match) return `Destroy ${match[2]} objects`;
    }
    return "Complete the main objective";
  };

  return (
    <div className="level-select-screen" style={{ backgroundImage: `url('${region.level_bg || '/assets/subjects/library_bg.png'}')` }}>
      
      {showMissionModal && levelSpec && (
        <MissionTargetModal 
          spec={levelSpec}
          onStart={() => { setShowMissionModal(false); onStartLevel(region, selectedLevel.week, levelSpec); }}
          onCancel={() => setShowMissionModal(false)}
        />
      )}

      <div className="level-header">
        <button className="btn-back" onClick={onBack}>← BACK TO MAP</button>
        <div className="level-header-info">
          <h1>{region.title}</h1>
          <p>{region.subtitle}</p>
        </div>
        <div style={{ width: '150px' }}></div>
      </div>

      <div className="level-layout">
        <div className="levels-container">
          <div className="levels-grid">
            {levels.map(num => {
              const unlocked = isUnlocked(num);
              const completed = completedLevels.includes(num);
              const mockLevelData = { week: num, title: `Stage ${num}`, subtitle: region.subtitle };

              return (
                <button 
                  key={num} 
                  className={`level-node ${unlocked ? 'unlocked' : 'locked'} ${completed ? 'completed' : ''} ${selectedLevel?.week === num ? 'selected' : ''}`}
                  onClick={() => unlocked && setSelectedLevel(mockLevelData)}
                  disabled={!unlocked}
                >
                  <div className="level-badge">LVL {num}</div>
                  <div className="level-icon">{completed ? '⭐' : unlocked ? '▶' : '🔒'}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="level-detail-panel">
          {selectedLevel ? (
            <>
              <h2>Stage {selectedLevel.week}</h2>
              <p className="detail-desc">{region.desc}</p>
              
              <div className="detail-section">
                <h4>Objective</h4>
                {loadingSpec ? (
                  <p style={{ fontSize: '18px', color: '#8d6e63' }}>Loading from LLM...</p>
                ) : levelSpec ? (
                  <ul>
                    <li>{formatObjective(levelSpec.win)}</li>
                    <li>Finish under 60s</li>
                  </ul>
                ) : (
                  <p style={{ color: 'red', fontSize: '18px' }}>Failed to load.</p>
                )}
              </div>

              <div className="detail-section">
                <h4>Rewards</h4>
                <div className="detail-rewards">
                  <span>🪙 10</span>
                  <span>✨ 50 EXP</span>
                </div>
              </div>

              <button 
                className="btn-start-stage" 
                onClick={() => setShowMissionModal(true)}
                disabled={loadingSpec || !levelSpec}
              >
                {loadingSpec ? 'LOADING...' : 'START STAGE'}
              </button>
            </>
          ) : (
            <p className="detail-placeholder">Select a level to view details</p>
          )}
        </div>
      </div>
    </div>
  );
}