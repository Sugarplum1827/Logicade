import test from 'node:test';
import assert from 'node:assert/strict';
import { guidanceKey, needsFirstVisitGuidance as needs } from '../src/game/firstVisitGuidance.js';
const store = (data = {}) => ({ getItem: key => data[key] ?? null });
test('Kingdom guides stage 2; other regions guide stage 1 only', () => {
  for (let week = 1; week <= 9; week++) for (let level = 1; level <= 10; level++) {
    assert.equal(needs(store(), 'A', week, level), level === (week === 1 ? 2 : 1));
  }
  assert.equal(needs(store(), '', 2, 1), false);
  assert.equal(needs(store(), 'A', 10, 1), false);
});
test('completion is separate for each participant and region', () => {
  const storage = store({ [guidanceKey('A', 2)]: 'done' });
  assert.equal(needs(storage, 'A', 2, 1), false);
  assert.equal(needs(storage, 'B', 2, 1), true);
  assert.equal(needs(storage, 'A', 3, 1), true);
});
test('already completed introductory stages do not trigger the guide', () => {
  assert.equal(needs(store({ logicade_levels_A_w1: '[1]' }), 'A', 1, 2), true);
  assert.equal(needs(store({ logicade_levels_A_w1: '[1,2]' }), 'A', 1, 2), false);
  assert.equal(needs(store({ logicade_levels_A_w7: '[1]' }), 'A', 7, 1), false);
  assert.equal(needs(store({ logicade_levels_A_w7: 'invalid' }), 'A', 7, 1), true);
});
