export default function LandingPage({ onStart }) {
  return (
    <div className="landing-container">
      <div className="landing-content">
        <img src="/assets/logicade_logo.png" alt="LogiCade" className="landing-logo" />
        <div className="landing-text">
          An epic learning adventure where C programming meets exploration!
        </div>
        <ul className="feature-list">
          <li><span className="feature-icon">📖</span> Learn C Programming</li>
          <li><span className="feature-icon">🗺️</span> Explore 9 Unique Regions</li>
          <li><span className="feature-icon">⚔️</span> Complete Quests & Challenges</li>
          <li><span className="feature-icon">📊</span> Track Your Progress</li>
        </ul>
        <button className="btn-get-started" onClick={onStart}>
          GET STARTED <span>➔</span>
        </button>
      </div>
    </div>
  );
}