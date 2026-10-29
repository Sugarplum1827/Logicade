import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,readdir} from 'node:fs/promises';
const scope={};vm.runInNewContext(await readFile(new URL('../../games/runtime/c-runtime.js',import.meta.url),'utf8'),scope);
const c=scope.LogiCadeC;
const wrap=body=>'#include <stdio.h>\nint main(void) { '+body+' return 0; }';

test('C if/else, while and for loops execute with proper scopes and bounded steps',()=>{
  assert.deepEqual([...c.run(wrap('int x = 3; if (x > 2) { x += 4; } else { x = 0; } printf("%d\\n", x);')).outputs],[7]);
  assert.deepEqual([...c.run(wrap('int x = 0; if (0) { x = 5; } else if (1) { x = 2; } printf("%d\\n", x);')).outputs],[2]);
  assert.deepEqual([...c.run(wrap('int x = 4; while (x > 0) { x--; } printf("%d\\n", x);')).outputs],[0]);
  assert.deepEqual([...c.run(wrap('int total = 0; for (int i = 1; i <= 4; i++) { total += i; } printf("%d\\n", total);')).outputs],[10]);
  assert.throws(()=>c.run(wrap('for (int i = 0; i < 2; i++) {} printf("%d\\n", i);')),/scope/);
  assert.throws(()=>c.run(wrap('while (1) {}'),{max_steps:30}),/limit/);
});

test('C port helpers preserve fractions and characters and record reads at their source statement',()=>{
  const program='#include "logicade.h"\nint main(void) {\n double value = readPort(LEFT);\n writePort(RIGHT, value);\n return 0;\n}';
  const writes=[];const result=c.run(program,{readPort:direction=>{assert.equal(direction,3);return 1.75;},writePort:(direction,value)=>writes.push([direction,value])});
  assert.deepEqual(writes,[[1,1.75]]);assert.equal(result.input_reads,1);
  assert.equal(result.trace[0].source_line,3);assert.equal(result.trace[0].input_reads,1);
  const character=c.run(program.replace('double value','char value'),{readPort:()=> 'K',writePort:()=>{}});
  assert.deepEqual([...character.outputs],['K']);
  assert.throws(()=>c.run(program),/node game/);
  assert.throws(()=>c.run(program.replace('#include "logicade.h"','')),/logicade.h|scope/);
});

test('C integer and floating division, type conversion and character output are distinct',()=>{
  assert.deepEqual([...c.run(wrap('int n = 7 / 2; printf("%d\\n", n);')).outputs],[3]);
  assert.deepEqual([...c.run(wrap('double n = 7.0 / 2; printf("%.1f\\n", n);')).outputs],[3.5]);
  assert.deepEqual([...c.run(wrap("char letter = 'A'; printf(\"%c\\n\", letter);")).outputs],['A']);
  assert.throws(()=>c.run(wrap('float n = 1.5f; printf("%d\\n", n);')),/format/);
});
test('file-scope zero initialization and nested local shadowing preserve the global',()=>{
  const source='#include <stdio.h>\nint n;\nint main(void) { { int n = 7; printf("%d\\n", n); } printf("%d\\n", n); return 0; }';
  const result=c.run(source);assert.deepEqual([...result.outputs],[7,0]);assert.equal(result.globals.n,0);
  assert.throws(()=>c.run(wrap('{ int hidden = 2; } printf("%d\\n", hidden);')),/scope/);
  assert.throws(()=>c.run(wrap('int n; printf("%d\\n", n);')),/uninitialized/);
});
test('C preprocessing, names, source structure and execution are bounded',()=>{
  assert.deepEqual([...c.run('#include <stdio.h>\n#define N 4\nint main(void) { int n = N + 1; printf("%d\\n", n); return 0; }').outputs],[5]);
  for(const source of [wrap('int return = 3;'),wrap('printf("%d\\n", missing);'),wrap('system("x");'),'int n = 2;',wrap('int n = 1 / 0;'),wrap('int n = 1; int n = 2;')])assert.throws(()=>c.run(source));
  assert.throws(()=>c.run(wrap('int x = 3; printf("%d\\n", x);'),{max_steps:1}),/limit/);
  assert.throws(()=>c.run('#define N 999999999999999999999\nint main(void) { return 0; }'),/oversized/);
  assert.throws(()=>c.run(wrap('printf("line\nbreak");')),/escape/);
});
test('every source assembly requires valid C structure, output and keyword categories',async()=>{
  const folder=new URL('../../games/week_5/level1/standard/',import.meta.url);
  for(const name of await readdir(folder)){
    const m=JSON.parse(await readFile(new URL(name,folder),'utf8')).programming,s=m.source_exercise;
    assert.deepEqual([...c.sourceCheck(s,s.reference_order,s.categories).outputs],s.expected);
    assert.throws(()=>c.sourceCheck(s,s.reference_order,{...s.categories,printf:'keyword'}),/printf/);
    const order=s.reference_order.slice();[order[0],order[3]]=[order[3],order[0]];
    assert.throws(()=>c.sourceCheck(s,order,s.categories));
  }
});
