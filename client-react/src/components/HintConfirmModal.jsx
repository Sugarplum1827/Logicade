import { LEFT } from "phaser";

export default function HintConfirmModal({ cost, coins, error = '', busy = false, onConfirm, onCancel }) {
  const canAfford = coins >= cost;

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="rok-modal" style={{ width: '480px' }}>        
        <div className="rok-content" style={{ padding: '60px 40px 30px 40px' }}>
          <p style={{ textAlign: 'center', fontSize: '22px', color: '#3e2723', marginBottom: '20px' }}>
            The Oracle will reveal guidance for this challenge.
          </p>
          
          <div style={{ 
            display: 'flex', justifyContent: 'space-around', 
            padding: '15px', borderRadius: '8px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <small style={{ fontFamily: 'var(--font-roboto)',fontWeight: 'bold', fontSize: '10px', color: '#8d6e63' }}>COST</small>
              <div style={{ fontSize: '30px', fontWeight: 'bold',margin:'0 20px', color: '#c62828' }}>🪙{cost}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <small style={{ fontFamily: 'var(--font-roboto)',fontWeight: 'bold', fontSize: '10px', color: '#8d6e63' }}>YOUR COINS</small>
              <div style={{ fontSize: '30px',margin:'0 20px', color: canAfford ? '#2e7d32' : '#c62828' }}>🪙{coins}</div>
            </div>
          </div>

          {!canAfford && (
            <p style={{ textAlign: 'center', color: '#c62828', marginTop: '20px', fontSize: '18px', fontWeight: 'bold' }}>
              Not enough coins!
            </p>
          )}
          {error && (
            <p role="alert" style={{ textAlign: 'center', color: '#c62828', marginTop: '16px', fontSize: '15px', fontWeight: 'bold' }}>
              {error}
            </p>
          )}
        </div>

        <div className="rok-footer">
          <button className="rok-btn-cancel" onClick={onCancel} disabled={busy}>CANCEL</button>
          <button 
            className="rok-btn-start" 
            onClick={onConfirm}
            disabled={!canAfford || busy}
            style={{ opacity: canAfford && !busy ? 1 : 0.5, cursor: canAfford && !busy ? 'pointer' : 'not-allowed' }}
          >
            {busy ? 'VERIFYING…' : 'USE HINT'}
          </button>
        </div>
      </div>
    </div>
  );
}
