export default function RegionModal({
  region,
  isUnlocked,
  hasPlayed,
  completedStageCount,
  stageCount,
  onClose,
  onEnter,
}) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const displayTitle = region.title || region.name || 'Unknown Region';

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayClick}>
      <div className="region-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="region-image-container">
          <img
            src={region.preview_image}
            alt={displayTitle}
            className="region-image"
          />
        </div>

        <div className="modal-header">
          <h2>{displayTitle}</h2>
          <div className="header-tags">
            <span className="week-badge">
              Week {region.week} • {region.subtitle}
            </span>
            <span
              className="status-badge"
              style={{
                background: isUnlocked
                  ? hasPlayed
                    ? '#f57f17'
                    : '#2e7d32'
                  : '#c62828',
              }}
            >
              {isUnlocked ? (hasPlayed ? 'Completed' : 'Available') : 'Locked'}
            </span>
          </div>
        </div>

        <div className="modal-body">
          <p>
            {region.desc}
          </p>

          <div className="modal-columns">
            <div>
              <h4>Key Topics:</h4>
              <ul>
                {(region.learningObjectives || [region.subtitle]).map(topic=><li key={topic}>{topic}</li>)}
              </ul>
            </div>
            <div>
              <h4>Rewards:</h4>
              <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
                <li>🔓 Region Unlocked</li>
                <li>{region.week < 9 ? `Continue toward Week ${region.week + 1}` : 'Complete the CP1 midterm review'}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'center' }}>

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
            <button className="btn-replay" type="button" onClick={onEnter} disabled={!isUnlocked}>
              REPLAY REGION
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
