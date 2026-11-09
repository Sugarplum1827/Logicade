import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { measureInterval } from '../src/game/studySession.js';

test('only visible time beyond the last input grace period counts as inactivity', () => {
  assert.deepEqual(measureInterval(30_000, 80_000, 0, true), { active: 30_000, inactive: 20_000 });
  assert.deepEqual(measureInterval(80_000, 170_000, 0, false), { active: 0, inactive: 0 });
  assert.deepEqual(measureInterval(170_000, 180_000, 170_000, true), { active: 10_000, inactive: 0 });
});

test('a scored submission times the prompt and excludes pauses, guidance, and hidden time', async () => {
  const source = await readFile(new URL('../../games/runtime/study-telemetry.js', import.meta.url), 'utf8');
  let now = 0;
  const document = new EventTarget();
  document.hidden = false;
  const window = new EventTarget();
  window.parent = {};
  const sandbox = { document, window, performance: { now: () => now }, LogiCadeFirstVisitGuide: { active: false } };
  vm.runInNewContext(source, sandbox);
  const study = sandbox.LogiCadeStudyTelemetry;
  study.start();
  study.present();
  now = 100;
  study.setPaused(true);
  now = 500;
  study.setPaused(false);
  now = 700;
  sandbox.LogiCadeFirstVisitGuide.active = true;
  window.dispatchEvent(new Event('logicade:guidance_changed'));
  now = 1000;
  sandbox.LogiCadeFirstVisitGuide.active = false;
  window.dispatchEvent(new Event('logicade:guidance_changed'));
  now = 1100;
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  now = 1400;
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  now = 1500;
  study.submit((type, { payload }) => {
    assert.equal(type, 'scored_submission');
    assert.equal(payload.correct, false);
    assert.equal(payload.response_ms, 500);
  }, 'activity', 'mission', false, study.takeResponseTime());
  assert.equal(study.takeResponseTime(), null);
  assert.equal(study.activePlayMs(), 500);
});
