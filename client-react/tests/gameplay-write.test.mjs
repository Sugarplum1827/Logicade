import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { memoryDatabase, memoryStorage } from './helpers/memory-db.mjs';

const source = await readFile(new URL('../src/game/db/write.js', import.meta.url), 'utf8');
const spec = { game_id: 'source-game', game_title: 'Original', sprite_ids: [], map: 'forest' };
const scope = { studentId: 'A', levelId: 'L', week: 1, difficulty: 'standard', spec };

function setup(initial = {}) {
  const db = memoryDatabase(initial);
  let events = [];
  const session = { attemptId: 'run-one', studentId: 'A', levelId: 'L' };
  const sandbox = {
    window: {
      Telemetry: { snapshot: () => events.slice(), session: () => ({ ...session }) },
      LogiCadeSync: { drainQueue: async () => {} },
    },
    LogiCadeDB: { openDB: async () => db },
    LogiCadeRollups: { rebuildLocalRollups: async () => {} },
    navigator: { onLine: true }, crypto: { randomUUID },
    localStorage: memoryStorage(), console,
  };
  vm.runInNewContext(source, sandbox);
  return { db, write: sandbox.window.LogiCadeWrite, setEvents: (value) => { events = value; } };
}

test('starting a level queues its parent once and preserves its original assignment', async () => {
  const { db, write } = setup({ levels: [
    { level_id: 'old-zero', student_id: 'A', level_index: 0 },
    { level_id: 'old-two', student_id: 'A', level_index: 2 },
    { level_id: 'other', student_id: 'B', level_index: 10 },
  ] });
  const first = await write.ensureLevel(scope);
  const again = await write.ensureLevel({ ...scope, difficulty: 'advanced', spec: { ...spec, game_title: 'Replay' } });
  assert.equal(first.level_index, 3);
  assert.equal(again.difficulty_assigned, 'standard');
  assert.equal(again.game_title, 'Original');
  assert.equal(db.rows('sync_queue').filter((job) => job.table === 'levels').length, 1);
  await assert.rejects(write.ensureLevel({ ...scope, levelId: 'other' }), /different participant/);
});

test('a level stage number is saved locally and included in the pending sync job', async () => {
  const { db, write } = setup();
  const row = await write.ensureLevel({ ...scope, stageNumber: 4 });
  assert.equal(row.stage_number, 4);
  const jobs = db.rows('sync_queue').filter((job) => job.table === 'levels');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].payload.stage_number, 4);
});

test('assigned and actual served categories are independent persisted fields',async()=>{
  const {db,write}=setup();
  const row=await write.ensureLevel({...scope,assignedDifficulty:'advanced',difficulty:'standard'});
  assert.equal(row.difficulty_assigned,'advanced');assert.equal(row.difficulty_served,'standard');
  assert.equal(db.rows('sync_queue').find(j=>j.table==='levels').payload.difficulty_assigned,'advanced');
});

test('legacy level records gain a missing stage and completed queue jobs get a follow-up sync', async () => {
  const { db, write } = setup({
    levels: [{ level_id: 'L', student_id: 'A', week: 1, level_index: 0, stage_number: null }],
    sync_queue: [{ job_id: 'old-upload', created_at: '2026-01-01T00:00:00.000Z',
      table: 'levels', op: 'upsert', payload: { level_id: 'L', student_id: 'A' },
      status: 'done', attempts: 1 }],
  });
  const row = await write.ensureLevel({ ...scope, stageNumber: 1 });
  assert.equal(row.stage_number, 1);
  const jobs = db.rows('sync_queue').filter((job) => job.table === 'levels');
  assert.equal(jobs.length, 2);
  assert.equal(jobs.find((job) => job.status === 'pending').payload.stage_number, 1);
});

