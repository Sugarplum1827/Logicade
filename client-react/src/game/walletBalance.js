const sessionKey = (scope) => JSON.stringify([scope?.studentId || '', scope?.token || '']);
const requestKey = (scope) => JSON.stringify([sessionKey(scope), scope?.gameKey || '']);

export async function readUnconfirmedCoinJobs(openDB, studentId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('sync_queue', 'readonly');
    const request = transaction.objectStore('sync_queue').getAll();
    request.onsuccess = () => resolve((request.result || []).filter((job) =>
      job.table === 'coin_transactions' && job.payload?.student_id === studentId && job.status !== 'done'));
    request.onerror = () => reject(request.error);
  });
}

// A fetched balance replaces the local display only after this participant's
// coin outbox is confirmed. Adding pending amounts to the server balance could
// double-count a committed transaction whose upload response was lost.
export function createWalletRefreshController({ getScope, isOnline, fetchBalance, readCoinJobs, onBalance, onState }) {
  let sequence = 0;
  const mutations = new Map();
  const invalidate = (status = 'unverified') => {
    sequence += 1;
    if (status) onState({ status });
  };
  const beginMutation = () => {
    const key = sessionKey(getScope());
    mutations.set(key, (mutations.get(key) || 0) + 1);
    invalidate('pending');
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      const remaining = (mutations.get(key) || 1) - 1;
      if (remaining) mutations.set(key, remaining);
      else mutations.delete(key);
      if (sessionKey(getScope()) === key) invalidate('pending');
    };
  };
  const refresh = async () => {
    const scope = getScope();
    if (!scope?.studentId || !scope?.token) {
      invalidate('unverified');
      return false;
    }
    if (mutations.has(sessionKey(scope))) return false;
    const request = ++sequence;
    const current = () => request === sequence && requestKey(getScope()) === requestKey(scope);
    if (!isOnline()) {
      onState({ status: 'offline' });
      return false;
    }
    onState({ status: 'checking' });
    try {
      const result = await fetchBalance(scope);
      if (!Number.isSafeInteger(result?.balance) || result.balance < 0) throw new Error('The server returned an invalid coin balance.');
      const pending = await readCoinJobs(scope.studentId);
      if (!current() || mutations.has(sessionKey(scope))) return false;
      if (pending.length) {
        onState({ status: 'pending', pendingRecords: pending.length, confirmedBalance: result.balance });
      } else {
        onBalance(result.balance);
        onState({ status: 'verified', confirmedBalance: result.balance });
      }
      return true;
    } catch {
      if (current()) onState({ status: 'unavailable' });
      return false;
    }
  };
  return { refresh, invalidate, beginMutation };
}

export function walletStatusText(state) {
  if (state.status === 'verified') return 'Coin balance confirmed by the server.';
  if (state.status === 'pending') return 'Local coin balance includes changes awaiting synchronization and server confirmation.';
  if (state.status === 'checking') return 'Checking the local coin balance with the server.';
  if (state.status === 'offline') return 'Offline: showing the saved local coin balance.';
  return 'Showing the saved local coin balance; server verification is unavailable.';
}
