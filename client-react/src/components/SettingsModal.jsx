import RealmModal from './RealmModal';

export default function SettingsModal({ musicEnabled, onToggleMusic, onDismiss }) {
  return (
    <RealmModal title="Settings" onDismiss={onDismiss}>
      <button type="button" className="realm-button" aria-pressed={musicEnabled} onClick={onToggleMusic}>
        Background music <span aria-hidden="true">{musicEnabled ? 'on' : 'off'}</span>
      </button>
      <div className="realm-actions">
        <button type="button" className="realm-button" onClick={onDismiss}>Close</button>
      </div>
    </RealmModal>
  );
}
