export default function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="region-modal" style={{ width: '400px', textAlign: 'center', padding: '30px 50px 30px 40px' }}>
        <h2 style={{ fontFamily: 'var(--font-pixel)', color: '#1a237e', fontSize: '18px', marginBottom: '15px' }}>
          RETURN TO LOGIC REALM?
        </h2>
        <p style={{ fontSize: '20px', marginBottom: '25px', color: '#3e2723' }}>
          Are you sure you want to log out? Your progress is saved on this device.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
            className="btn-back"
            onClick={onCancel}
            style={{ width: '90px', padding: '6px 4px', fontSize: '12px' }}
        >
            CANCEL
        </button>

        <button
            className="btn-enter"
            onClick={onConfirm}
            style={{
            width: '50px',
            padding: '15px 4px 15px 4px',
            fontSize: '12px',
            background: '#c62828',
            borderColor: '#8e0000',
            boxShadow: '0 3px 0 #8e0000'
            }}
        >
            LOGOUT
        </button>
        </div>
      </div>
    </div>
  );
}