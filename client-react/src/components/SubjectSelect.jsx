import { useState, useEffect } from 'react';
import LogoutModal from './LogoutModal';

const DEFAULT_SUBJECTS = [
  {
    id: 'cp1',
    title: 'CP1 - Introduction to Programming',
    desc: 'Learn programming fundamentals, algorithms, flowcharts, and C language.',
    image: '/assets/subjects/cp1_icon.png',
  },
  { id: 'oop', title: 'Object-Oriented Programming', desc: 'Master Java, classes, and objects.', image: null },
  { id: 'intro', title: 'Intro to Computing', desc: 'Learn the basics of hardware and software.', image: null },
];

export default function SubjectSelect({ studentId, onSelectSubject, onLogout, tutorial }) {
  const [showLogout, setShowLogout] = useState(false);
  const [subjects, setSubjects] = useState(
    DEFAULT_SUBJECTS.map((s, i) => ({ ...s, unlocked: i === 0 })),
  );

  useEffect(() => {
    const completedKey = studentId
      ? `logicade_completed_subjects_${studentId}`
      : 'logicade_completed_subjects';

    fetch('/assets/subjects.json')
      .then((res) => {
        if (!res.ok) throw new Error('JSON not found');
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const completedSubjects = JSON.parse(
          localStorage.getItem(completedKey) || '[]',
        );
        const updatedSubjects = data.map((subj, index) => {
          let isUnlocked = index === 0;
          if (index > 0 && completedSubjects.includes(data[index - 1].id)) {
            isUnlocked = true;
          }
          return { ...subj, unlocked: isUnlocked };
        });
        setSubjects(updatedSubjects);
      })
      .catch(() => console.log('Using default subjects (JSON failed to load)'));
  }, [studentId]);

  return (
    <div className="subject-select-screen">
      {tutorial}
      {showLogout && (
        <LogoutModal
          onConfirm={onLogout}
          onCancel={() => setShowLogout(false)}
        />
      )}

      <div className="subject-header">
        <div className="header-left">
          <div className="logicade-badge">
            <span className="logo-text">
              Logi<span style={{ color: '#ffca28' }}>Cade</span>
            </span>
          </div>
          <div className="header-title-box">
            <h1>CHOOSE YOUR SUBJECT</h1>
            <p>Select a subject to begin your adventure.</p>
          </div>
        </div>

        <div className="header-right">
          <button
            className="btn-logout-header"
            onClick={() => setShowLogout(true)}
          >
            LOGOUT
          </button>
        </div>
      </div>

      <div className="subject-grid-container">
        <div className="subject-grid">
          {subjects.map((subj) => {
            const isUnlocked = !!subj.unlocked;
            return (
              <div
                key={subj.id}
                className={`subject-card ${isUnlocked ? 'unlocked' : 'locked'}`}
              >
                <div className="card-header">
                  {isUnlocked ? subj.title : 'LOCKED SUBJECT'}
                </div>
                <div className="card-image-area">
                  {isUnlocked && subj.image ? (
                    <img
                      src={subj.image}
                      alt={subj.title}
                      className="subject-icon-img"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.classList.add('fallback-img');
                      }}
                    />
                  ) : (
                    <div className="empty-image-placeholder" />
                  )}
                </div>
                <div className="card-desc">
                  {isUnlocked
                    ? subj.desc
                    : 'Complete previous subjects to unlock.'}
                </div>
                <button
                  className={`btn-select-subject ${isUnlocked ? '' : 'disabled'}`}
                  onClick={(event) => isUnlocked && onSelectSubject(subj.id, event)}
                  disabled={!isUnlocked}
                >
                  SELECT SUBJECT
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
