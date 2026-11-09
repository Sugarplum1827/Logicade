import RealmModal from './RealmModal';

export default function RegionModal({ region, isUnlocked, hasPlayed, completedStageCount, stageCount, onClose, onEnter }) {
  const displayTitle = region.title || region.name || 'Unknown Region';
  const status = isUnlocked ? (hasPlayed ? 'Completed' : 'Available') : 'Locked';

  return (
    <RealmModal title={`Week ${region.week}`} onDismiss={onClose} className="realm-region"
      lead={<figure className="realm-region-preview"><img src={region.preview_image} alt={displayTitle} /></figure>}>
      <div className="realm-region-title">
        <strong>{region.subtitle}</strong>
        <span className={`realm-region-status ${isUnlocked ? '' : 'is-locked'}`}>{status}</span>
      </div>
      <p className="realm-region-description">{region.desc}</p>
      <div className="realm-region-columns">
        <section>
          <h3 className="realm-plaque">Key Topics</h3>
          <ul>{(region.learningObjectives || [region.subtitle]).map(topic => <li key={topic}>{topic}</li>)}</ul>
        </section>
        <section>
          <h3 className="realm-plaque">Progress</h3>
          <div className="realm-region-progress">
            <img src="/assets/gold_coin.png" alt="" />
            <strong>{completedStageCount} / {stageCount} stages cleared</strong>
            <small>{region.week < 9 ? `Continue toward Week ${region.week + 1}` : 'Complete the CP1 midterm review'}</small>
          </div>
        </section>
      </div>
      <div className="realm-actions">
        <button type="button" className="realm-button" onClick={onEnter} disabled={!isUnlocked}>
          {hasPlayed ? 'Replay Region' : isUnlocked ? 'Enter Region' : 'Locked'}
        </button>
        <button type="button" className="realm-button realm-button-gold" onClick={onClose}>Back to Map</button>
      </div>
    </RealmModal>
  );
}
