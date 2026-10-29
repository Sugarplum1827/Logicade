import { useState, useEffect } from 'react';
import RegionModal from './RegionModal';
import LogoutModal from './LogoutModal';
import { walletStatusText } from '../game/walletBalance';
import course from '../../../data/curriculum.json';
import { regionProgress, readCompletedStages, validCompletedStages } from '../game/regionProgress';
import { stageCountForWeek } from '../game/stageCatalog';

const DEFAULT_SUBJECTS = [
  { id: 'cp1', title: 'Computer Programming 1' },
  { id: 'oop', title: 'Object-Oriented Programming' },
  { id: 'intro', title: 'Intro to Computing' },
];

const REGION_LAYOUTS = [
  { id: 'w1', week: 1, title: 'The Kingdom', subtitle: 'Orientation & VMGO',
    desc: 'Welcome to LogiCade! Learn the basics of the game, navigate the world, and understand your learning goals.',
    preview_image: '/assets/regions/kingdom.png', level_bg: '/assets/levels_bg/w1_kingdom.png',
    top: '48%', left: '48%' },
  { id: 'w2', week: 2, title: 'Mt. Pyre', subtitle: 'Flowcharting',
    desc: 'Define the flowchart and its uses.', preview_image: '/assets/regions/volcano.png',
    level_bg: '/assets/levels_bg/w2_volcano.png', top: '84%', left: '70%' },
  { id: 'w3', week: 3, title: 'Coastal Port', subtitle: 'Algorithms',
    desc: 'Explain the algorithm of programming.', preview_image: '/assets/regions/coast.png',
    level_bg: '/assets/levels_bg/w3_coast.png', top: '60%', left: '80%' },
  { id: 'w4', week: 4, title: 'Shadow Cave', subtitle: 'Introduction to C',
    desc: 'Dig into the history, objectives, and characteristics of C.', preview_image: '/assets/regions/cave.png',
    level_bg: '/assets/levels_bg/w4_cave.png', top: '90%', left: '25%' },
  { id: 'w5', week: 5, title: 'Mystic Forest', subtitle: 'Components of C',
    desc: 'Explore the fundamental components of C.', preview_image: '/assets/regions/forest.png',
    level_bg: '/assets/levels_bg/w5_forest.png', top: '28%', left: '82%' },
  { id: 'w6', week: 6, title: 'Snowy Hold', subtitle: 'Simple Programs and C Structure',
    desc: 'Create a simple C program and trace its execution.', preview_image: '/assets/regions/snowy.png',
    level_bg: '/assets/levels_bg/w6_snowy.png', top: '28%', left: '22%' },
  { id: 'w7', week: 7, title: 'Eldritch Ruins', subtitle: 'Basic Parts and Variable Declaration',
    desc: 'Declare typed variables and inspect changing resources.', preview_image: '/assets/regions/ruins.png',
    level_bg: '/assets/levels_bg/w7_ruins.png', top: '36%', left: '72%' },
  { id: 'w8', week: 8, title: 'Frost Peaks', subtitle: 'Local and Global Variables',
    desc: 'Observe local variables, shared state and lexical scope.', preview_image: '/assets/regions/peaks.png',
    level_bg: '/assets/levels_bg/w8_peaks.png', top: '18%', left: '35%' },
  { id: 'w9', week: 9, title: 'Sand Dunes', subtitle: 'Midterm Review and Assessment',
    desc: 'Review and demonstrate the preceding CP1 concepts.', preview_image: '/assets/regions/desert.png',
    level_bg: '/assets/levels_bg/w9_desert.png', top: '48%', left: '15%' },
];
const CP1_WEEKS=REGION_LAYOUTS.map(region=>{const lesson=course.weeks.find(w=>w.week===region.week);return {...region,subtitle:lesson.title,desc:lesson.mechanic,learningObjectives:lesson.objectives};});

