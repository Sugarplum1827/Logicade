import { useState, useEffect } from 'react';
import RegionModal from './RegionModal';
import LogoutModal from './LogoutModal';

const DEFAULT_SUBJECTS = [
  { id: 'cp1', title: 'Computer Programming 1' },
  { id: 'oop', title: 'Object-Oriented Programming' },
  { id: 'intro', title: 'Intro to Computing' }
];

const CP1_WEEKS = [
  { 
    id: 'w1', week: 1, title: 'The Kingdom', subtitle: 'Orientation & VMGO', 
    desc: 'Welcome to LogiCade! Learn the basics of the game, navigate the world, and understand your learning goals.',
    keyTopics: ['Game Basics', 'Navigation', 'NPC Interaction', 'VMGO'],
    preview_image: '/assets/regions/kingdom.png',
    level_bg: '/assets/levels_bg/w1_kingdom.png',
    top: '48%', left: '48%' 
  },
  { 
    id: 'w2', week: 2, title: 'Mt. Pyre', subtitle: 'Flowcharting', 
    desc: 'Define the flowchart and its uses. The flowing lava represents the sequential steps of a program.',
    keyTopics: ['Flowcharts', 'Sequential Logic', 'Algorithm Steps'],
    preview_image: '/assets/regions/volcano.png',
    level_bg: '/assets/levels_bg/w2_volcano.png',
    top: '84%', left: '70%' 
  },
  { 
    id: 'w3', week: 3, title: 'Coastal Port', subtitle: 'Algorithms', 
    desc: 'Explain the algorithm of programming. Just as ships need a strict sequence to dock, programs need algorithms.',
    keyTopics: ['Algorithms', 'Step-by-Step Logic', 'Problem Solving'],
    preview_image: '/assets/regions/coast.png',
    level_bg: '/assets/levels_bg/w3_coast.png',
    top: '60%', left: '80%' 
  },
  { 
    id: 'w4', week: 4, title: 'Shadow Cave', subtitle: 'Introduction to C', 
    desc: 'Dig into the history, objectives, and characteristics of the C programming language.',
    keyTopics: ['History of C', 'Advantages', 'Classification', 'Syntax'],
    preview_image: '/assets/regions/cave.png',
    level_bg: '/assets/levels_bg/w4_cave.png',
    top: '90%', left: '25%' 
  },
  { 
    id: 'w5', week: 5, title: 'Mystic Forest', subtitle: 'Components of C', 
    desc: 'Explore the fundamental components, reserved words, and structure of C.',
    keyTopics: ['Preprocessor', 'Reserved Words', 'Structure of C'],
    preview_image: '/assets/regions/forest.png',
    level_bg: '/assets/levels_bg/w5_forest.png',
    top: '28%', left: '82%' 
  },
  { 
    id: 'w6', week: 6, title: 'Snowy Hold', subtitle: 'Basic Parts & Variables', 
    desc: 'Learn to store and hold data. Describe the basic parts of C and how to declare variables.',
    keyTopics: ['Variable Declaration', 'Data Types', 'Basic Parts'],
    preview_image: '/assets/regions/snowy.png',
    level_bg: '/assets/levels_bg/w6_snowy.png',
    top: '28%', left: '22%' 
  },
  { 
    id: 'w7', week: 7, title: 'Eldritch Ruins', subtitle: 'Local & Global Variables', 
    desc: 'Understand scope and lifetime. Sample programs using local and global variables.',
    keyTopics: ['Local Variables', 'Global Variables', 'Scope'],
    preview_image: '/assets/regions/ruins.png',
    level_bg: '/assets/levels_bg/w7_ruins.png',
    top: '36%', left: '72%' 
  },
  { 
    id: 'w8', week: 8, title: 'Frost Peaks', subtitle: 'Control Flow & Comparisons', 
    desc: 'Master compound comparisons, conditions, and control flow statements.',
    keyTopics: ['If-Else', 'Boolean Logic', 'Compound Comparisons'],
    preview_image: '/assets/regions/peaks.png',
    level_bg: '/assets/levels_bg/w8_peaks.png',
    top: '18%', left: '35%' 
  },
  { 
    id: 'w9', week: 9, title: 'Sand Dunes', subtitle: 'Loops & Automation', 
    desc: 'Master iterations and loops. The endless waves of sand mirror the endless cycle of a loop.',
    keyTopics: ['For Loops', 'While Loops', 'Iteration'],
    preview_image: '/assets/regions/desert.png',
    level_bg: '/assets/levels_bg/w9_desert.png',
    top: '48%', left: '15%' 
  }
];

