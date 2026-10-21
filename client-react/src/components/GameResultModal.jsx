export default function GameResultModal({ result, spec, onNext, onRepeat, onExit }) {
  const { won, time, score, coinReward = 0, xpReward = 0, isFirstTime } = result;

  // Derive human-readable main objective from win condition
  const win = String(spec?.win || '');
  let mainObj = 'Complete the main objective';
  let m;
  if ((m = win.match(/^score\s*(>=|==|>)\s*(\d+)/))) {
    mainObj = `Collect ${m[2]} items`;
  } else if ((m = win.match(/^timer\s*(>=|>)\s*(\d+)/))) {
    mainObj = `Survive ${m[2]} seconds`;
  } else if ((m = win.match(/^count\s*(>=|==|>)\s*(\d+)/))) {
    mainObj = `Destroy ${m[2]} objects`;
  }

  const isTimeObjMet = won && time < 60;
  const isPerfectObjMet = won && score === 1;

  // Score % is only meaningful for score-win levels
  const isScoreWin = win.includes('score');
  const scoreDisplay = isScoreWin
    ? `${Math.round(score * 100)}%`
    : (won ? '✓' : '✗');

  return (
    <div className="modal-overlay" style={{ zIndex: 2000, background: 'rgba(0,0,0,0.7)' }}>
      <div className="rok-modal">
        <div className={`rok-ribbon ${won ? 'gold' : 'gray'}`}>
          {won ? 'VICTORY' : 'DEFEAT'}
        </div>

        <div className="rok-content">
          <div className="rok-objectives">
            <div className={`rok-objective-item ${won ? 'completed' : 'failed'}`}>
              <span className="rok-icon">{won ? '✅' : '❌'}</span>
              <span>{mainObj}</span>
            </div>
            <div className={`rok-objective-item ${isTimeObjMet ? 'completed' : 'failed'}`}>
              <span className="rok-icon">{isTimeObjMet ? '✅' : '❌'}</span>
              <span>Complete in under 60s ({Math.round(time)}s)</span>
            </div>
            <div className={`rok-objective-item ${isPerfectObjMet ? 'completed' : 'failed'}`}>
              <span className="rok-icon">{isPerfectObjMet ? '✅' : '❌'}</span>
              <span>Perfect Accuracy</span>
            </div>
          </div>

          <div className="rok-stats">
            <div className="rok-stat-box">
              <small>TIME</small>
              <strong>{Math.round(time)}s</strong>
            </div>
            <div className="rok-stat-box">
              <small>SCORE</small>
              <strong>{scoreDisplay}</strong>
            </div>
            <div className="rok-stat-box">
              <small>REWARDS</small>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <span>🪙 {coinReward}</span>
                <span style={{ fontSize: '16px' }}>✨ {xpReward}</span>
              </div>
            </div>
          </div>

          {won && !isFirstTime && (
            <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '16px', color: '#8d6e63' }}>
              Already completed — no rewards on replay
            </p>
          )}
        </div>

        <div className="rok-footer">
          <button className="rok-btn-exit" onClick={onExit}>EXIT</button>
          <button className="rok-btn-repeat" onClick={onRepeat}>REPEAT</button>
          {won && <button className="rok-btn-next" onClick={onNext}>NEXT</button>}
        </div>
      </div>
    </div>
  );
}