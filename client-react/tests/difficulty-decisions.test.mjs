import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { buildDifficultyDecision, resolveStageDifficulty, cacheServerDifficulty } from '../src/game/difficultyDecisions.js';
import { unfinishedPerformance } from '../src/game/unfinishedAttempt.js';
import { memoryDatabase, memoryStorage } from './helpers/memory-db.mjs';

const engine = { window: {} };
vm.runInNewContext(await readFile(new URL('../src/game/engine/difficulty.js', import.meta.url), 'utf8'), engine);
const chooseDifficulty = engine.window.LogiCadeDifficulty.nextDifficulty;
let decisionSequence = 0;
const attempt = (number, accuracy, completed, extra = {}) => ({
  attempt_id: `T${number}`, student_id: 'A', level_id: 'L1', attempt_number: number,
  accuracy, completed, status: completed ? 'completed' : 'failed', error_count: 1, ...extra,
});
const build = (attempts, existingDecision) => buildDifficultyDecision({
  studentId: 'A', previousLevelId: 'L1', nextLevel: 2, previousDifficulty: 'standard',
  attempts, existingDecision, chooseDifficulty, idFactory: () => `D${++decisionSequence}`, now: () => '2026-10-28T00:00:00Z',
});

for (const [accuracy, replays, expected] of [
  [.59, 0, 'needs_support'], [.6, 0, 'standard'], [.6, 2, 'needs_support'],
  [.79, 0, 'standard'], [.8, 0, 'advanced'], [.8, 2, 'standard'],
]) {
  test(`approved threshold ${accuracy} with ${replays} full replays selects ${expected}`, () => {
    const history = [attempt(1, accuracy, true)];
    for (let n = 0; n < replays; n++) history.push(attempt(n + 2, 1, true));
    assert.equal(build(history).decision.difficulty_selected, expected);
  });
}

test('first failure stays the adaptation input after a later successful attempt', () => {
  const { decision } = build([attempt(1, .4, false), attempt(2, 1, true),
    attempt(3, 1, false, { status: 'restarted' })]);
  assert.equal(decision.difficulty_selected, 'needs_support');
  assert.equal(decision.inputs.first_attempt_accuracy, .4);
  assert.equal(decision.inputs.full_level_replays, 0);
  assert.equal(decision.inputs.total_errors, 3);
});

test('unfinished first runs retain their history but cannot become scored evidence',()=>{
  const {decision}=build([attempt(1,0,false,{status:'abandoned'}),attempt(2,.5,false,{status:'restarted'}),attempt(3,.9,true)]);
  assert.equal(decision.difficulty_selected,'advanced');
  assert.equal(decision.inputs.first_evaluated_attempt_number,3);
  assert.equal(decision.inputs.first_attempt_accuracy,.9);
  const failed=build([attempt(1,0,false,{status:'abandoned'}),attempt(2,.4,false),attempt(3,1,true)]).decision;
  assert.equal(failed.difficulty_selected,'needs_support');
  assert.equal(failed.inputs.first_evaluated_attempt_number,2);
});

test('exit keeps partial answer accuracy instead of replacing it with zero',()=>{
  const result=unfinishedPerformance([{event_type:'question_answered',payload:{correct:true}},
    {event_type:'question_answered',payload:{correct:false}},{event_type:'hint_used'}]);
  assert.equal(result.accuracy,.5);assert.equal(result.score,50);assert.equal(result.errorCount,1);assert.equal(result.hintCount,1);
  assert.equal(unfinishedPerformance([]).accuracy,0); // No evaluated answers; unfinished status excludes this placeholder.
});

test('region entry uses the preceding region’s final playable stage offline',async()=>{
  for(const [week,lastStage] of [[2,2],[3,10],[9,10]]){
    const db=memoryDatabase({levels:[{level_id:'L1',student_id:'A',difficulty_served:'advanced'}],attempts:[attempt(1,.9,true)]});
    const storage=memoryStorage({[`logicade_level_id_A_w${week-1}_${lastStage}`]:'L1'});
    const result=await resolveStageDifficulty({studentId:'A',regionId:`w${week}`,week,stage:1,storage,openDB:async()=>db,persistDecision:async()=>{},chooseDifficulty});
    assert.equal(result.difficulty,'advanced');assert.equal(result.decision.inputs.previous_level,lastStage);
    assert.equal(result.decision.inputs.previous_week,week-1);
  }
});

test('a fresh device recovers server decisions, level identities and attempts without requeueing them',async()=>{
  const db=memoryDatabase(),storage=memoryStorage();
  const decision={...build([attempt(1,.9,true)]).decision,rule_version:'cp1-60-v2',inputs:{selected_level:2,selected_week:7}};
  const data={difficulty:'advanced',decision,week:7,stage:2,target_level_id:'L2',
    levels:[{level_id:'L1',student_id:'A',week:7,stage_number:1}],attempts:[attempt(1,.9,true)]};
  const result=await resolveStageDifficulty({studentId:'A',regionId:'w7',week:7,stage:2,storage,openDB:async()=>db,
    fetchServerDecision:async()=>data,persistDecision:async()=>assert.fail('Server rows must not be queued back to the server'),chooseDifficulty});
  assert.equal(result.difficulty,'advanced');assert.equal(storage.getItem('logicade_level_id_A_w7_1'),'L1');
  assert.equal(storage.getItem('logicade_level_id_A_w7_2'),'L2');assert.equal(db.rows('attempts').length,1);
  assert.equal(db.rows('sync_queue').length,0);
  await assert.rejects(cacheServerDifficulty({data,studentId:'B',regionId:'w7',storage,openDB:async()=>db}),/invalid difficulty history/);
});

