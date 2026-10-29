import { useEffect, useMemo, useRef, useState } from 'react';
import MissionTargetModal from './MissionTargetModal';
import OracleDialogue from './OracleDialogue';
import { selectTemplateForDescription } from '../game/templates/runtime';
import { isDifficulty } from '../game/difficultyDecisions';
import { stageCountForWeek } from '../game/stageCatalog';

function readLocalProgress(progressKey) {
  try {
    const saved = localStorage.getItem(progressKey);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((value) => Number.isInteger(value) && value >= 1 && value <= 10) : [];
  } catch {
    return [];
  }
}

export default function LevelSelect({ studentId, region, difficultyAssignments = {}, onResolveDifficulty, onStartLevel, onPrepareMission, onReleasePackage, onBack, tutorialStep = 0, onAdvanceTutorial }) {
  const progressKey = `logicade_levels_${studentId}_${region.id}`;
  const localCompletedLevels = useMemo(() => readLocalProgress(progressKey), [progressKey]);
  const [serverProgress, setServerProgress] = useState({ key: null, completed: [], recommended: null });
  const completedLevels = [...new Set([
    ...localCompletedLevels,
    ...(serverProgress.key === progressKey ? serverProgress.completed : []),
  ])].sort((a, b) => a - b);
  const recommendedStage = serverProgress.key === progressKey ? serverProgress.recommended : null;
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedSpec, setSelectedSpec] = useState(null);
  const [selectedMeta, setSelectedMeta] = useState(null);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  const [starting, setStarting] = useState(false);
  const [preparedPackage, setPreparedPackage] = useState(null);
  const [startError, setStartError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [showKingdomTutorial, setShowKingdomTutorial] = useState(false);
  const selectionRequest = useRef(0);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('logicade_session_token') || '';
    const week = Number(region.week);
    if (!studentId || !token || !Number.isInteger(week) || week < 1 || week > 9) return () => { active = false; };

    fetch(`/api/progress/stages?week=${week}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Progress request failed (${response.status})`);
      return response.json();
    }).then((progress) => {
      if (!active) return;
      const synchronized = Array.isArray(progress.completed_stages)
        ? progress.completed_stages.filter((stage) => Number.isInteger(stage) && stage >= 1 && stage <= 10)
        : [];
      const local = readLocalProgress(progressKey);
      const merged = [...new Set([...local, ...synchronized])].sort((a, b) => a - b);
      localStorage.setItem(progressKey, JSON.stringify(merged));
      const recommendation = progress.active_stage ?? progress.next_stage;
      setServerProgress({
        key: progressKey,
        completed: merged,
        recommended: Number.isInteger(recommendation) && recommendation >= 1 && recommendation <= 10
          ? recommendation : null,
      });
    }).catch((error) => {
      // Local progress remains playable while offline or when server progress is unavailable.
      console.info('[progress] keeping local stage progress:', error?.message || error);
    });

    return () => { active = false; };
  }, [studentId, region.id, region.week, progressKey]);


  // The opening region is intentionally only the prologue and its flowchart puzzle.
  // Other regional pools remain in the data catalog for later curriculum release.
  const visibleStageCount = stageCountForWeek(region.week);
  const levels = Array.from({ length: visibleStageCount }, (_, i) => i + 1);
  const isUnlocked = (num) => num === 1 || completedLevels.includes(num - 1);

  const handleSelectLevel = async (num) => {
    if (num === 1 && Number(region.week) === 1 && tutorialStep === 4) setShowKingdomTutorial(true);
    const requestId = ++selectionRequest.current;
    setSelectedLevel({ level: num, title: `Stage ${num}`, subtitle: region.subtitle });
    setSelectedSpec(null);
    setSelectedMeta(null);
    setLoadError('');
    setShowMissionModal(false);
    setPrefetching(true);

    try {
      const assignedDifficulty = onResolveDifficulty
        ? await onResolveDifficulty(num, region)
        : difficultyAssignments[num] || (num === 1 ? 'standard' : null);
      if (requestId !== selectionRequest.current) return;
      if (!isDifficulty(assignedDifficulty)) throw Object.assign(new Error('No saved difficulty decision exists for this stage.'), {
        userMessage: 'The previous stage’s difficulty history is unavailable. Synchronize this account before continuing.',
      });
      const res = await fetch('/serve', {
        method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('logicade_session_token') || ''}` },
        body: JSON.stringify({
          student_id: studentId,
          week: region.week || 1,
          level: num,
          difficulty: assignedDifficulty,
        }),
      });
      if (!res.ok) throw new Error(`Challenge request failed (${res.status})`);
      const data = await res.json();
      if (requestId !== selectionRequest.current) return;
      if (!data.spec) throw new Error('The server returned no challenge JSON.');
      let selectedSpec = data.spec;
      let selectedMeta = data.meta || null;
      if (!selectedMeta?.generated_game?.variation_id) {
        try {
          selectedSpec = await selectTemplateForDescription(data.spec, region.week || 1, num, 0);
          selectedMeta = { ...selectedMeta, ...selectedSpec.phaser_template };
        } catch (templateError) {
          console.warn('[LevelSelect] template selection unavailable; retaining the existing Phaser renderer:', templateError);
        }
      }
      if (requestId !== selectionRequest.current) return;
      setSelectedSpec(selectedSpec);
      setSelectedMeta(selectedMeta);
    } catch (error) {
      if (requestId === selectionRequest.current) {
        console.warn('[LevelSelect] challenge load failed:', error);
        setLoadError(error?.userMessage || 'Could not load a challenge. Select the level to try again.');
      }
    } finally {
      if (requestId === selectionRequest.current) setPrefetching(false);
    }
  };

  const openMissionPreview = async () => {
    if (starting || !selectedSpec || !selectedLevel) return;
    const requestId = selectionRequest.current;
    setStarting(true);
    setStartError('');
    try {
      const prepared = await onPrepareMission(selectedSpec, selectedMeta);
      if (requestId !== selectionRequest.current) {
        if (prepared?.package_id) await onReleasePackage?.(prepared.package_id);
        return;
      }
      setPreparedPackage(prepared);
      setShowMissionModal(true);
    } catch (error) {
      if (requestId === selectionRequest.current) {
        setStartError(error?.message || 'Could not prepare this game. Please try again.');
      }
    } finally {
      setStarting(false);
    }
  };

  const cancelMissionPreview = async () => {
    const packageId = preparedPackage?.package_id;
    setPreparedPackage(null);
    setShowMissionModal(false);
    setStartError('');
    if (packageId) {
      try {
        await onReleasePackage?.(packageId);
      } catch (error) {
        // The server removes abandoned extraction leases after 24 hours.
        console.warn('[package] cancelled preview cleanup deferred:', error);
      }
    }
  };

  const selectedGameDescription = selectedMeta?.game_description;
  const modalDescription = preparedPackage?.game_description || selectedGameDescription;
  const missionSpec = modalDescription
    ? {
        ...selectedSpec,
        game_title: modalDescription.title || preparedPackage?.generated_game?.display_name || selectedMeta?.generated_game?.display_name || selectedSpec?.game_title,
        player_objective: modalDescription.objective || selectedSpec?.player_objective,
        win_condition: modalDescription.win_condition || selectedSpec?.win_condition,
        lose_condition: modalDescription.lose_condition || selectedSpec?.lose_condition,
        hint: modalDescription.hint || selectedSpec?.hint,
        phaser_template: {
          ...(selectedSpec?.phaser_template || {}),
          display_name: preparedPackage?.generated_game?.display_name || selectedMeta?.generated_game?.display_name,
          variation_title: preparedPackage?.generated_game?.variation_title || selectedMeta?.generated_game?.variation_title,
          variation_id: preparedPackage?.generated_game?.variation_id || selectedMeta?.generated_game?.variation_id,
        },
      }
    : selectedSpec;

  return (
    <div
      className="level-select-screen"
      style={{
        backgroundImage: `url('${region.level_bg || '/assets/subjects/library_bg.png'}')`,
      }}
    >
      {showKingdomTutorial && (
        <OracleDialogue
          step={4}
          title="Keeper of the surviving records"
          text="You opened the first Kingdom level. Read its objective and reward details here. Select View Mission to inspect the challenge, then Start to play. Completing it for the first time earns 10 coins and 50 XP."
          onNext={() => {
            setShowKingdomTutorial(false);
            onAdvanceTutorial?.(5);
          }}
        />
      )}
      {showMissionModal && selectedLevel && selectedSpec && (
        <MissionTargetModal
          spec={missionSpec}
          starting={starting}
          error={startError}
          onStart={async () => {
            if (starting) return;
            setStarting(true);
            setStartError('');
            try {
              await onStartLevel(region, selectedLevel.level, selectedSpec, selectedMeta, preparedPackage);
              setShowMissionModal(false);
            } catch (error) {
              setStartError(error?.message || 'Could not prepare this game. Please try again.');
            } finally {
              setStarting(false);
            }
          }}
          onCancel={() => !starting && cancelMissionPreview()}
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
          <div className={`levels-grid${visibleStageCount === 2 ? ' levels-grid--intro' : ''}`}>
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

        <div className={`level-detail-panel ${selectedLevel ? 'has-selection' : 'is-empty'}`} aria-live="polite">
          {selectedLevel ? (
            <>
              <div className="level-detail-stage">
                <span className="level-detail-eyebrow">CP1 STAGE</span>
                <h2>Stage {selectedLevel.level}</h2>
                <span className="level-detail-status">
                  {completedLevels.includes(selectedLevel.level)
                    ? '★ CLEARED'
                    : selectedLevel.level === recommendedStage
                      ? prefetching ? 'LOADING CHALLENGE…' : '▶ CONTINUE HERE'
                    : prefetching ? 'LOADING CHALLENGE…' : '▶ READY'}
                </span>
                {(loadError || startError) && (
                  <small className="level-detail-error" role="alert">{loadError || startError}</small>
                )}
              </div>

              <div className="level-detail-rewards" aria-label="First completion rewards">
                <span className="level-detail-rewards-title">FIRST COMPLETION REWARDS</span>
                <div className="level-detail-reward-items">
                  {completedLevels.includes(selectedLevel.level) ? (
                    <span className="level-detail-claimed">★ CLAIMED</span>
                  ) : (
                    <>
                      <span className="level-detail-reward"><span aria-hidden="true">🪙</span><b>10</b></span>
                      <span className="level-detail-reward"><span aria-hidden="true">✨</span><b>50 XP</b></span>
                    </>
                  )}
                </div>
              </div>

              <button
                className="btn-start-stage"
                onClick={openMissionPreview}
                disabled={prefetching || starting || !selectedSpec}
              >
                {starting && !showMissionModal ? 'PREPARING…' : prefetching ? 'LOADING…' : 'CHALLENGE'}
              </button>
            </>
          ) : (
            <>
              <div className="level-detail-stage">
                <span className="level-detail-eyebrow">YOUR ADVENTURE</span>
                <h2>Select a Stage</h2>
                <span className="level-detail-status">CHOOSE AN UNLOCKED LEVEL</span>
              </div>
              <div className="level-detail-rewards" aria-label="First completion rewards">
                <span className="level-detail-rewards-title">FIRST COMPLETION REWARDS</span>
                <div className="level-detail-reward-items">
                  <span className="level-detail-reward"><span aria-hidden="true">🪙</span><b>10</b></span>
                  <span className="level-detail-reward"><span aria-hidden="true">✨</span><b>50 XP</b></span>
                </div>
              </div>
              <button className="btn-start-stage" type="button" disabled>CHALLENGE</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
