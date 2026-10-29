import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { memoryDatabase, memoryStorage } from './helpers/memory-db.mjs';

const source = await readFile(new URL('../src/game/sync/worker.js', import.meta.url), 'utf8');
const job = (id, table, payload, extra = {}) => ({
  job_id: id, table, payload, status: 'pending', attempts: 0,
  created_at: '2026-10-27T00:00:00Z', next_retry_at: null, ...extra,
});
const ok = { ok: true, status: 200 };

test('a second caller awaits the active upload rather than reading stale server history',async()=>{
  let release,entered;
  const wait=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  const {worker}=setup([job('s','students',{student_id:'A'})],async call=>{
    if(call.path==='/api/sync/batch'){entered();await wait;}return ok;
  });
  const one=worker.drainQueue();await started;
  let finished=false;const two=worker.drainQueue().then(()=>{finished=true;});
  await Promise.resolve();assert.equal(finished,false);
  release();await Promise.all([one,two]);assert.equal(finished,true);
});

function setup(jobs, handler = () => ok) {
  const db = memoryDatabase({ sync_queue: jobs });
  const localStorage = memoryStorage({ logicade_current_user: 'A', logicade_session_token: 'token-a' });
  const calls = [];
  const sandbox = {
    window: { addEventListener() {} }, LogiCadeDB: { openDB: async () => db },
    navigator: { onLine: true }, localStorage, crypto: { randomUUID },
    queueMicrotask, setInterval() {}, console: { log() {}, error() {}, warn() {}, debug() {} },
    fetch: async (path, options) => {
      const call = { path, auth: options.headers.Authorization, body: JSON.parse(options.body) };
      calls.push(call);
      return handler(call, localStorage);
    },
  };
  vm.runInNewContext(source, sandbox);
  return { db, localStorage, calls, worker: sandbox.window.LogiCadeSync };
}

test('one drain uploads only the signed-in participant, in parent-first order', async () => {
  const jobs = [
    job('s', 'students', { student_id: 'A' }),
    job('l', 'levels', { student_id: 'A', level_id: 'L' }),
    job('a', 'level_attempts', { student_id: 'A', level_id: 'L', attempt_id: 'T' }),
    job('e', 'events', { student_id: 'A', level_id: 'L', attempt_id: 'T' }),
    job('c', 'coin_transactions', { student_id: 'A', level_id: 'L' }),
    job('d', 'difficulty_decisions', { student_id: 'A', previous_level_id: 'L' }),
    job('other', 'students', { student_id: 'B' }),
    job('other-dead', 'events', { student_id: 'B' }, { status: 'dead', last_error: '23503 foreign key constraint' }),
  ];
  const { worker, calls, db } = setup(jobs);
  await worker.drainQueue();
  const batches = calls.filter((call) => call.path === '/api/sync/batch');
  assert.deepEqual(batches.map((call) => call.body.table),
    ['students', 'levels', 'level_attempts', 'events', 'coin_transactions', 'difficulty_decisions']);
  assert.ok(batches.every((call) => call.auth === 'Bearer token-a' && call.body.rows.every((row) => row.student_id === 'A')));
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'other').status, 'pending');
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'other-dead').status, 'dead');
  assert.equal(calls.at(-1).body.failed_records, 0);
  assert.equal(calls.at(-1).body.pending_records, 0);
});

test('a rejected coin transaction does not block an unrelated difficulty decision', async () => {
  const { worker, calls, db } = setup([
    job('c', 'coin_transactions', { student_id: 'A' }),
    job('d', 'difficulty_decisions', { student_id: 'A', previous_level_id: 'existing' }),
  ], (call) => call.body.table === 'coin_transactions'
    ? { ok: false, status: 422, text: async () => 'not eligible' } : ok);
  await worker.drainQueue();
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'c').status, 'failed');
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'd').status, 'done');
  assert.equal(calls.at(-1).body.failed_records, 1);
});

test('a backed-off parent keeps child events queued until the server confirms it', async () => {
  const { worker, calls, db } = setup([
    job('l', 'levels', { student_id: 'A', level_id: 'L' }, {
      status: 'failed', next_retry_at: '2999-01-01T00:00:00Z',
    }),
    job('e', 'events', { student_id: 'A', level_id: 'L' }),
  ]);
  await worker.drainQueue();
  assert.equal(calls.filter((call) => call.path === '/api/sync/batch').length, 0);
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'e').status, 'pending');
});

