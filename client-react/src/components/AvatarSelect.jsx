import { useState } from 'react';

const AVATARS = [
  '/assets/ui/avatar1.png', '/assets/ui/avatar2.png', '/assets/ui/avatar3.png',
  '/assets/ui/avatar4.png', '/assets/ui/avatar5.png', '/assets/ui/avatar6.png',
];

export default function AvatarSelect({ onSelect }) {
  const [selected, setSelected] = useState(AVATARS[0]);

  return (
    <main className="auth-container realm-avatar-screen">
      <section className="realm-paper realm-avatar" aria-labelledby="avatar-title">
        <h1 className="realm-heading" id="avatar-title">Choose Your Avatar</h1>
        <div className="realm-divider" aria-hidden="true" />
        <p>Select a character to represent you in the Logic Realm.</p>
        <div className="avatar-grid" role="group" aria-label="Avatars">
          {AVATARS.map((src, index) => (
            <button key={src} type="button" className={`avatar-option ${selected === src ? 'selected' : ''}`}
              aria-pressed={selected === src} onClick={() => setSelected(src)}>
              <img src={src} alt={`Avatar ${index + 1}`} />
            </button>
          ))}
        </div>
        <button type="button" className="realm-button" onClick={() => onSelect(selected)}>Confirm Avatar</button>
      </section>
    </main>
  );
}
