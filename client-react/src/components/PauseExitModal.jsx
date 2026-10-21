export default function PauseExitModal({ onResume, onRestart, onExit }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 2000, background: 'rgba(0,0,0,0.6)' }}>
      <div className="rok-modal" style={{ width: '400px' }}>
        <div className="rok-ribbon">Paused</div>
        
        <div className="rok-content" style={{ padding: '60px 40px 30px 40px' }}>
          <h2 style={{ fontFamily: 'var(--font-pixel)', color: '#1a237e', fontSize: '20px', textAlign: 'center' }}>
            GAME PAUSED
          </h2>
          <p style={{ fontSize: '22px', color: '#3e2723', marginTop: '20px', textAlign: 'center', lineHeight: '1.3' }}>
            Take a break or restart the level.
          </p>
        </div>
        
        <div className="rok-footer" style={{ flexDirection: 'column', gap: '10px' }}>
          <button className="rok-btn-start" onClick={onResume}>CONTINUE</button>
          <button className="rok-btn-repeat" onClick={onRestart}>RESTART LEVEL</button>
          <button className="rok-btn-exit" onClick={onExit}>EXIT GAME</button>
        </div>
      </div>
    </div>
  );
}