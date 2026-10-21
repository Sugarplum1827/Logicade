export default function CodeGateModal({ gateData, onResolve }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 2000, background: 'rgba(0,0,0,0.85)' }}>
      <div className="region-modal" style={{ height: 'auto', minHeight: '400px', width: '500px' }}>
        
        <div className="modal-header" style={{ borderBottom: '2px solid #8d6e63', paddingBottom: '10px' }}>
          <h2 style={{ fontSize: '16px', color: '#1a237e' }}>🔒 CODE GATE</h2>
        </div>

        <div className="modal-body" style={{ marginTop: '20px' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '20px', fontSize: '14px' }}>
            The path is blocked by magic. You must evaluate the condition correctly to open the gate.
          </p>

          <div style={{ background: '#2d2d2d', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
            <code style={{ color: '#4ade80', fontFamily: 'monospace', fontSize: '16px' }}>
              {gateData.question}
            </code>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {gateData.options.map((opt, i) => (
              <button 
                key={i}
                className="btn-enter"
                style={{ background: '#f5f5f5', color: '#3e2723', textAlign: 'left', padding: '12px' }}
                onClick={() => onResolve(i === gateData.correct)}
                onMouseEnter={(e) => e.target.style.background = '#e0e0e0'}
                onMouseLeave={(e) => e.target.style.background = '#f5f5f5'}
              >
                <code>{opt}</code>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}