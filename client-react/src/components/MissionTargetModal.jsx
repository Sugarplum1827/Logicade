/**
 * MissionTargetModal — pre-game objectives panel.
 * All content read from the spec JSON; no synthesis.
 *
 * Priority:
 *   objectives : tutorial (3 steps) > secondary_objectives > single
 *                player_objective > neutral defaults
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

export default function MissionTargetModal({ spec, onStart, onCancel }) {
  let objectives;
  if (Array.isArray(spec?.tutorial) && spec.tutorial.length > 0) {
    objectives = spec.tutorial;
  } else if (
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

  const hintText =
    toDisplayText(spec?.player_objective) ||
    toDisplayText(spec?.hint) ||
    'Deploy your troops and clear the level.';

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="rok-modal">
        <div className="rok-ribbon">Mission Target</div>

        <div className="rok-content">
          <p className="rok-hint">{hintText}</p>

          {spec?.source_path && (
            <div className="mission-json-source">
              <span>Challenge JSON</span>
              <a href={`/${spec.source_path.replaceAll('\\', '/')}`} target="_blank" rel="noreferrer">
                {spec.source_path.split(/[\\/]/).pop()}
              </a>
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
            <div
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.05)',
                padding: '12px 18px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '17px',
                lineHeight: 1.3,
              }}
            >
              {spec.win_condition && (
                <div style={{ marginBottom: spec.lose_condition ? 6 : 0 }}>
                  <strong style={{ color: '#2e7d32' }}>✔ Win:</strong>{' '}
                  {toDisplayText(spec.win_condition)}
                </div>
              )}
              {spec.lose_condition && (
                <div>
                  <strong style={{ color: '#c62828' }}>✘ Lose:</strong>{' '}
                    {toDisplayText(spec.lose_condition)}
                </div>
              )}
            </div>
          )}

          <div className="rok-rewards">
            <strong>Rewards</strong>
            <div className="rok-reward-row">
              <span>🪙 10 Coins</span>
              <span>✨ 50 EXP</span>
            </div>
          </div>
        </div>

        <div className="rok-footer">
          <button className="rok-btn-cancel" onClick={onCancel}>
            CANCEL
          </button>
          <button className="rok-btn-start" onClick={onStart}>
            START
          </button>
        </div>
      </div>
    </div>
  );
}
