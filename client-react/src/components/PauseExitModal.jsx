export default function PauseExitModal({ onResume, onRestart, onExit }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 2000, background: 'rgba(0,0,0,0.6)' }}>
      <div className="rok-modal pause-exit-modal">
        <div className="rok-ribbon gold">GAME PAUSED</div>

        <div className="rok-content pause-exit-content">
          <div className="rok-objectives">
            <div className="rok-objective-item">
              <span className="rok-icon">⏸️</span>
              <span>Your progress is paused.</span>
            </div>
            <div className="rok-objective-item">
              <span className="rok-icon">▶️</span>
              <span>Continue when you are ready.</span>
            </div>
          </div>
        </div>

        <div className="rok-footer">
          <button className="rok-btn-start" onClick={onResume}>CONTINUE</button>
          <button className="rok-btn-repeat" onClick={onRestart}>REPEAT LEVEL</button>
          <button className="rok-btn-exit" onClick={onExit}>EXIT GAME</button>
        </div>
      </div>
    </div>
  );
}
