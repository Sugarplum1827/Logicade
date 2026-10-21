import { useState, useEffect } from 'react';
import MissionTargetModal from './MissionTargetModal';

export default function LevelSelect({ region, onStartLevel, onBack }) {
  const [completedLevels, setCompletedLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [showMissionModal, setShowMissionModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`logicade_levels_${region.id}`);
    setCompletedLevels(saved ? JSON.parse(saved) : []);
  }, [region.id]);

  const levels = Array.from({ length: 10 }, (_, i) => i + 1);
  const isUnlocked = (num) => num === 1 || completedLevels.includes(num - 1);

  return (
    <div className="level-select-screen" style={{ backgroundImage: `url('${region.level_bg || '/assets/subjects/library_bg.png'}')` }}>
      
      {showMissionModal && selectedLevel && (
        <MissionTargetModal 
          spec={null} // ⭐ Pass null so it uses generic text
          onStart={() => { 
            setShowMissionModal(false); 
            onStartLevel(region, selectedLevel.week, null); // ⭐ Pass null spec
          }}
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
                <ul>
                  <li>Complete the main objective</li>
                  <li>Finish under 60s</li>
                </ul>
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
              >
                START STAGE
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