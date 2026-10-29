export default function OracleHint({ hint, voiceBlocked, onPlayVoice, onClose }) {

  return (
    <div className="oracle-hint-overlay" role="dialog" aria-modal="true" aria-labelledby="oracle-hint-title">
      <section className="oracle-hint-card">
        <img src="/assets/oracle/oracle_frame_01.png" alt="Oracle" className="oracle-hint-portrait" />
        <div className="oracle-hint-message">
          <p className="oracle-hint-label">ORACLE / GUIDANCE</p>
          <h2 id="oracle-hint-title">A hint for this challenge</h2>
          <p className="oracle-hint-text">{hint}</p>
          {voiceBlocked && <p className="oracle-hint-audio-note" role="status">Voice playback was blocked. Use Play Oracle Voice to hear it.</p>}
          <div className="oracle-hint-actions">
            {voiceBlocked && <button type="button" className="oracle-hint-close" onClick={onPlayVoice}>PLAY ORACLE VOICE</button>}
            <button type="button" className="oracle-hint-close" onClick={onClose}>RETURN TO GAME</button>
          </div>
        </div>
      </section>
    </div>
  );
}
