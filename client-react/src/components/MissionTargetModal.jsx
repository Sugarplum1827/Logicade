/**
 * MissionTargetModal — pre-game objectives panel.
 * All content read from the spec JSON; no synthesis.
 *
 * Priority:
 *   objectives : secondary_objectives > single player_objective > defaults
 *   hint       : player_objective > hint > neutral default
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
    return '';
  }
  return '';
}

function formatGameLabel(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function MissionTargetModal({ spec, rewardClaimed = false, onStart, onCancel, starting = false, error = '' }) {
  let objectives;
  if (
    Array.isArray(spec?.secondary_objectives) &&
    spec.secondary_objectives.length > 0
  ) {
    objectives = spec.secondary_objectives;
  } else if (spec?.player_objective) {
    objectives = [spec.player_objective];
  } else {
    objectives = [
      'Complete the main objective',
      'Complete mission in 60s',
      "Don't take damage",
    ];
  }

  // Pad/trim to exactly 3 rows so the layout is stable
  const rows = [0, 1, 2].map((i) => toDisplayText(objectives[i]) || null);

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 2000, background: 'rgba(0, 0, 0, .42)' }}
      onClick={(event) => {
        // Footer controls belong to the dialog too. Only the actual backdrop
        // cancels; bubbling a Start click must never release its active lease.
        if (event.target === event.currentTarget && !starting) onCancel?.();
      }}
    >
      <div className="rok-modal mission-target-modal realm-paper" role="dialog" aria-modal="true" aria-labelledby="mission-target-title">
        <h2 id="mission-target-title" className="realm-heading">Mission Target</h2>
        <div className="realm-divider" aria-hidden="true" />

        <div className="rok-content">
          {spec?.phaser_template?.display_name && (
            <div className="rok-template-choice" aria-label="Selected game template">
              <strong>{spec.phaser_template.display_name}</strong>
              <span>{formatGameLabel(spec.phaser_template.variation_title || spec.phaser_template.variation_id)}</span>
            </div>
          )}
          <div className="rok-objectives">
            {rows.map((text, i) =>
              text ? (
                <div className="rok-objective-item" key={i}>
                  <span className="rok-star">⭐</span>
                  <span>{text}</span>
                </div>
              ) : null,
            )}
          </div>

          {/* Win / lose conditions — only when the JSON provides them */}
          {(spec?.win_condition || spec?.lose_condition) && (
            <div className="realm-mission-conditions">
              {spec.win_condition && (
                <p>
                  <strong>✔ Win</strong>{' '}
                  {toDisplayText(spec.win_condition)}
                </p>
              )}
              {spec.lose_condition && (
                <p>
                  <strong className="is-lose">✘ Lose</strong>{' '}
                    {toDisplayText(spec.lose_condition)}
                </p>
              )}
            </div>
          )}

          <div className="rok-rewards">
            <strong>First Completion Rewards</strong>
            <div className="rok-reward-row">
              {rewardClaimed ? <span>Already claimed</span> : <><span>🪙 10 Coins</span><span>✦ 50 XP</span></>}
            </div>
          </div>
        </div>

        <div className="rok-footer">
          <button className="rok-btn-cancel" onClick={onCancel} disabled={starting}>
            CANCEL
          </button>
          <button className="rok-btn-start" onClick={onStart} disabled={starting}>
            {starting ? 'PREPARING GAME…' : 'START'}
          </button>
        </div>
        {error && <p role="alert" className="mission-start-error">{error}</p>}
      </div>
    </div>
  );
}
