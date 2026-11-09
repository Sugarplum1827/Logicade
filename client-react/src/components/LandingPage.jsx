import { useState } from 'react';
import course from '../../../data/curriculum.json';
import RealmModal from './RealmModal';
import SettingsModal from './SettingsModal';

export default function LandingPage({ onStart, musicEnabled, onToggleMusic }) {
  const [panel, setPanel] = useState(null);
  const closePanel = () => setPanel(null);

  return (
    <main className="landing-container">
      <header className="realm-landing-header">
        <nav aria-label="Main navigation">
          <button type="button" className="realm-nav-current" aria-current="page" onClick={closePanel}>Home</button>
          <button type="button" onClick={() => setPanel('Regions')}>Regions</button>
          <button type="button" onClick={() => setPanel('About')}>About</button>
        </nav>
        <div className="realm-landing-tools">
          <button type="button" onClick={() => setPanel('Settings')} aria-label="Settings">⚙</button>
          <button type="button" onClick={() => setPanel('Help')} aria-label="Help">?</button>
        </div>
      </header>
      <div className="landing-content">
        <img src="/assets/logicade_logo.png" alt="LogiCade" className="landing-logo" />
        <h1 className="landing-text">Your Adventure Begins <em>with Code</em></h1>
        <p className="realm-landing-intro">Enter the Logic Realm, where every challenge sharpens your programming skills. Explore nine regions, solve puzzles, and uncover the mysteries that await.</p>
        <button type="button" className="realm-button realm-button-gold realm-start" onClick={onStart}>
          Get Started <span aria-hidden="true">›</span>
        </button>
      </div>
      {panel === 'Settings' && (
        <SettingsModal musicEnabled={musicEnabled} onToggleMusic={onToggleMusic} onDismiss={closePanel} />
      )}
      {panel && panel !== 'Settings' && (
        <RealmModal title={panel} onDismiss={closePanel} className="realm-landing-panel">
          {panel === 'Regions' && <ol className="realm-week-list">{course.weeks.map(week => <li key={week.week}>{week.title}</li>)}</ol>}
          {panel === 'About' && <p>LogiCade is a learning adventure for Computer Programming 1. Practice flowcharts, algorithms, and C programming as you progress through the Logic Realm.</p>}
          {panel === 'Help' && <p>Choose Get Started to sign in with your student number or register. Select CP1 and enter the Kingdom to begin. The Oracle guides you through your first stages.</p>}
          <div className="realm-actions"><button type="button" className="realm-button" onClick={closePanel}>Close</button></div>
        </RealmModal>
      )}
    </main>
  );
}
