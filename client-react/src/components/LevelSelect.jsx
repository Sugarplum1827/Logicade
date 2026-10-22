import { useState, useEffect } from 'react';
import MissionTargetModal from './MissionTargetModal';

export default function LevelSelect({ studentId, region, onStartLevel, onBack }) {
  const [completedLevels, setCompletedLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedSpec, setSelectedSpec] = useState(null);
  const [selectedMeta, setSelectedMeta] = useState(null);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [prefetching, setPrefetching] = useState(false);

  const progressKey = `logicade_levels_${studentId}_${region.id}`;

  useEffect(() => {
    const saved = localStorage.getItem(progressKey);
    setCompletedLevels(saved ? JSON.parse(saved) : []);
  }, [progressKey]);

  const levels = Array.from({ length: 10 }, (_, i) => i + 1);
  const isUnlocked = (num) => num === 1 || completedLevels.includes(num - 1);

  const handleSelectLevel = (num) => {
    setSelectedLevel({ week: num, title: `Stage ${num}`, subtitle: region.subtitle });
    setSelectedSpec(null);
    setSelectedMeta(null);
  };

  const handleStartStage = async () => {
    if (!selectedLevel || prefetching) return;
    setPrefetching(true);

    let spec = null;
    let meta = null;
    try {
      const week = selectedLevel.week;
      const res = await fetch('/serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          week,
          level: week,
          difficulty: 'standard',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        spec = data.spec;
        meta = data.meta;
      } else {
        console.warn('[LevelSelect] /serve failed:', res.status);
      }
    } catch (e) {
      console.warn('[LevelSelect] prefetch failed:', e);
    }

    setSelectedSpec(spec);
    setSelectedMeta(meta);
    setPrefetching(false);
    setShowMissionModal(true);
  };

  return (
    <div
      className="level-select-screen"
      style={{
        backgroundImage: `url('${region.level_bg || '/assets/subjects/library_bg.png'}')`,
      }}
    >
      {showMissionModal && selectedLevel && (
        <MissionTargetModal
          spec={selectedSpec}
          onStart={(event) => {
            setShowMissionModal(false);
            onStartLevel(region, selectedLevel.week, selectedSpec, selectedMeta, event);
          }}
          onCancel={() => setShowMissionModal(false)}
        />
      )}

      <div className="level-header">
        <button className="btn-back" onClick={onBack}>
          ← BACK TO MAP
        </button>
        <div className="level-header-info">
          <h1>{region.title}</h1>
          <p>{region.subtitle}</p>
        </div>
        <div style={{ width: '150px' }} />
      </div>

      <div className="level-layout">
        <div className="levels-container">
          <div className="levels-grid">
            {levels.map((num) => {
              const unlocked = isUnlocked(num);
              const completed = completedLevels.includes(num);
              return (
                <button
                  key={num}
                  className={`level-node ${unlocked ? 'unlocked' : 'locked'} ${
                    completed ? 'completed' : ''
                  } ${selectedLevel?.week === num ? 'selected' : ''}`}
                  onClick={() => unlocked && handleSelectLevel(num)}
                  disabled={!unlocked}
                >
                  <div className="level-badge">LVL {num}</div>
                  <div className="level-icon">
                    {completed ? '⭐' : unlocked ? '▶' : '🔒'}
                  </div>
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
                onClick={handleStartStage}
                disabled={prefetching}
              >
                {prefetching ? 'LOADING…' : 'START STAGE'}
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
