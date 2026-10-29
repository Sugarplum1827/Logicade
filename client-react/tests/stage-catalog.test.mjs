import test from 'node:test';
import assert from 'node:assert/strict';
import { stageCountForWeek } from '../src/game/stageCatalog.js';
import { resolveStageDifficulty } from '../src/game/difficultyDecisions.js';
import { memoryDatabase, memoryStorage } from './helpers/memory-db.mjs';

test('the opening region ends after stage two; later regions retain ten stages',()=>{
  assert.equal(stageCountForWeek(1),2);
  assert.equal(stageCountForWeek('1'),2);
  for(let week=2;week<=9;week++)assert.equal(stageCountForWeek(week),10);
});

test('watching orientation does not become scored adaptation evidence',async()=>{
  const result=await resolveStageDifficulty({week:1,stage:2,
    openDB:()=>{throw Error('The video must not be queried as a scored attempt');},
    chooseDifficulty:()=>{throw Error('No adaptation rule can run without a scored activity');}});
  assert.deepEqual(result,{difficulty:'standard',decision:null});
});

test('the orientation update preserves an existing served stage-two decision',async()=>{
  const decision={decision_id:'OLD',student_id:'A',previous_level_id:'L1',
    difficulty_selected:'advanced',difficulty_served:'advanced',inputs:{selected_level:2}};
  const db=memoryDatabase({levels:[{level_id:'L1',student_id:'A'}],attempts:[],difficulty_decisions:[decision]});
  const result=await resolveStageDifficulty({studentId:'A',regionId:'w1',week:1,stage:2,
    storage:memoryStorage({logicade_level_id_A_w1_1:'L1'}),openDB:async()=>db,
    chooseDifficulty:()=>{throw Error('Video completion cannot replace a saved decision');}});
  assert.equal(result.difficulty,'advanced');
  assert.equal(result.decision.decision_id,'OLD');
});

test('a saved orientation with no decision starts its first activity at Standard',async()=>{
  const db=memoryDatabase({levels:[{level_id:'L1',student_id:'A'}],attempts:[],difficulty_decisions:[]});
  const result=await resolveStageDifficulty({studentId:'A',regionId:'w1',week:1,stage:2,
    storage:memoryStorage({logicade_level_id_A_w1_1:'L1'}),openDB:async()=>db,
    chooseDifficulty:()=>{throw Error('An orientation is not scored adaptation evidence');}});
  assert.deepEqual(result,{difficulty:'standard',decision:null});
});
