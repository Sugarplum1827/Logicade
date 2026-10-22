import { useRef, useState, useEffect } from 'react';
import MissionTargetModal from './MissionTargetModal';

function displayText(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const text = value.message ?? value.text ?? value.description ?? value.objective;
    if (text != null) {
      const prefix = value.step != null ? `Step ${value.step}: ` : '';
      return `${prefix}${displayText(text)}`;
    }
  }
  return '';
}

export default function LevelSelect({ studentId, region, onStartLevel, onBack }) {
  const [completedLevels, setCompletedLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedSpec, setSelectedSpec] = useState(null);
  const [selectedMeta, setSelectedMeta] = useState(null);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  const [loadError, setLoadError] = useState('');
  const selectionRequest = useRef(0);

  const progressKey = `logicade_levels_${studentId}_${region.id}`;

  useEffect(() => {
    const saved = localStorage.getItem(progressKey);
    setCompletedLevels(saved ? JSON.parse(saved) : []);
  }, [progressKey]);

  const levels = Array.from({ length: 10 }, (_, i) => i + 1);
  const isUnlocked = (num) => num === 1 || completedLevels.includes(num - 1);

  const handleSelectLevel = async (num) => {
    const requestId = ++selectionRequest.current;
    setSelectedLevel({ level: num, title: `Stage ${num}`, subtitle: region.subtitle });
    setSelectedSpec(null);
    setSelectedMeta(null);
    setLoadError('');
    setShowMissionModal(false);
    setPrefetching(true);

    try {
      const res = await fetch('/serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          week: region.week || 1,
          level: num,
          difficulty: 'standard',
        }),
      });
      if (!res.ok) throw new Error(`Challenge request failed (${res.status})`);
      const data = await res.json();
      if (requestId !== selectionRequest.current) return;
      setSelectedSpec(data.spec || null);
      setSelectedMeta(data.meta || null);
      if (!data.spec) throw new Error('The server returned no challenge JSON.');
    } catch (error) {
      if (requestId === selectionRequest.current) {
        console.warn('[LevelSelect] challenge load failed:', error);
        setLoadError('Could not load a challenge. Select the level to try again.');
      }
    } finally {
      if (requestId === selectionRequest.current) setPrefetching(false);
    }
  };

  const cancelPreview = () => {
    selectionRequest.current += 1;
    setSelectedLevel(null);
    setSelectedSpec(null);
    setSelectedMeta(null);
    setShowMissionModal(false);
    setPrefetching(false);
    setLoadError('');
  };

  const objectiveRows = selectedSpec
    ? [
        ['Objective', selectedSpec.player_objective],
        ...(Array.isArray(selectedSpec.secondary_objectives)
          ? selectedSpec.secondary_objectives.map((objective, index) => [`Goal ${index + 1}`, objective])
          : []),
        ['Win', selectedSpec.win_condition],
        ['Lose', selectedSpec.lose_condition],
      ].filter(([, value]) => displayText(value))
    : [];

  return (
    <div
      className="level-select-screen"
      style={{
        backgroundImage: `url('${region.level_bg || '/assets/subjects/library_bg.png'}')`,
      }}
    >
      {showMissionModal && selectedLevel && selectedSpec && (
        <MissionTargetModal
          spec={selectedSpec}
          onStart={() => {
            setShowMissionModal(false);
            onStartLevel(region, selectedLevel.level, selectedSpec, selectedMeta);
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
                  } ${selectedLevel?.level === num ? 'selected' : ''}`}
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
              <h2>Stage {selectedLevel.level}</h2>
              {prefetching && <p className="detail-desc">Loading this level’s challenge…</p>}
              {loadError && <p className="detail-desc" role="alert">{loadError}</p>}

              {objectiveRows.length > 0 && (
                <div className="detail-section rok-objectives level-preview-objectives">
                  <h4>Mission Objectives</h4>
                  {objectiveRows.map(([label, value]) => (
                    <div className="rok-objective-item" key={label}>
                      <span className="rok-star">{label === 'Objective' ? '⭐' : label === 'Win' ? '✔' : '✘'}</span>
                      <span><strong>{label}:</strong> {displayText(value)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="detail-section">
                <h4>Rewards</h4>
                <div className="detail-rewards">
                  <span>🪙 10</span>
                  <span>✨ 50 EXP</span>
                </div>
              </div>

              <button
                className="btn-start-stage"
                onClick={() => selectedSpec && setShowMissionModal(true)}
                disabled={prefetching || !selectedSpec}
              >
                {prefetching ? 'LOADING…' : 'VIEW MISSION'}
              </button>
              <button className="btn-cancel-preview" onClick={cancelPreview} disabled={prefetching}>
                CANCEL
              </button>
            </>
          ) : (
            <p className="detail-placeholder">Select an unlocked level to load its challenge and objectives.</p>
          )}
        </div>
      </div>
    </div>
  );
}
