import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,readdir} from 'node:fs/promises';
const scope={};
for(const name of ['c-runtime.js','terminal-network-model.js'])vm.runInNewContext(await readFile(new URL(`../../games/runtime/${name}`,import.meta.url),'utf8'),scope);
const model=scope.LogiCadeTerminalNetworkModel;
async function load(week,level=1,trial=1,difficulty='standard'){
  const dir=new URL(`../../games/week_${week}/level${level}/${difficulty}/`,import.meta.url),name=(await readdir(dir)).find(n=>n.endsWith(`)_${trial}.json`));
  return JSON.parse(await readFile(new URL(name,dir),'utf8'));
}
test('all authored TIS and C terminal missions execute through connected multi-node programs',async()=>{
  let count=0;
  for(const week of [3,7,9])for(let level=1;level<=10;level++)for(const difficulty of ['needs_support','standard','advanced'])for(let trial=1;trial<=10;trial++){
    const game=await load(week,level,trial,difficulty);if(game.programming?.family!=='terminal')continue;
    const m=model.adapt(game.programming,game.seed),r=model.check(m,m.reference);
    assert.equal(r.passed,true,`${week}/${level}/${trial}/${difficulty}: ${JSON.stringify(r.checks)}`);
    assert.ok(m.nodes.length>=4);assert.ok(r.frames.some(f=>f.transfers.length));
    assert.ok(m.nodes.every(node=>node.language==='c_subset'));
    assert.ok(m.reference.programs.every(source=>source.includes('int main(void)')));
    assert.ok(m.reference.programs.every(source=>!/^\s*(MOV|ADD|MUL|JMP)\b/m.test(source)));
    assert.equal(new Set(r.frames.map(f=>f.case_index)).size,m.cases.length);
    count++;
  }
  assert.equal(count,660);
});
test('every node must be programmed, wrong ports fail, and stalled connections do not win',async()=>{
  const game=await load(3,2),m=model.adapt(game.programming,game.seed);
  const wrong=JSON.parse(JSON.stringify(m.reference));wrong.programs[2]='# empty';
  assert.equal(model.check(m,wrong).passed,false);
  wrong.programs[2]='#include "logicade.h"\nint main(void) { int value = readPort(UP); writePort(DOWN, value); return 0; }';assert.match(model.check(m,wrong).error,/not connected/);
  wrong.programs[2]='#include "logicade.h"\nint main(void) { while (1) {} return 0; }';assert.match(model.check(m,wrong).error,/limit/);
  wrong.programs[2]='#include "logicade.h"\nint main(void) { int value = readPort(LEFT); writePort(DOWN, 0); return 0; }';assert.equal(model.check(m,wrong).passed,false);
  wrong.programs[2]='MOV LEFT ACC\nMOV ACC DOWN';assert.equal(model.check(m,wrong).passed,false);
});
test('traces identify actual C statements without highlighting comments or directives',async()=>{
  const game=await load(3),m=model.adapt(game.programming,game.seed),s=JSON.parse(JSON.stringify(m.reference));
  s.programs[0]='#include "logicade.h"\n// comment\nint main(void) {\nint value = readPort(UP);\nwritePort(RIGHT, value);\nreturn 0;\n}';
  const r=model.check(m,s);assert.equal(r.passed,true);
  const active=r.frames.map(f=>f.nodes[0].active_line).filter(Boolean);
  assert.ok(active.includes(4)&&active.includes(5));assert.equal(active.includes(1),false);
});
test('C compute nodes preserve type validation and highlight actual C source statements',async()=>{
  const game=await load(7),m=model.adapt(game.programming,game.seed),r=model.check(m,m.reference);
  assert.equal(r.passed,true);assert.ok(r.frames.some(f=>f.nodes[0].active_line>0));
  const wrong=JSON.parse(JSON.stringify(m.reference));wrong.programs[0]=wrong.programs[0].replace('int resource','double resource').replace('%d','%.1f');
  assert.equal(model.check(m,wrong).passed,false);
});
