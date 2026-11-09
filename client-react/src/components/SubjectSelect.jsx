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
  const [featuredIndex, setFeaturedIndex] = useState(0);
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

  const featured = subjects[featuredIndex] || subjects[0];
  const goTo = (offset) => setFeaturedIndex((index) => (index + subjects.length + offset) % subjects.length);
  const slots = [-1, 0, 1].map(offset => ({
    offset,
    subject: subjects[(featuredIndex + subjects.length + offset) % subjects.length],
  }));

  return (
    <main className="subject-select-screen">
      {tutorial}
      {showLogout && <LogoutModal onConfirm={onLogout} onCancel={() => setShowLogout(false)} />}
      <header className="realm-subject-header">
        <h1 className="realm-plaque">Choose a Subject</h1>
        <button type="button" className="realm-button realm-button-red" onClick={() => setShowLogout(true)}>Logout</button>
      </header>

      <section className="realm-carousel" aria-label="Subjects">
        <button type="button" className="realm-carousel-arrow realm-button realm-button-gold"
          aria-label="Previous subject" onClick={() => goTo(-1)}>‹</button>
        {slots.map(({ offset, subject }) => (
          <article key={offset} className={`realm-subject-card realm-paper ${offset === 0 ? 'is-featured' : 'is-side'} ${subject.unlocked ? '' : 'is-locked'}`}>
            <h2 className="realm-plaque">{subject.unlocked ? subject.title : 'Locked'}</h2>
            <div className="realm-subject-art">
              <img src={subject.image || '/assets/subjects/cp1_icon.png'} alt="" />
              {!subject.unlocked && <img className="realm-subject-lock" src="/assets/lock_icon.png" alt="" />}
            </div>
            <p>{subject.unlocked ? subject.desc : subject.title}</p>
            {offset === 0 && (
              <button type="button" className="realm-button" disabled={!subject.unlocked} onClick={(event) => onSelectSubject(subject.id, event)}>
                {subject.unlocked ? 'Select Subject' : 'Complete the previous subject'}
              </button>
            )}
          </article>
        ))}
        <button type="button" className="realm-carousel-arrow realm-button realm-button-gold"
          aria-label="Next subject" onClick={() => goTo(1)}>›</button>
      </section>
      <div className="realm-carousel-dots" role="group" aria-label="Choose featured subject">
        {subjects.map((subject) => (
          <button type="button" key={subject.id} aria-label={subject.title} aria-pressed={subject.id === featured.id}
            onClick={() => setFeaturedIndex(subjects.indexOf(subject))}><span /></button>
        ))}
      </div>
    </main>
  );
}