export default function WorldMap({ coins, avatar, currentSubject, onSwitchSubject, onEnterRegion, onLogout }) {
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [showLogout, setShowLogout] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS.map((s, i) => ({ ...s, isUnlocked: i === 0 })));

  const playedRegions = JSON.parse(localStorage.getItem('logicade_played_regions') || '{}');

  useEffect(() => {
    fetch('/assets/subjects.json')
      .then(res => res.ok ? res.json() : Promise.reject('not found'))
      .then(data => {
        const completedSubjects = JSON.parse(localStorage.getItem('logicade_completed_subjects') || '[]');
        const updated = data.map((subj, index) => {
          let isUnlocked = index === 0;
          if (index > 0 && completedSubjects.includes(data[index - 1].id)) isUnlocked = true;
          return { ...subj, isUnlocked };
        });
        setSubjects(updated);
      })
      .catch(() => {
        console.log("Using default subjects list");
      });
  }, []);

  const currentSubjectName = subjects.find(s => s.id === currentSubject)?.title || 'Computer Programming 1';

  return (
    <div className="world-map-container" style={{ backgroundImage: "url('/assets/world_map_bg.png')" }}>
      
      {showLogout && <LogoutModal onConfirm={onLogout} onCancel={() => setShowLogout(false)} />}

      {/* TOP HUD */}
      <div className="hud-bar">
        <div className="hud-group">
          {/* SUBJECT DROPDOWN */}
          <div style={{ position: 'relative' }}>
            <button 
              className="hud-pill" 
              style={{ cursor: 'pointer', border: '2px solid #3e2723', background: 'rgba(255, 248, 225, 0.96)' }}
              onClick={() => setShowSubjectDropdown(!showSubjectDropdown)}
            >
              <span style={{ fontSize: '14px' }}>📖</span>
              <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '10px' }}>{currentSubjectName}</span>
              <span style={{ fontSize: '10px' }}>▼</span>
            </button>

            {showSubjectDropdown && (
              <div className="subject-dropdown-menu">
                {subjects.map((subj) => (
                  <button
                    key={subj.id}
                    disabled={!subj.isUnlocked}
                    className={`subject-dropdown-item ${subj.id === currentSubject ? 'active' : ''} ${!subj.isUnlocked ? 'locked' : ''}`}
                    onClick={() => {
                      setShowSubjectDropdown(false);
                      if (subj.id !== currentSubject && subj.isUnlocked) {
                        onSwitchSubject(subj.id);
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
              <span className="lvl-number">1</span>
            </div>
            <div className="exp-bar-container"><div className="exp-bar-fill"></div></div>
            <span>0/100</span>
          </div>
        </div>
        
        <div className="hud-group">
          <div className="hud-pill" style={{ padding: '4px 10px' }}>
            {avatar && !avatarError ? (
              <img src={avatar} alt="Avatar" className="avatar-img" onError={() => setAvatarError(true)} />
            ) : (
              <div className="avatar-img" style={{ background: '#5d4037', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>👤</div>
            )}
            <img src="/assets/gold_coin.png" style={{height: '20px'}} alt="Gold" />
            <span>{coins}</span>
          </div>
          <button className="btn-logout" onClick={() => setShowLogout(true)}>LOGOUT</button>
        </div>
      </div>

      {/* MAP NODES */}
      {CP1_WEEKS.map((w, index) => {
        const isUnlocked = index === 0 || playedRegions[CP1_WEEKS[index - 1].id];
        return (
          <button
            key={w.id}
            className={`region-node ${isUnlocked ? 'unlocked' : 'locked'}`}
            style={{ top: w.top, left: w.left }}
            onClick={() => setSelectedWeek(w)}
          >
            <div className="node-title">{w.title}</div>
            <div className="node-week">Week {w.week}</div>
          </button>
        );
      })}

      {/* REGION MODAL */}
      {selectedWeek && (
        <RegionModal 
          region={selectedWeek}
          isUnlocked={selectedWeek.week === 1 || playedRegions[CP1_WEEKS[selectedWeek.week - 2].id]}
          onClose={() => setSelectedWeek(null)}
          onEnter={() => { setSelectedWeek(null); onEnterRegion(selectedWeek); }}
        />
      )}
    </div>
  );
}