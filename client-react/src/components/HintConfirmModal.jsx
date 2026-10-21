export default function HintConfirmModal({ cost, coins, hintText, onConfirm, onCancel }) {
  const canAfford = coins >= cost;

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="rok-modal" style={{ width: '480px' }}>
        <div className="rok-ribbon">Use Hint?</div>
        
        <div className="rok-content" style={{ padding: '60px 40px 30px 40px' }}>
          <p style={{ textAlign: 'center', fontSize: '22px', color: '#3e2723', marginBottom: '20px' }}>
            Reveal a hint for this level?
          </p>
          
          <div style={{ 
            display: 'flex', justifyContent: 'space-around', 
            background: 'rgba(0,0,0,0.05)', padding: '15px', borderRadius: '8px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <small style={{ fontFamily: 'var(--font-pixel)', fontSize: '10px', color: '#8d6e63' }}>COST</small>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#c62828' }}>🪙 1</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <small style={{ fontFamily: 'var(--font-pixel)', fontSize: '10px', color: '#8d6e63' }}>YOUR COINS</small>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: canAfford ? '#2e7d32' : '#c62828' }}>🪙 {coins}</div>
            </div>
          </div>

          {!canAfford && (
            <p style={{ textAlign: 'center', color: '#c62828', marginTop: '20px', fontSize: '18px', fontWeight: 'bold' }}>
              Not enough coins!
            </p>
          )}
        </div>

        <div className="rok-footer">
          <button className="rok-btn-cancel" onClick={onCancel}>CANCEL</button>
          <button 
            className="rok-btn-start" 
            onClick={onConfirm}
            disabled={!canAfford}
            style={{ opacity: canAfford ? 1 : 0.5, cursor: canAfford ? 'pointer' : 'not-allowed' }}
          >
            USE HINT
          </button>
        </div>
      </div>
    </div>
  );
}