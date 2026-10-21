import { useState, useEffect } from 'react';
import LogoutModal from './LogoutModal';

// Fallback data in case the JSON fails to load
const DEFAULT_SUBJECTS = [
  {
    id: 'cp1',
    title: 'CP1 - Introduction to Programming',
    desc: 'Learn programming fundamentals, algorithms, flowcharts, and C language.',
    image: '/assets/subjects/cp1_icon.png',
  },
  { id: 'oop', title: 'Object-Oriented Programming', desc: 'Master Java, classes, and objects.', image: null },
  { id: 'intro', title: 'Intro to Computing', desc: 'Learn the basics of hardware and software.', image: null }
];

export default function SubjectSelect({ studentId, onSelectSubject, onLogout }) {
  const [showLogout, setShowLogout] = useState(false);
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS);

  useEffect(() => {
    // Fetch from /assets/ to bypass the Python backend proxy
    fetch('/assets/subjects.json')
      .then(res => {
        if (!res.ok) throw new Error("JSON not found");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const completedSubjects = JSON.parse(localStorage.getItem('logicade_completed_subjects') || '[]');
          const updatedSubjects = data.map((subj, index) => {
            let isUnlocked = index === 0; 
            if (index > 0 && completedSubjects.includes(data[index - 1].id)) isUnlocked = true;
            return { ...subj, unlocked: isUnlocked };
          });
          setSubjects(updatedSubjects);
        }
      })
      .catch(err => console.log("Using default subjects (JSON failed to load)"));
  }, []);

  return (
    <div className="subject-select-screen">
      {showLogout && <LogoutModal onConfirm={onLogout} onCancel={() => setShowLogout(false)} />}

      <div className="subject-header">
        <div className="header-left">
          <div className="logicade-badge">
            <span className="logo-text">Logi<span style={{color: '#ffca28'}}>Cade</span></span>
          </div>
          <div className="header-title-box">
            <h1>CHOOSE YOUR SUBJECT</h1>
            <p>Select a subject to begin your adventure.</p>
          </div>
        </div>
        
        {/* ONLY THE LOGOUT BUTTON - PROFILE BOX IS GONE */}
        <div className="header-right">
          <button className="btn-logout-header" onClick={() => setShowLogout(true)}>LOGOUT</button>
        </div>
      </div>

      <div className="subject-grid-container">
        <div className="subject-grid">
          {subjects.map((subj, index) => {
            // If a subject is past index 0 and the previous isn't in completed, it's locked
            const isUnlocked = index === 0 || subjects[index - 1].completed;

            return (
              <div key={subj.id} className={`subject-card ${isUnlocked ? 'unlocked' : 'locked'}`}>
                <div className="card-header">
                  {isUnlocked ? subj.title : 'LOCKED SUBJECT'}
                </div>
                <div className="card-image-area">
                  {isUnlocked && subj.image ? (
                    <img 
                      src={subj.image} 
                      alt={subj.title} 
                      className="subject-icon-img" 
                      onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.classList.add('fallback-img'); }}
                    />
                  ) : (
                    <div className="empty-image-placeholder"></div>
                  )}
                </div>
                <div className="card-desc">
                  {isUnlocked ? subj.desc : 'Complete previous subjects to unlock.'}
                </div>
                <button 
                  className={`btn-select-subject ${isUnlocked ? '' : 'disabled'}`}
                  onClick={() => isUnlocked && onSelectSubject(subj.id)}
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