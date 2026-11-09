import RealmModal from './RealmModal';

export default function LogoutModal({ onConfirm, onCancel }) {
  return (
    <RealmModal title="Are you sure you want to log out?" onDismiss={onCancel} className="realm-logout">
      <p>Your progress is saved on this device.</p>
      <div className="realm-actions">
        <button type="button" className="realm-button realm-button-red" onClick={onConfirm}>Yes, log out</button>
        <button type="button" className="realm-button" autoFocus onClick={onCancel}>No, stay here</button>
      </div>
    </RealmModal>
  );
}
