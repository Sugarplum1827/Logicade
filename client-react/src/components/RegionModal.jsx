export default function RegionModal({ region, isUnlocked, hasPlayed, playCount, onClose, onEnter }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Ensure playCount is a valid number even if old data is boolean
  const safeCount = Number(playCount) || 0;

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayClick}>
      <div className="region-modal" onMouseDown={(e) => e.stopPropagation()}>
        
        <div className="region-image-container">
          <img src={region.preview_image} alt={region.name} className="region-image" />
        </div>

        <div className="modal-header">
          <h2>{region.name}</h2>
          <div className="header-tags">
            <span className="week-badge">Week {region.week} • Orientation</span>
            <span className="status-badge" style={{ background: isUnlocked ? (hasPlayed ? '#f57f17' : '#2e7d32') : '#c62828' }}>
              {isUnlocked ? (hasPlayed ? "Completed" : "Available") : "Locked"}
            </span>
            
            {/* ONLY SHOW THE TICKER IF safeCount IS GREATER THAN 0 */}
            {safeCount > 0 && (
              <span className="play-counter">
                Played: {safeCount} {safeCount === 1 ? 'time' : 'times'}
              </span>
            )}
          </div>
        </div>

        <div className="modal-body">
          <p>
            Welcome to LogiCade! Start your journey in the {region.name},
            learn the basics of the game, meet key characters, and complete
            your first set of activities.
          </p>

          <div className="modal-columns">
            <div>
              <h4>Key Topics:</h4>
              <ul>
                <li>Game Basics</li>
                <li>Navigation</li>
                <li>NPC Interaction</li>
                <li>Learning Portal</li>
              </ul>
            </div>
            <div>
              <h4>Rewards:</h4>
              <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
                <li>🔓 Region Unlocked</li>
                <li>🔑 Access to Week {region.week + 1}</li>
                <li style={{ marginTop: "10px", fontSize: "18px" }}>⏱ 1–2 hours</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <button className="btn-back" type="button" onClick={onClose}>
            ← BACK
          </button>
          
          {!hasPlayed ? (
            <button
              className="btn-enter"
              type="button"
              onClick={onEnter}
              disabled={!isUnlocked}
            >
              {isUnlocked ? 'ENTER REGION ➔' : 'LOCKED'}
            </button>
          ) : (
            <button className="btn-replay" type="button" onClick={onEnter}>
              REPLAY REGION
            </button>
          )}
        </div>
      </div>
    </div>
  );
}