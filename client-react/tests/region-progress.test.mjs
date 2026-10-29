import test from 'node:test';
import assert from 'node:assert/strict';
import { regionProgress, validCompletedStages } from '../src/game/regionProgress.js';
import { memoryStorage } from './helpers/memory-db.mjs';
const regions=Array.from({length:9},(_,i)=>({id:`w${i+1}`,week:i+1}));

test('existing Kingdom stage completions unlock Week 2 without a played-region flag or replay',()=>{
  const storage=memoryStorage({logicade_levels_A_w1:'[1,2]'});
  const progress=regionProgress(storage,'A',regions);
  assert.equal(progress[1].complete,true);
  assert.equal(progress[2].unlocked,true);
  assert.equal(progress[3].unlocked,false);
});
test('unfinished stages and obsolete played-region counters do not unlock a week',()=>{
  const progress=regionProgress(memoryStorage({logicade_levels_A_w1:'[1]',logicade_played_regions_A:'{"w1":10}'}),'A',regions);
  assert.equal(progress[1].unlocked,true);
  assert.equal(progress[1].complete,false);
  assert.equal(progress[2].unlocked,false);
});
test('each later region needs all ten distinct valid stage completions',()=>{
  const storage=memoryStorage({logicade_levels_A_w1:'[1,2]',logicade_levels_A_w2:'[1,2,3,4,5,6,7,8,9,9]'});
  assert.equal(regionProgress(storage,'A',regions)[3].unlocked,false);
  storage.setItem('logicade_levels_A_w2','[1,2,3,4,5,6,7,8,9,10]');
  assert.equal(regionProgress(storage,'A',regions)[3].unlocked,true);
});
test('server and offline completion records merge and survive map remounts without crossing accounts',()=>{
  const storage=memoryStorage({logicade_levels_A_w1:'[1]'});
  const progress=regionProgress(storage,'A',regions,{1:[2]});
  assert.equal(progress[2].unlocked,true);
  storage.setItem('logicade_levels_A_w1',JSON.stringify(progress[1].completed));
  assert.equal(regionProgress(storage,'A',regions)[2].unlocked,true);
  assert.equal(regionProgress(storage,'B',regions)[2].unlocked,false);
});
test('malformed and hidden retired-stage records cannot falsely complete Kingdom',()=>{
  assert.deepEqual(validCompletedStages([1,1,3,10,'2',true,null],1),[1]);
  const storage=memoryStorage({logicade_levels_A_w1:'not json'});
  assert.equal(regionProgress(storage,'A',regions)[2].unlocked,false);
  assert.equal(regionProgress(storage,'A',regions,{1:[1,2,3,4,5,6,7,8,9,10]})[2].unlocked,true);
});
