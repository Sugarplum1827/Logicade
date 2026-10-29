import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const scope = vm.createContext({window:{addEventListener() {}}});
vm.runInContext(fs.readFileSync(new URL('../../games/runtime/lesson-guide.js',import.meta.url),'utf8'),scope);
const stepsFor = scope.LogiCadeFirstVisitGuide.stepsFor;
test('all introductory game variations provide mission-specific pointer targets', () => {
  for (let week=1;week<=9;week++) for (const difficulty of ['needs_support','standard','advanced']) {
    const level=week===1?2:1;
    const dir=new URL(`../../games/week_${week}/level${level}/${difficulty}/`,import.meta.url);
    for (const name of fs.readdirSync(dir).filter(n=>n.endsWith('.json'))) {
      const game=JSON.parse(fs.readFileSync(new URL(name,dir),'utf8'));
      const steps=stepsFor(game);
      assert.ok(steps.length>=3,`Week ${week} ${name}`);
      for (const step of steps) {
        assert.ok(step.title && step.text);
        assert.ok(step.selector || step.action || step.box);
        if (Array.isArray(step.box)) assert.ok(step.box.every(Number.isFinite));
        if (typeof step.box==='function') {
          for (const canvas of [{clientWidth:1200,clientHeight:900},{clientWidth:390,clientHeight:700}]) {
            assert.ok(step.box(canvas).every(Number.isFinite));
          }
        }
      }
      if(game.programming?.family==='adventure')assert.ok(steps.some(s=>s.title==='Reach the exit'));
      if(game.programming?.family==='terminal')assert.ok(steps.some(s=>s.title==='Program the connected nodes'));
    }
  }
});
test('the welcome video has no gameplay pointers',()=>assert.equal(stepsFor({mode:'welcome_video'}).length,0));