test('known dead schema and FK failures recover once with reset backoff', async () => {
  const { worker, db } = setup([
    job('l', 'levels', { student_id: 'A', level_id: 'L' }, {
      status: 'dead', attempts: 20, last_error: 'PGRST204 schema cache', next_retry_at: '2999-01-01T00:00:00Z',
    }),
    job('e', 'events', { student_id: 'A', level_id: 'L' }, {
      status: 'dead', attempts: 20, last_error: '23503 foreign key constraint',
    }),
  ]);
  await worker.drainQueue();
  assert.ok(db.rows('sync_queue').every((row) => row.status === 'done' && row.attempts === 0));
});

test('changing accounts during upload never pairs old rows with the new token', async () => {
  let switched = false;
  const { worker, calls, db } = setup([
    job('a-student', 'students', { student_id: 'A' }),
    job('a-level', 'levels', { student_id: 'A', level_id: 'L' }),
    job('b-student', 'students', { student_id: 'B' }),
  ], (call, storage) => {
    if (!switched && call.body.table === 'students') {
      switched = true;
      storage.setItem('logicade_current_user', 'B');
      storage.setItem('logicade_session_token', 'token-b');
    }
    return ok;
  });
  await worker.drainQueue();
  for (let i = 0; i < 4; i++) await new Promise(setImmediate);
  assert.ok(calls.filter((call) => call.path === '/api/sync/batch').every((call) =>
    call.body.rows.every((row) => call.auth === `Bearer token-${row.student_id.toLowerCase()}`)));
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'a-level').status, 'pending');
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'b-student').status, 'done');
});

for (const [label, status, failure] of [
  ['the ownership API', 409, '{"detail":"A referenced attempt is not synchronized for this participant"}'],
  ['a legacy PostgREST response', 502, '{"code":"23503","details":"Key (attempt_id)=(T) is not present in table level_attempts"}'],
]) {
  test(`a missing server attempt reported by ${label} requeues its saved ancestors once`, async () => {
    let eventRequests = 0;
    const { worker, calls, db } = setup([
      job('level', 'levels', { student_id: 'A', level_id: 'L' }, { status: 'done' }),
      job('attempt', 'level_attempts', { student_id: 'A', level_id: 'L', attempt_id: 'T' }, { status: 'done' }),
      job('event', 'events', { student_id: 'A', event_id: 'E', level_id: 'L', attempt_id: 'T' }),
      job('unrelated', 'levels', { student_id: 'A', level_id: 'unrelated' }, { status: 'done' }),
      job('other', 'level_attempts', { student_id: 'B', level_id: 'L', attempt_id: 'T' }, { status: 'done' }),
    ], (call) => {
      if (call.body.table === 'events' && ++eventRequests === 1) {
        return { ok: false, status, text: async () => failure };
      }
      return ok;
    });
    await worker.drainQueue();
    for (let i = 0; i < 4; i++) await new Promise(setImmediate);
    const batches = calls.filter((call) => call.path === '/api/sync/batch');
    assert.deepEqual(batches.map((call) => call.body.table), ['events', 'levels', 'level_attempts', 'events']);
    assert.ok(batches.every((call) => call.auth === 'Bearer token-a' && call.body.rows.every((row) => row.student_id === 'A')));
    const events = batches.filter((call) => call.body.table === 'events');
    assert.deepEqual(events[0].body.rows, events[1].body.rows);
    const stored = db.rows('sync_queue');
    assert.equal(stored.find((row) => row.job_id === 'event').status, 'done');
    assert.equal(stored.find((row) => row.job_id === 'event').parent_recovery_attempts, 1);
    assert.equal(stored.find((row) => row.job_id === 'level').missing_parent_reuploads, 1);
    assert.equal(stored.find((row) => row.job_id === 'attempt').missing_parent_reuploads, 1);
    assert.equal(stored.find((row) => row.job_id === 'other').missing_parent_reuploads, undefined);
    assert.equal(stored.find((row) => row.job_id === 'unrelated').missing_parent_reuploads, undefined);
  });
}

