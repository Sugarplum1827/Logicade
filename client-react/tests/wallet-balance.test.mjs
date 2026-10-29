import test from 'node:test';
import assert from 'node:assert/strict';
import { createWalletRefreshController, readUnconfirmedCoinJobs } from '../src/game/walletBalance.js';
import { memoryDatabase } from './helpers/memory-db.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function setup({ fetchBalance = async () => ({ balance: 20 }), readCoinJobs = async () => [] } = {}) {
  const state = { scope: { studentId: 'A', token: 'token-a', gameKey: 'game-1' }, online: true, balances: [], statuses: [] };
  const controller = createWalletRefreshController({
    getScope: () => state.scope, isOnline: () => state.online, fetchBalance, readCoinJobs,
    onBalance: (balance) => state.balances.push(balance), onState: (status) => state.statuses.push(status),
  });
  return { state, controller };
}

test('only the signed participant’s unconfirmed coin jobs prevent reconciliation', async () => {
  const db = memoryDatabase({ sync_queue: [
    { job_id: 'pending', table: 'coin_transactions', status: 'pending', payload: { student_id: 'A' } },
    { job_id: 'failed', table: 'coin_transactions', status: 'failed', payload: { student_id: 'A' } },
    { job_id: 'dead', table: 'coin_transactions', status: 'dead', payload: { student_id: 'A' } },
    { job_id: 'done', table: 'coin_transactions', status: 'done', payload: { student_id: 'A' } },
    { job_id: 'other-owner', table: 'coin_transactions', status: 'pending', payload: { student_id: 'B' } },
    { job_id: 'gameplay', table: 'events', status: 'pending', payload: { student_id: 'A' } },
  ] });
  assert.deepEqual((await readUnconfirmedCoinJobs(async () => db, 'A')).map((job) => job.job_id), ['pending', 'failed', 'dead']);
});

test('a pending local reward stays provisional even if the server may already have committed it', async () => {
  let pending = [{ transaction_id: 'reward', amount: 10 }];
  const { state, controller } = setup({ fetchBalance: async () => ({ balance: 30 }), readCoinJobs: async () => pending });
  await controller.refresh();
  assert.deepEqual(state.balances, []);
  assert.deepEqual(state.statuses.at(-1), { status: 'pending', pendingRecords: 1, confirmedBalance: 30 });
  pending = [];
  await controller.refresh();
  assert.deepEqual(state.balances, [30]);
  assert.equal(state.statuses.at(-1).status, 'verified');
});

test('a balance response started before a hint spend cannot overwrite the newer local result', async () => {
  const old = deferred();
  let calls = 0;
  const { state, controller } = setup({ fetchBalance: () => ++calls === 1 ? old.promise : Promise.resolve({ balance: 14 }) });
  const stale = controller.refresh();
  const finish = controller.beginMutation();
  assert.equal(await controller.refresh(), false);
  finish();
  await controller.refresh();
  old.resolve({ balance: 20 });
  await stale;
  assert.deepEqual(state.balances, [14]);
});

test('outbox reading also checks freshness after a local mutation', async () => {
  const pendingRead = deferred();
  const { state, controller } = setup({ readCoinJobs: () => pendingRead.promise });
  const refresh = controller.refresh();
  await Promise.resolve();
  const finish = controller.beginMutation();
  finish();
  pendingRead.resolve([]);
  await refresh;
  assert.deepEqual(state.balances, []);
});

for (const [label, changed] of [
  ['another account', { studentId: 'B', token: 'token-b', gameKey: 'game-1' }],
  ['a newer login token', { studentId: 'A', token: 'new-token', gameKey: 'game-1' }],
  ['a different game', { studentId: 'A', token: 'token-a', gameKey: 'game-2' }],
]) {
  test(`a late balance response cannot update ${label}`, async () => {
    const response = deferred();
    const { state, controller } = setup({ fetchBalance: () => response.promise });
    const request = controller.refresh();
    state.scope = changed;
    response.resolve({ balance: 99 });
    await request;
    assert.deepEqual(state.balances, []);
  });
}

test('finishing an old account’s mutation cannot cancel the new account’s verification', async () => {
  const response = deferred();
  const { state, controller } = setup({ fetchBalance: () => response.promise });
  const finish = controller.beginMutation();
  state.scope = { studentId: 'B', token: 'token-b', gameKey: 'game-2' };
  const current = controller.refresh();
  finish();
  response.resolve({ balance: 47 });
  await current;
  assert.deepEqual(state.balances, [47]);
});

test('only the newest overlapping balance request can reconcile the display', async () => {
  const old = deferred();
  let calls = 0;
  const { state, controller } = setup({ fetchBalance: () => ++calls === 1 ? old.promise : Promise.resolve({ balance: 31 }) });
  const stale = controller.refresh();
  await controller.refresh();
  old.resolve({ balance: 20 });
  await stale;
  assert.deepEqual(state.balances, [31]);
});

test('offline, malformed responses, and inaccessible local outbox retain the saved balance', async () => {
  let calls = 0;
  const offline = setup({ fetchBalance: async () => { calls += 1; return { balance: 20 }; } });
  offline.state.online = false;
  await offline.controller.refresh();
  assert.equal(calls, 0);
  assert.equal(offline.state.statuses.at(-1).status, 'offline');
  for (const response of [{}, { balance: '20' }, { balance: -1 }, { balance: 2.5 }]) {
    const { state, controller } = setup({ fetchBalance: async () => response });
    await controller.refresh();
    assert.deepEqual(state.balances, []);
    assert.equal(state.statuses.at(-1).status, 'unavailable');
  }
  const unreadable = setup({ readCoinJobs: async () => { throw new Error('connection closing'); } });
  await unreadable.controller.refresh();
  assert.deepEqual(unreadable.state.balances, []);
  assert.equal(unreadable.state.statuses.at(-1).status, 'unavailable');
});
