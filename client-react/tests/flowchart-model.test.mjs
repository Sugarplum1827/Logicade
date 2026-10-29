import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,readdir} from 'node:fs/promises';
const scope={};
vm.runInNewContext(await readFile(new URL('../../games/runtime/flowchart-model.js',import.meta.url),'utf8'),scope);
const model=scope.LogiCadeFlowchartModel;
const load=async(trial,difficulty='standard')=>{
  const dir=new URL(`../../games/week_1/level2/${difficulty}/`,import.meta.url);
  const name=(await readdir(dir)).find(name=>name.endsWith(`)_${trial}.json`));
  return JSON.parse(await readFile(new URL(name,dir),'utf8')).flowchart;
};

for(const difficulty of ['standard','advanced','needs_support'])for(let trial=1;trial<=10;trial++){
  test(`flowchart ${trial} executes all reference cases at ${difficulty}`,async()=>{
    const puzzle=await load(trial,difficulty),result=model.check(puzzle,puzzle.solution);
    assert.equal(result.passed,true,JSON.stringify(result));
    assert.equal(result.passedCases,puzzle.cases.length);
    for(const piece of puzzle.pieces)if(piece.action.values)assert.equal(piece.kind,'process');
  });
}

test('all 360 Week 2 and examination flowcharts execute their authored cases',async()=>{
  let count=0;
  for(const week of [2,9])for(const level of week===2?Array.from({length:10},(_,i)=>i+1):[1,8])for(const difficulty of ['standard','advanced','needs_support']){
    const dir=new URL(`../../games/week_${week}/level${level}/${difficulty}/`,import.meta.url);
    for(const file of await readdir(dir))if(file.endsWith('.json')){const game=JSON.parse(await readFile(new URL(file,dir),'utf8'));const result=model.check(game.flowchart,game.flowchart.solution);assert.equal(result.passed,true,JSON.stringify(result));assert.equal(game.lesson.source_week,2);count++;}
  }
  assert.equal(count,360);
});

test('the even-number chart includes 100 and never prints 9',async()=>{
  const puzzle=await load(5),result=model.runCase(puzzle,puzzle.solution,puzzle.cases[0]);
  assert.deepEqual([...result.outputs],Array.from({length:46},(_,i)=>10+i*2));
});

test('odd-number boundaries, sum and count use strictly less than n',async()=>{
  const puzzle=await load(6);
  const nine=puzzle.cases.find(c=>c.inputs.n===9);
  assert.deepEqual([...model.runCase(puzzle,puzzle.solution,nine).outputs],[1,3,5,7,16,4]);
  puzzle.pieces.find(p=>p.id==='decide').action.test.op='<=';
  assert.equal(model.check(puzzle,puzzle.solution).passed,false);
});

test('wrong order and wrong symbol cannot pass by filling every position',async()=>{
  const puzzle=await load(1),wrong={...puzzle.solution,read:'calculate',calculate:'read'};
  assert.equal(model.check(puzzle,wrong).passed,false);
  const wrongStart={...puzzle.solution,start:'end',end:'start'};
  assert.ok(model.check(puzzle,wrongStart).errors.length>0);
});

test('a non-terminating learner loop is bounded and reports feedback',async()=>{
  const puzzle=await load(5);puzzle.max_steps=80;
  puzzle.pieces.find(p=>p.id==='increase').action.values[0].value={var:'i'};
  const result=model.check(puzzle,puzzle.solution);
  assert.equal(result.passed,false);
  assert.match(result.results[0].error,/loop did not finish/i);
});

test('equivalent independent assignments may be reordered when their output remains correct',async()=>{
  const puzzle=await load(6);
  const alternative={...puzzle.solution,sum:'count',count:'sum'};
  assert.equal(model.check(puzzle,alternative).passed,true);
});

test('unsupported operations are rejected without evaluating code',async()=>{
  const puzzle=await load(1);
  puzzle.pieces.find(p=>p.id==='calculate').action.values[0].value={op:'eval',args:['globalThis',0]};
  const result=model.check(puzzle,puzzle.solution);
  assert.equal(result.passed,false);
  assert.match(result.results[0].error,/not supported/i);
});