test('persistent missing-parent failures stop immediate recovery after the bounded attempts', async () => {
  const { worker, calls, db } = setup([
    job('level', 'levels', { student_id: 'A', level_id: 'L' }, { status: 'done' }),
    job('event', 'events', { student_id: 'A', event_id: 'E', level_id: 'L' }),
  ], (call) => call.body.table === 'events'
    ? { ok: false, status: 409, text: async () => 'A referenced level is not synchronized for this participant' } : ok);
  await worker.drainQueue();
  for (let i = 0; i < 4; i++) await new Promise(setImmediate);
  const batches = calls.filter((call) => call.path === '/api/sync/batch');
  assert.equal(batches.filter((call) => call.body.table === 'events').length, 3);
  assert.equal(batches.filter((call) => call.body.table === 'levels').length, 2);
  const failed = db.rows('sync_queue').find((row) => row.job_id === 'event');
  assert.equal(failed.status, 'failed');
  assert.equal(failed.attempts, 3);
  assert.equal(failed.parent_recovery_attempts, 2);
  assert.ok(Date.parse(failed.next_retry_at) > Date.now());
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'level').missing_parent_reuploads, 2);
  await worker.drainQueue();
  assert.equal(calls.filter((call) => call.path === '/api/sync/batch').length, batches.length);
});

test('an unrelated conflict does not trigger missing-parent recovery', async () => {
  const { worker, calls, db } = setup([
    job('level', 'levels', { student_id: 'A', level_id: 'L' }, { status: 'done' }),
    job('coin', 'coin_transactions', { student_id: 'A', level_id: 'L' }),
  ], (call) => call.body.table === 'coin_transactions'
    ? { ok: false, status: 409, text: async () => 'A coin transaction ID cannot be reused for a different purchase' } : ok);
  await worker.drainQueue();
  for (let i = 0; i < 2; i++) await new Promise(setImmediate);
  assert.equal(calls.filter((call) => call.path === '/api/sync/batch').length, 1);
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'level').status, 'done');
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'coin').parent_recovery_attempts, undefined);
});

test('a parent recovery limit also applies to a different child referencing the same ID', async () => {
  const { worker, calls, db } = setup([
    job('level', 'levels', { student_id: 'A', level_id: 'L' }, { status: 'done', missing_parent_reuploads: 2 }),
    job('new-event', 'events', { student_id: 'A', event_id: 'E2', level_id: 'L' }),
  ], (call) => call.body.table === 'events'
    ? { ok: false, status: 409, text: async () => 'A referenced level is not synchronized for this participant' } : ok);
  await worker.drainQueue();
  for (let i = 0; i < 2; i++) await new Promise(setImmediate);
  assert.equal(calls.filter((call) => call.path === '/api/sync/batch').length, 1);
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'level').missing_parent_reuploads, 2);
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'new-event').status, 'failed');
});

test('recovery cannot resend a matching parent ID owned by another account', async () => {
  const { worker, calls, db } = setup([
    job('other-attempt', 'level_attempts', { student_id: 'B', level_id: 'L', attempt_id: 'T' }, { status: 'done' }),
    job('event', 'events', { student_id: 'A', event_id: 'E', level_id: 'L', attempt_id: 'T' }),
  ], (call) => call.body.table === 'events'
    ? { ok: false, status: 409, text: async () => 'A referenced attempt is not synchronized for this participant' } : ok);
  await worker.drainQueue();
  for (let i = 0; i < 2; i++) await new Promise(setImmediate);
  assert.equal(calls.filter((call) => call.path === '/api/sync/batch').length, 1);
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'other-attempt').status, 'done');
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'event').status, 'failed');
});

test('recovery preserves a newer backed-off parent payload queued during the upload', async () => {
  let db;
  const state = setup([
    job('level', 'levels', { student_id: 'A', level_id: 'L', game_title: 'Original' }, { status: 'done' }),
    job('event', 'events', { student_id: 'A', event_id: 'E', level_id: 'L' }),
  ], async (call) => {
    if (call.body.table === 'events') {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        tx.objectStore('sync_queue').put(job('newer-level', 'levels', {
          student_id: 'A', level_id: 'L', game_title: 'Updated',
        }, { status: 'failed', next_retry_at: '2999-01-01T00:00:00Z' }));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      return { ok: false, status: 409, text: async () => 'A referenced level is not synchronized for this participant' };
    }
    return ok;
  });
  db = state.db;
  await state.worker.drainQueue();
  for (let i = 0; i < 2; i++) await new Promise(setImmediate);
  assert.equal(state.calls.filter((call) => call.path === '/api/sync/batch').length, 1);
  const newer = db.rows('sync_queue').find((row) => row.job_id === 'newer-level');
  assert.equal(newer.payload.game_title, 'Updated');
  assert.equal(newer.status, 'failed');
  assert.equal(newer.next_retry_at, '2999-01-01T00:00:00Z');
  assert.equal(db.rows('sync_queue').find((row) => row.job_id === 'level').missing_parent_reuploads, undefined);
});
