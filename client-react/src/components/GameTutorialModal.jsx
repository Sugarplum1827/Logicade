function displayText(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(displayText).filter(Boolean).join(' ');
  if (value && typeof value === 'object') {
    const message = value.message ?? value.text ?? value.description ?? value.title;
    if (message != null) return displayText(message);
  }
  return '';
}

export default function GameTutorialModal({ spec, onStart }) {
  const tutorial = Array.isArray(spec?.tutorial)
    ? spec.tutorial.map((step, index) => ({
        number: step?.step ?? index + 1,
        text: displayText(step),
      })).filter((step) => step.text)
    : [];
  const steps = tutorial.length > 0
    ? tutorial
    : (Array.isArray(spec?.secondary_objectives) ? spec.secondary_objectives : [])
      .map((step, index) => ({ number: index + 1, text: displayText(step) }))
      .filter((step) => step.text);
  const controls = displayText(spec?.controls);

  return (
    <div className="game-tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="game-tutorial-title">
      <section className="game-tutorial-card">
        <h1 id="game-tutorial-title" className="game-tutorial-title">HOW TO PLAY</h1>

        <div className="game-tutorial-steps">
          {steps.length > 0 ? steps.map((step, index) => (
            <article className="game-tutorial-step" key={`${step.number}-${index}`}>
              <span className="game-tutorial-number">{step.number}</span>
              <p>{step.text}</p>
              <span className="game-tutorial-arrow" aria-hidden="true">➜</span>
              <div className="game-tutorial-action">
                <span className="game-tutorial-action-icon" aria-hidden="true">
                  {['🎮', '⌨️', '🏆'][index % 3]}
                </span>
                <span>{index === steps.length - 1 ? 'Reach the goal' : 'Try it in the game'}</span>
              </div>
            </article>
          )) : (
            <article className="game-tutorial-step game-tutorial-step-fallback">
              <span className="game-tutorial-number">1</span>
              <p>Explore the game, use the controls, and complete the objective.</p>
              <span className="game-tutorial-arrow" aria-hidden="true">➜</span>
              <div className="game-tutorial-action">
                <span className="game-tutorial-action-icon" aria-hidden="true">🎮</span>
                <span>Reach the goal</span>
              </div>
            </article>
          )}
        </div>

        {controls && <p className="game-tutorial-controls"><strong>CONTROLS</strong> {controls}</p>}
        <button className="game-tutorial-start" onClick={onStart}>START</button>
      </section>
    </div>
  );
}