test('saving an ended run preserves event time, origin and OpenCode provenance', async () => {
  const { db, write, setEvents } = setup();
  setEvents([{ event_id: 'event-original', event_type: 'question_answered',
    created_at: '2026-10-27T02:00:00.000Z', t_ms_since_start: 400, origin: 'offline',
    payload: { correct: true } }]);
  const pending = write.persistAttempt({ ...scope,
    meta: { generated_game: { game_id: 'platformer_quest', variation_id: 'platformer_v3' } },
    score: 150, accuracy: 0.75, errorCount: 1, hintCount: 1,
    completionTimeSec: 20, won: false, status: 'restarted',
  });
  // Simulate a different game taking over the global buffer during the save.
  setEvents([{ event_id: 'new-run-event', event_type: 'game_started' }]);
  const attempt = await pending;
  const event = db.rows('events')[0];
  assert.equal(attempt.score, 0.75);
  assert.equal(attempt.restart_count, 1);
  assert.equal(attempt.completed, false);
  assert.equal(attempt.variation_id, 'platformer_v3');
  assert.equal(event.event_id, 'event-original');
  assert.equal(event.created_at, '2026-10-27T02:00:00.000Z');
  assert.equal(event.payload.origin, 'offline');
});

test('a repeated completion callback for the same run cannot create a second attempt', async () => {
  const { write, db } = setup();
  const result = { ...scope, score: 0.8, accuracy: 0.8, errorCount: 1, hintCount: 0,
    completionTimeSec: 10, won: true };
  const first = await write.persistAttempt(result);
  const duplicate = await write.persistAttempt(result);
  assert.equal(first.attempt_id, duplicate.attempt_id);
  assert.equal(db.rows('attempts').length, 1);
  assert.equal(db.rows('sync_queue').filter((job) => job.table === 'level_attempts').length, 1);
});

test('native attempts retain authoritative revisions without adding unsupported sync columns or tickets', async () => {
  const { write, db, setEvents } = setup();
  setEvents([{ event_type: 'code_run', payload: { success: true } }]);
  const revision = 'a'.repeat(64);
  const result = { ...scope, spec: { ...spec, file_id: 'canonical-slot',
    phaser_template: { template_id: 'stale-phaser', seed: 1 } },
    meta: { consumption_token: 'private-ticket', generated_game: {
      runtime: 'native_canvas', game_id: 'canvas-variables', variation_id: 'v2', seed: 42,
      template_version: '2', content_revision: revision, content_origin: 'llm_verified_pool',
      learning_objective_id: 'w7-l7',
    } }, score: 1, accuracy: 1, won: true, completionTimeSec: 5 };
  const attempt = await write.persistAttempt(result);
  assert.equal(attempt.template_id, 'canvas-variables');
  assert.equal(attempt.variation_seed, 42);
  assert.equal(attempt.content_revision, revision);
  const jobs = db.rows('sync_queue');
  const payload = jobs.find((job) => job.table === 'level_attempts').payload;
  for (const key of ['content_revision', 'content_origin', 'learning_objective_id', 'week', 'level_index']) {
    assert.equal(Object.hasOwn(payload, key), false);
  }
  for (const event of db.rows('events')) {
    assert.equal(event.payload.content_revision, revision);
    assert.equal(event.payload.source_file_id, 'canonical-slot');
    assert.equal(event.payload.content_origin, 'llm_verified_pool');
  }
  assert.equal(db.rows('events').filter((event) => event.event_type === 'challenge_revision').length, 1);
  assert.equal(JSON.stringify(jobs).includes('private-ticket'), false);
  await write.persistAttempt(result);
  assert.equal(db.rows('events').length, 2);
});

test('empty telemetry still preserves distinct revisions played from the same canonical slot', async () => {
  const { write, db } = setup();
  for (const [index, revision] of ['a'.repeat(64), 'b'.repeat(64)].entries()) {
    await write.persistAttempt({ ...scope, attemptId: `revision-run-${index}`,
      meta: { generated_game: { runtime: 'native_canvas', content_revision: revision,
        content_origin: 'llm_verified_pool' } }, score: 0, won: false, completionTimeSec: 1 });
  }
  assert.equal(db.rows('attempts').length, 2);
  const events = db.rows('events');
  assert.equal(events.length, 2);
  assert.equal(events[0].event_type, 'challenge_revision');
  assert.notEqual(events[0].payload.content_revision, events[1].payload.content_revision);
  assert.equal(db.rows('sync_queue').filter((job) => job.table === 'events').length, 2);
});
