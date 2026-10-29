export default function LogoutModal({ onConfirm, onCancel }) {
  return (
    // Dark overlay covering the screen
    <div
      className="modal-overlay"
      style={{
        zIndex: 9999,
        background: 'rgba(0, 0, 0, .42)'
      }}
      onClick={(event) => {
        // Cancel if the user clicks outside the popup
        if (!event.target.closest('.region-modal')) {
          onCancel?.();
        }
      }}
    >
      {/* Logout confirmation popup */}
      <div
        className="region-modal"
        style={{
          width: '400px',
          textAlign: 'center',
          padding: '30px 40px',
          boxSizing: 'border-box'
        }}
      >
        {/* Popup heading */}
        <h2
          style={{
            fontFamily: 'var(--font-pixel)',
            color: '#1a237e',
            fontSize: '18px',
            marginBottom: '15px'
          }}
        >
          RETURN TO LOGIC REALM?
        </h2>

        {/* Confirmation message */}
        <p
          style={{
            fontSize: '20px',
            marginBottom: '25px',
            color: '#3e2723'
          }}
        >
          Are you sure you want to log out? Your progress is saved on this device.
        </p>

        {/* Button container */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'center'
          }}
        >
          {/* Confirm logout button */}
          <button
            className="btn-enter"
            onClick={onConfirm}
            style={{
              width: '35px',
              padding: '15px 10px',
              margin: '10px 40px' ,
              fontSize: '10px',
              background: '#c62828',
              borderColor: '#8e0000',
              boxShadow: '0 2px 0 #8e0000'
            }}
          >
            LOGOUT
          </button>
        </div>
      </div>
    </div>
  );
}
