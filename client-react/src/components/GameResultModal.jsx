/**
 * GameResultModal — every label is read from the spec JSON, never
 * synthesized. Supports both puzzle-style specs (win/hint) and
 * mission-style specs (player_objective/win_condition/lose_condition/
 * secondary_objectives).
 *
 * Source priority per label:
 *   primary   : player_objective > win_condition > win > lose_condition
 *   lose      : lose_condition
 *   secondary : secondary_objectives > [] (nothing shown)
 */

function toDisplayText(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(toDisplayText).filter(Boolean).join(' ');
  if (value && typeof value === 'object') {
    const content = value.message ?? value.text ?? value.description ?? value.objective ?? value.title;
    if (content !== undefined && content !== null) {
      const text = toDisplayText(content);
      return value.step != null ? `Step ${value.step}: ${text}` : text;
    }
  }
  return '';
}

export default function GameResultModal({
  result,
  spec,
  onNext,
  onRepeat,
  onExit,
}) {
  const {
    won,
    time,
    score,
    coinReward = 0,
    xpReward = 0,
    isFirstTime,
  } = result;

  // ── Labels: strictly from the JSON ──────────────────────────────
  const primaryLabel =
    toDisplayText(
      won
        ? spec?.player_objective || spec?.win_condition || spec?.win
        : spec?.player_objective || spec?.lose_condition || spec?.win,
    ) || 'Complete the level';

  const loseLabel = !won ? toDisplayText(spec?.lose_condition) : '';

  // Tutorial steps are shown before play in the in-game tutorial overlay.
  const secondaryObjectives =
    Array.isArray(spec?.secondary_objectives) && spec.secondary_objectives.length > 0
      ? spec.secondary_objectives
      : [];

  const scoreDisplay = `${Math.round(score * 100)}%`;

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 2000, background: 'rgba(0,0,0,0.7)' }}
    >
      <div className="rok-modal">
        <div className={`rok-ribbon ${won ? 'gold' : 'gray'}`}>
          {won ? 'VICTORY' : 'DEFEAT'}
        </div>

        <div className="rok-content">
          <div className="rok-objectives">
            {/* Primary objective — exact text from the JSON */}
            <div className={`rok-objective-item ${won ? 'completed' : 'failed'}`}>
              <span className="rok-icon">{won ? '✅' : '❌'}</span>
              <span>{primaryLabel}</span>
            </div>

            {/* Secondary objectives — from JSON (secondary_objectives or tutorial) */}
            {secondaryObjectives.map((label, i) => (
              <div
                key={i}
                className={`rok-objective-item ${won ? 'completed' : 'failed'}`}
              >
                <span className="rok-icon">{won ? '✅' : '❌'}</span>
                <span>{toDisplayText(label)}</span>
              </div>
            ))}

            {/* Lose reason — only on defeat, from the JSON */}
            {!won && loseLabel && (
              <div className="rok-objective-item failed">
                <span className="rok-icon">⚠️</span>
                <span>{loseLabel}</span>
              </div>
            )}
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
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                <span>🪙 {coinReward}</span>
                <span style={{ fontSize: '16px' }}>✨ {xpReward}</span>
              </div>
            </div>
          </div>

          {won && !isFirstTime && (
            <p
              style={{
                textAlign: 'center',
                marginTop: '15px',
                fontSize: '16px',
                color: '#8d6e63',
              }}
            >
              Already completed — no rewards on replay
            </p>
          )}
        </div>

        <div className="rok-footer">
          <button className="rok-btn-exit" onClick={onExit}>
            EXIT
          </button>
          <button className="rok-btn-repeat" onClick={onRepeat}>
            REPEAT
          </button>
          {won && (
            <button className="rok-btn-next" onClick={onNext}>
              NEXT
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
