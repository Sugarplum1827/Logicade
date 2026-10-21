import { useState } from 'react';

const AVATARS = [
  '/assets/ui/avatar1.png', '/assets/ui/avatar2.png', '/assets/ui/avatar3.png',
  '/assets/ui/avatar4.png', '/assets/ui/avatar5.png', '/assets/ui/avatar6.png'
];

export default function AvatarSelect({ onSelect }) {
  const [selected, setSelected] = useState(AVATARS[0]);

  return (
    <div className="auth-container">
      <div className="parchment-wrapper" style={{ width: '600px', padding: '40px' }}>
        <h2 className="auth-title" style={{ fontSize: '20px' }}>CHOOSE YOUR AVATAR</h2>
        <p className="auth-subtitle">Select a character to represent you in the Logic Realm.</p>
        
        <div className="avatar-grid">
          {AVATARS.map((img, i) => (
            <div 
              key={i} 
              className={`avatar-option ${selected === img ? 'selected' : ''}`}
              onClick={() => setSelected(img)}
            >
              <img src={img} alt={`Avatar ${i+1}`} onError={(e) => e.target.src = 'https://via.placeholder.com/80?text=?'} />
            </div>
          ))}
        </div>

        <button className="btn-auth" style={{ marginTop: '30px' }} onClick={() => onSelect(selected)}>
          CONFIRM AVATAR
        </button>
      </div>
    </div>
  );
}