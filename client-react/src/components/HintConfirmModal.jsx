import RealmModal from './RealmModal';

export default function HintConfirmModal({ cost, coins, error = '', busy = false, onConfirm, onCancel }) {
  const canAfford = coins >= cost;

  return (
    <RealmModal title="The Oracle will reveal guidance for this challenge." onDismiss={busy ? undefined : onCancel} className="realm-hint-purchase">
      <dl className="realm-coin-totals">
        <div><dt>Cost</dt><dd><img src="/assets/gold_coin.png" alt="" />{cost}</dd></div>
        <div><dt>Your coins</dt><dd className={canAfford ? 'can-afford' : ''}><img src="/assets/gold_coin.png" alt="" />{coins}</dd></div>
      </dl>
      {!canAfford && <p className="realm-form-error">Not enough coins.</p>}
      {error && <p role="alert" className="realm-form-error">{error}</p>}
      <div className="realm-actions">
        <button type="button" className="realm-button realm-button-red" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="realm-button" onClick={onConfirm} disabled={!canAfford || busy}>
          {busy ? 'Verifying…' : 'Use Hint'}
        </button>
      </div>
    </RealmModal>
  );
}
