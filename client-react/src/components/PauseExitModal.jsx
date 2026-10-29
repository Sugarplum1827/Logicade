export default function PauseExitModal({ onResume, onRestart, onExit }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 2000, background: 'rgba(0,0,0,0.6)' }}>
      <div className="rok-modal pause-exit-modal">
        <div className="rok-content pause-exit-content">
          <div className="rok-objectives">
            <div className="rok-objective-item" style={{margin: '30px'}}>
              <h1>Continue when you are ready.</h1>
            </div>
          </div>
        </div>

        <div className="rok-footer">
          <button className="rok-btn-start" onClick={onResume} style={{margin: '0 20px', fontSize: '15px',  fontFamily: '--font-roboto', color: 'white'}}>CONTINUE</button>
          <button className="rok-btn-repeat" onClick={onRestart} style={{margin: '0 20px', fontSize: '15px', fontFamily: '--font-roboto', color: 'white'}}>REPEAT LEVEL</button>
          <button className="rok-btn-exit" onClick={onExit} style={{margin: '0 20px', fontSize: '15px',  fontFamily: '--font-roboto', color: 'white'}}>EXIT GAME</button>
        </div>
      </div>
    </div>
  );
}
