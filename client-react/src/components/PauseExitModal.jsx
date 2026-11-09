export default function PauseExitModal({ onResume, onRestart, onExit }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 2000, background: 'rgba(0,0,0,0.6)' }}>
      <div className="rok-modal pause-exit-modal realm-paper" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <h2 id="pause-title" className="realm-heading">Game Paused</h2>
        <div className="realm-divider" aria-hidden="true" />
        <div className="rok-content pause-exit-content">
          <div className="rok-objectives">
            <div className="rok-objective-item">
              <p>Continue when you are ready.</p>
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
