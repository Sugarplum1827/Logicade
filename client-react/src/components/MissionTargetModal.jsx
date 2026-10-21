export default function MissionTargetModal({ spec, onStart, onCancel }) {
  const objectives = spec?.objectives || [
    "Complete the main objective", 
    "Complete mission in 60s", 
    "Don't take damage"
  ];

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="rok-modal">
        <div className="rok-ribbon">Mission Target</div>
        
        <div className="rok-content">
          <p className="rok-hint">{spec.hint || 'Deploy your troops and clear the level.'}</p>
          
          <div className="rok-objectives">
            <div className="rok-objective-item">
              <span className="rok-star">⭐</span>
              <span>{objectives[0]}</span>
            </div>
            <div className="rok-objective-item">
              <span className="rok-star">⭐</span>
              <span>{objectives[1]}</span>
            </div>
            <div className="rok-objective-item">
              <span className="rok-star">⭐</span>
              <span>{objectives[2]}</span>
            </div>
          </div>

          <div className="rok-rewards">
            <strong>Rewards</strong>
            <div className="rok-reward-row">
              <span>🪙 10 Coins</span>
              <span>✨ 50 EXP</span>
            </div>
          </div>
        </div>

        <div className="rok-footer">
          <button className="rok-btn-cancel" onClick={onCancel}>CANCEL</button>
          <button className="rok-btn-start" onClick={onStart}>START</button>
        </div>
      </div>
    </div>
  );
}