test('server history never overwrites a pending local attempt',async()=>{
  const local=attempt(1,.9,true),server={...local,accuracy:0};
  const db=memoryDatabase({attempts:[local],sync_queue:[{job_id:'Q',table:'level_attempts',status:'pending',payload:local}]}),storage=memoryStorage();
  await cacheServerDifficulty({data:{difficulty:'advanced',decision:null,week:7,stage:2,target_level_id:'L2',levels:[],attempts:[server]},
    studentId:'A',regionId:'w7',storage,openDB:async()=>db});
  assert.equal(db.rows('attempts')[0].accuracy,.9);
});

test('reopening a stage reuses its decision and changed unserved evidence preserves history', () => {
  const history = [attempt(1, .8, true)];
  const first = build(history).decision;
  assert.deepEqual(build(history, first), { decision: first, changed: false });
  const replayed = [...history, attempt(2, .9, true), attempt(3, .9, true)];
  const updated = build(replayed, first);
  assert.equal(updated.changed, true);
  assert.notEqual(updated.decision.decision_id, first.decision_id);
  assert.equal(updated.decision.inputs.supersedes_decision_id, first.decision_id);
  assert.equal(updated.decision.difficulty_selected, 'standard');
  assert.equal(first.difficulty_selected, 'advanced');
});

test('served choice and actual served difficulty survive subsequent replay evidence', () => {
  const selected = build([attempt(1, .8, true)]).decision;
  const served = { ...selected, next_level_id: 'L2', difficulty_served: 'standard' };
  const actual = build([attempt(1, .8, true), attempt(2, 1, true), attempt(3, 1, true)], served);
  assert.equal(actual.changed, false);
  assert.equal(actual.decision.difficulty_selected, 'advanced');
  assert.equal(actual.decision.difficulty_served, 'standard');
});

test('missing first-attempt evidence and another participant’s decision cannot choose a default', () => {
  const other = { ...build([attempt(1, .9, true)]).decision, student_id: 'B', difficulty_served: 'advanced' };
  assert.throws(() => build([], other), /history is unavailable/);
  assert.throws(() => build([attempt(2, 1, true)]), /history is unavailable/);
});

function resolverState(initial = {}) {
  const db = memoryDatabase({
    levels: [{ level_id: 'L1', student_id: 'A', difficulty_served: 'standard' }],
    attempts: [attempt(1, .4, false), attempt(2, .9, true)], ...initial,
  });
  const storage = memoryStorage({ logicade_level_id_A_kingdom_1: 'L1' });
  const saved = [];
  const resolve = () => resolveStageDifficulty({ studentId: 'A', regionId: 'kingdom', stage: 2,
    storage, openDB: async () => db, persistDecision: async (decision) => saved.push(decision), chooseDifficulty });
  return { resolve, saved, storage, db };
}

test('completion followed by Exit and stage-node selection keeps the same approved choice', async () => {
  const { resolve, saved, storage } = resolverState();
  const completed = await resolve();
  const reopened = await resolve();
  assert.equal(completed.difficulty, 'needs_support');
  assert.equal(reopened.decision.decision_id, completed.decision.decision_id);
  assert.equal(saved.length, 1);
  assert.equal(JSON.parse(storage.getItem('logicade_difficulty_A_kingdom'))[2], 'needs_support');
});

test('a served IndexedDB decision recovers the stage index without inventing missing attempts', async () => {
  const original = { ...build([attempt(1, .9, true)]).decision, difficulty_served: 'standard', next_level_id: 'L2' };
  const { resolve, saved } = resolverState({ attempts: [], difficulty_decisions: [original] });
  const result = await resolve();
  assert.equal(result.difficulty, 'advanced');
  assert.equal(result.decision.difficulty_served, 'standard');
  assert.equal(saved.length, 0);
});

test('missing local evidence and account changes do not save a Standard fallback', async () => {
  const { resolve, saved, storage, db } = resolverState({ attempts: [] });
  await assert.rejects(resolve(), /history is unavailable/);
  assert.equal(saved.length, 0);
  assert.equal(storage.getItem('logicade_difficulty_A_kingdom'), null);
  await assert.rejects(resolveStageDifficulty({ studentId: 'A', regionId: 'kingdom', stage: 2,
    storage, openDB: async () => db, persistDecision: async () => saved.push('unexpected'), chooseDifficulty,
    isCurrentSession: () => false,
  }), /history is unavailable/);
  const state = resolverState();
  await assert.rejects(resolveStageDifficulty({ studentId: 'A', regionId: 'kingdom', stage: 2,
    storage: state.storage, openDB: async () => state.db, persistDecision: async () => saved.push('unexpected'),
    chooseDifficulty, isCurrentSession: () => false,
  }), /account changed/);
  assert.equal(saved.length, 0);
});