export default function WorldMap({
  studentId, coins, walletStatus = { status: 'unverified' }, avatar, playerLevel, xp,
  currentSubject, onSwitchSubject, onEnterRegion, onBack, onLogout, tutorial,
}) {
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [showLogout, setShowLogout] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [subjects, setSubjects] = useState(
    DEFAULT_SUBJECTS.map((s, i) => ({ ...s, isUnlocked: i === 0 })),
  );

  const [synchronized, setSynchronized] = useState({ studentId: null, weeks: {} });
  const progress = regionProgress(localStorage, studentId, CP1_WEEKS,
    synchronized.studentId === studentId ? synchronized.weeks : {});

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('logicade_session_token');
    if (!studentId || !token) return () => { active = false; };
    // Each request is authenticated and bounded to a week. Limit concurrency
    // so opening the map does not flood the database with progress lookups.
    const weeks = CP1_WEEKS.slice();
    async function load() {
      while (weeks.length && active) {
        const region = weeks.shift();
        try {
          const response = await fetch(`/api/progress/stages?week=${region.week}`, {
            headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
          });
          if (!response.ok) continue;
          const data = await response.json();
          if (!active || localStorage.getItem('logicade_session_token') !== token) return;
          if (data.week !== region.week || !Array.isArray(data.completed_stages)) continue;
          const completed = validCompletedStages([
            ...readCompletedStages(localStorage, studentId, region.id, region.week),
            ...validCompletedStages(data.completed_stages, region.week),
          ], region.week);
          try { localStorage.setItem(`logicade_levels_${studentId}_${region.id}`, JSON.stringify(completed)); } catch { /* State still carries synchronized progress. */ }
          setSynchronized(previous => ({ studentId,
            weeks: { ...(previous.studentId === studentId ? previous.weeks : {}), [region.week]: completed },
          }));
        } catch { /* Existing local completions remain available offline. */ }
      }
    }
    Promise.all([load(), load(), load()]);
    return () => { active = false; };
  }, [studentId]);

  useEffect(() => {
    const completedKey = studentId
      ? `logicade_completed_subjects_${studentId}`
      : 'logicade_completed_subjects';
    fetch('/assets/subjects.json')
      .then((res) => (res.ok ? res.json() : Promise.reject('not found')))
      .then((data) => {
        const completedSubjects = JSON.parse(
          localStorage.getItem(completedKey) || '[]',
        );
        const updated = data.map((subj, index) => {
          let isUnlocked = index === 0;
          if (index > 0 && completedSubjects.includes(data[index - 1].id)) {
            isUnlocked = true;
          }
          return { ...subj, isUnlocked };
        });
        setSubjects(updated);
      })
      .catch(() => console.log('Using default subjects list'));
  }, [studentId]);

  const currentSubjectName =
    subjects.find((s) => s.id === currentSubject)?.title ||
    'Computer Programming 1';

  return (
    <div className="world-map-container">
      {tutorial}
      <video
        className="world-map-video"
        src={`${import.meta.env.BASE_URL}assets/world_map.mp4`}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      {showLogout && (
        <LogoutModal
          onConfirm={onLogout}
          onCancel={() => setShowLogout(false)}
        />
      )}

      <div className="hud-bar">
        <div className="hud-group">
          <div style={{ position: 'relative' }}>
            <button
              className="hud-pill"
              style={{ cursor: 'pointer', border: '2px solid #3e2723', background: 'rgba(255, 248, 225, 0.96)' }}
              onClick={() => setShowSubjectDropdown(!showSubjectDropdown)}
            >
              <span style={{ fontSize: '18px' }}>📖</span>
              <span style={{ fontFamily: 'var(--font-roboto)', fontSize: '10px' }}>
                {currentSubjectName}
              </span>
              <span style={{ fontSize: '10px' }}>▼</span>
            </button>

            {showSubjectDropdown && (
              <div className="subject-dropdown-menu">
                {subjects.map((subj) => (
                  <button
                    key={subj.id}
                    disabled={!subj.isUnlocked}
                    className={`subject-dropdown-item ${subj.id === currentSubject ? 'active' : ''} ${!subj.isUnlocked ? 'locked' : ''}`}
                    onClick={(event) => {
                      setShowSubjectDropdown(false);
                      if (subj.id !== currentSubject && subj.isUnlocked) {
                        onSwitchSubject(subj.id, event);
                      }
                    }}
                  >
                    {!subj.isUnlocked && '🔒 '}
                    {subj.id === currentSubject && '✓ '}
                    {subj.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hud-pill">
            <div className="dynamic-level-badge">
              <span className="lvl-label">LVL</span>
              <span className="lvl-number">{playerLevel}</span>
            </div>
            <div className="exp-bar-container">
              <div
                className="exp-bar-fill"
                style={{ width: `${Math.min(100, (xp / (playerLevel * 100)) * 100)}%` }}
              />
            </div>
            <span>{xp}/{playerLevel * 100}</span>
          </div>
        </div>

        <div className="hud-group">
          <div className="hud-pill" style={{ padding: '4px 10px' }} title={walletStatusText(walletStatus)} aria-label={`${coins} coins. ${walletStatusText(walletStatus)}`}>
            {avatar && !avatarError ? (
              <img
                src={avatar}
                alt="Avatar"
                className="avatar-img"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div
                className="avatar-img"
                style={{
                  background: '#5d4037',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                }}
              >
                👤
              </div>
            )}
            <img src="/assets/gold_coin.png" style={{ height: '20px' }} alt="Gold" />
            <span>{coins}</span>
            {walletStatus.status !== 'verified' && <span aria-hidden="true" style={{ fontSize: '0.65em' }}>*</span>}
          </div>
          <button className="btn-map-back" onClick={onBack} aria-label="Back to subject selection">
            SUBJECTS
          </button>
          <button className="btn-logout" onClick={() => setShowLogout(true)}>
            LOGOUT
          </button>
        </div>
      </div>

      {CP1_WEEKS.map((w) => {
        const isUnlocked = progress[w.week].unlocked;
        return (
          <button
            key={w.id}
            className={`region-node ${isUnlocked ? 'unlocked' : 'locked'}`}
            aria-label={`${w.title}, Week ${w.week}, ${isUnlocked ? 'available' : 'locked'}`}
            style={{ top: w.top, left: w.left }}
            onClick={() => setSelectedWeek(w)}
          >
            <div className="node-title">{w.title}</div>
            <div className="node-week">Week {w.week}</div>
          </button>
        );
      })}

      {selectedWeek && (
        <RegionModal
          region={selectedWeek}
          isUnlocked={progress[selectedWeek.week].unlocked}
          hasPlayed={progress[selectedWeek.week].complete}
          completedStageCount={progress[selectedWeek.week].completed.length}
          stageCount={stageCountForWeek(selectedWeek.week)}
          onClose={() => setSelectedWeek(null)}
          onEnter={(event) => {
            setSelectedWeek(null);
            onEnterRegion(selectedWeek, event);
          }}
        />
      )}
    </div>
  );
}
