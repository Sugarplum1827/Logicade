export default function OracleCompanion({ onClick, disabled = false }) {
  const label = disabled ? 'Oracle hint unavailable while loading' : 'Ask the Oracle for a hint (6 coins)';

  return (
    <button type="button" className="oracle-companion" onClick={onClick}
      disabled={disabled} aria-label={label} title={label}>
      <span className="oracle-companion-sprite" aria-hidden="true">
        <img className="oracle-companion-frame oracle-companion-open" src="/assets/oracle/oracle_frame_01.png" alt="" draggable="false" />
        <img className="oracle-companion-frame oracle-companion-drowsy" src="/assets/oracle/oracle_frame_06.png" alt="" draggable="false" />
        <img className="oracle-companion-frame oracle-companion-blink" src="/assets/oracle/oracle_frame_07.png" alt="" draggable="false" />
      </span>
      <span className="oracle-companion-label" aria-hidden="true">Ask Oracle · 6 coins</span>
    </button>
  );
}
