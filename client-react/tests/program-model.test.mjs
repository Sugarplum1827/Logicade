import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,readdir} from 'node:fs/promises';
const scope={};
vm.runInNewContext(await readFile(new URL('../../games/runtime/c-runtime.js',import.meta.url),'utf8'),scope);
vm.runInNewContext(await readFile(new URL('../../games/runtime/program-model.js',import.meta.url),'utf8'),scope);
const model=scope.LogiCadeProgramModel;
const clone=x=>JSON.parse(JSON.stringify(x));
async function load(week,level=1,difficulty='standard',trial=1){
  const dir=new URL(`../../games/week_${week}/level${level}/${difficulty}/`,import.meta.url);
  const file=(await readdir(dir)).find(f=>f.endsWith(`)_${trial}.json`));
  return JSON.parse(await readFile(new URL(file,dir),'utf8')).programming;
}
for(const week of [3,5,6,7,8,9])test(`all week ${week} authored missions execute at every level and difficulty`,async()=>{
  let count=0;
  for(const difficulty of ['standard','advanced','needs_support'])for(let level=1;level<=10;level++)for(let trial=1;trial<=10;trial++){
    const m=await load(week,level,difficulty,trial);
    if(week===9&&[1,3,8].includes(level)){assert.equal(m,undefined);continue;}
    assert.ok(m,`Missing mission ${week}/${level}/${difficulty}/${trial}`);
    const result=model.check(m,clone(m.reference));
    assert.equal(result.passed,true,`${m.mission_id}: ${JSON.stringify(result.checks)} ${result.error}`);
    assert.ok(result.frames.length>0);
    count++;
  }
  assert.equal(count,week===9?210:300);
});
test('Week 4 uses researched archive facts rather than C-program execution',async()=>{
  assert.equal(await load(4),undefined);
});
test('terminal programs must compute outputs rather than acknowledge an answer',async()=>{
  const m=await load(3,2,'standard',2),solution=clone(m.reference);
  solution.programs[0]='MOV IN ACC\nMOV ACC OUT';
  assert.equal(model.check(m,solution).passed,false);
  solution.programs[0]='loop: JMP loop';
  assert.match(model.check(m,solution).error,/limit/);
  solution.programs[0]='fetch https://example.com';
  assert.match(model.check(m,solution).error,/unsupported/);
});
test('Week 2 uses flowchart construction instead of unrelated arithmetic circuits',async()=>{
  assert.equal(await load(2),undefined);
  const path=new URL('../../games/week_2/level1/standard/',import.meta.url),name=(await readdir(path)).find(f=>f.endsWith(')_1.json'));
  const game=JSON.parse(await readFile(new URL(name,path),'utf8'));
  assert.ok(game.flowchart.pieces.some(p=>p.kind==='input'));
  assert.equal(game.lesson.source_week,2);
});
test('factory output depends on belts, power, recipes and exact production limit',async()=>{
  const m=await load(5),s=clone(m.reference);
  assert.equal(model.check(m,{...s,wires:[]}).passed,false);
  const wrongBatch=clone(s);wrongBatch.machines.find(n=>['if_else','while','for'].includes(n.type)).quota=1;
  assert.equal(model.check(m,wrongBatch).passed,false);
  assert.equal(model.check(m,{...s,machines:s.machines.filter(n=>n.type!=='belt')}).passed,false);
  const changed=clone(s);changed.machines.find(n=>n.type==='assembler').dir='W';
  assert.equal(model.check(m,changed).passed,false);
});
test('factory sprite controllers enforce type, position, batch count and live branch decisions',async()=>{
  for(const trial of [1,2,3]){
    const m=await load(5,1,'standard',trial),s=clone(m.reference),result=model.check(m,s);
    assert.equal(result.passed,true,result.error);
    assert.ok(result.frames.some(f=>f.controller.action.includes('release')));
    const wrong=clone(s),controller=wrong.machines.find(n=>['if_else','while','for'].includes(n.type));
    controller.type=controller.type==='for'?'while':'for';assert.equal(model.check(m,wrong).passed,false);
    controller.type=m.controller.required_kind;controller.x=10;assert.equal(model.check(m,wrong).passed,false);
    if(m.controller.required_kind==='if_else')assert.ok(result.frames.some(f=>f.controller.action==='ELSE: wait'));
  }
});

test('conveyor geometry follows every straight direction and rounded turn',()=>{
  const delta={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};let turns=0;
  for(const [incoming,d] of Object.entries(delta))for(const [outgoing,e] of Object.entries(delta)){
    if(d[0]*e[0]+d[1]*e[1]===-1)continue;
    const belt={id:'turn',type:'belt',x:2,y:2,dir:outgoing};
    const feeder={id:'input',type:'belt',x:2-d[0],y:2-d[1],dir:incoming};
    const path=model.conveyorPath(belt,[feeder,belt]);
    assert.deepEqual(Array.from(path.start),[.5-d[0]*.5,.5-d[1]*.5]);
    assert.deepEqual(Array.from(path.end),[.5+e[0]*.5,.5+e[1]*.5]);
    assert.equal(path.curved,incoming!==outgoing);if(path.curved)turns++;
    // An adjacent piece pointing away must not cause a cosmetic false turn.
    feeder.dir=({N:'S',E:'W',S:'N',W:'E'})[incoming];
    assert.equal(model.conveyorPath(belt,[feeder,belt]).curved,false);
  }
  assert.equal(turns,8);
});

test('every assembly route transports through vertical sections and real bends',async()=>{
  for(const difficulty of ['needs_support','standard','advanced'])for(let level=1;level<=10;level++)for(let trial=1;trial<=10;trial++){
    const m=await load(5,level,difficulty,trial),s=clone(m.reference);
    assert.ok(s.machines.some(n=>n.type==='belt'&&['N','S'].includes(n.dir)&&!model.conveyorPath(n,s.machines).curved),`Missing straight vertical conveyor: ${m.mission_id}`);
    const corner=s.machines.find(n=>n.type==='belt'&&model.conveyorPath(n,s.machines).curved);
    assert.ok(corner,`Missing curved conveyor: ${m.mission_id}`);
    assert.ok(s.machines.filter(n=>n.type==='belt'&&!m.machines.some(initial=>initial.id===n.id)).some(n=>model.conveyorPath(n,s.machines).curved),'The missing pieces should include a corner');
    corner.dir=({N:'S',E:'W',S:'N',W:'E'})[corner.dir];
    assert.equal(model.check(m,s).passed,false,'An incorrectly directed bend must break production');
  }
});

test('all fork and join layouts conserve items and meet each branch and destination contract',async()=>{
  const topologies=new Set(),types=new Set();
  for(let trial=1;trial<=10;trial++){
    const m=await load(5,3,'standard',trial),result=model.check(m,clone(m.reference));
    topologies.add(m.routing.topology);types.add(m.routing.fork.type);
    assert.equal(result.passed,true,result.error);
    for(const frame of result.frames){
      const items=Object.values(frame.buffers);
      assert.equal(new Set(items.map(i=>i.id)).size,items.length,'A split must not duplicate an item');
      assert.equal(items.length+frame.delivered,frame.released,'No item may disappear at a junction');
    }
    const last=result.frames.at(-1);
    for(const goal of m.routing.targets){
      assert.equal(last.branch_delivered[goal.id],goal.target);
      assert.equal(result.checks.find(c=>c.id==='branch_'+goal.id).passed,true);
    }
    if(m.routing.merge){
      const counts=last.merge_accepted.merge;
      for(const goal of m.routing.targets)assert.equal(counts[goal.id],goal.target,'Both streams must pass the merger');
    }else{
      for(const goal of m.routing.targets)assert.equal(last.delivered_by_output[goal.output],goal.target);
    }
  }
  assert.deepEqual([...topologies].sort(),['merge_endpoint','merge_midpoint','separate_outputs']);
  assert.deepEqual([...types].sort(),['router','splitter']);
});

test('conditional routing uses actual item values and correct processing paths',async()=>{
  for(const trial of [2,4,6]){
    const m=await load(5,1,'standard',trial),s=clone(m.reference),r=model.check(m,s),f=s.machines.find(n=>n.type==='router');
    assert.equal(r.passed,true,r.error);
    for(const frame of r.frames)for(const action of Object.values(frame.routes))if(action.status==='sent'){
      const expected=f.condition.kind==='even'?action.value%2===0:action.value>=f.condition.value;
      assert.equal(action.branch,expected?'IF':'ELSE');
    }
    f.condition=f.condition.kind==='even'?{kind:'threshold',value:1}:{kind:'even'};
    assert.equal(model.check(m,s).passed,false,'A different condition must not pass by coincidental totals');
    const swapped=clone(m.reference),fork=swapped.machines.find(n=>n.type==='router');
    [fork.outputs.IF,fork.outputs.ELSE]=[fork.outputs.ELSE,fork.outputs.IF];
    assert.equal(model.check(m,swapped).passed,false,'Sending branches through the wrong processors must fail');
  }
});

test('blocked split and conditional branches wait without diverting or losing items',async()=>{
  for(const trial of [1,2]){
    const m=await load(5,1,'standard',trial),s=clone(m.reference);
    s.machines=s.machines.filter(n=>n.id!=='upper_corner');
    const r=model.check(m,s);assert.equal(r.passed,false);assert.match(r.error,/stalled/);
    assert.ok(r.frames.some(f=>Object.values(f.routes).some(a=>a.status==='waiting')));
    for(const frame of r.frames)assert.equal(Object.keys(frame.buffers).length+frame.delivered,frame.released);
    assert.equal(r.frames.at(-1).branch_delivered[m.routing.fork.branches[0]],0);
  }
});

test('mergers alternate ready inputs without overwriting their one-item buffer',async()=>{
  const m=await load(5,5,'advanced',3),r=model.check(m,clone(m.reference));
  assert.equal(r.passed,true,r.error);
  let previous={};const accepted=[];
  for(const frame of r.frames){
    const current=frame.merge_accepted.merge||{};
    const added=m.routing.targets.filter(g=>(current[g.id]||0)>(previous[g.id]||0));
    assert.ok(added.length<=1,'A merger accepts at most one item per cycle');
    if(added.length)accepted.push(added[0].id);
    previous=current;
  }
  assert.ok(accepted.includes('A')&&accepted.includes('B'));
  const midpoint=await load(5,5,'advanced',5),baseline=model.check(midpoint,clone(midpoint.reference));
  const slow=clone(midpoint);slow.recipes.assembler.ticks=20;
  const slowResult=model.check(slow,clone(slow.reference));assert.equal(slowResult.passed,true,slowResult.error);
  assert.ok(slowResult.frames.length>baseline.frames.length,'Downstream congestion must apply backpressure');
  const inputIds=slow.reference.machines.filter(n=>n.x===8&&[2,4].includes(n.y)).map(n=>n.id);
  let lastAccepted=null,bothReady=0;
  for(let i=1;i<slowResult.frames.length;i++){
    const before=slowResult.frames[i-1],now=slowResult.frames[i];
    const previousCounts=before.merge_accepted.merge||{},counts=now.merge_accepted.merge||{};
    const branch=slow.routing.targets.find(g=>(counts[g.id]||0)>(previousCounts[g.id]||0))?.id;
    if(!before.buffers.merge&&inputIds.every(id=>before.buffers[id]&&before.buffers[id].ready<=now.tick)){
      bothReady++;assert.ok(branch,'A ready merger should accept one waiting item');
      if(lastAccepted)assert.notEqual(branch,lastAccepted,'Ready upstream branches must alternate fairly');
    }
    if(branch)lastAccepted=branch;
    assert.equal(Object.keys(now.buffers).length+now.delivered,now.released);
  }
  assert.ok(bothReady>0,'The congestion fixture must exercise simultaneous waiting inputs');
  const missing=clone(m.reference);missing.machines=missing.machines.filter(n=>n.type!=='merger');
  assert.equal(model.check(m,missing).passed,false);
});
test('adventure maps contain real junctions, dead ends, loops and reachable branches',async()=>{
  const maps=new Set();
  for(const difficulty of ['needs_support','standard','advanced'])for(const level of [1,5,10]){
    const m=await load(6,level,difficulty,3),rows=m.map;
    assert.ok(rows[0].length>=13&&rows.length>=9);
    assert.ok(m.map_features.junctions>=3);
    assert.ok(m.map_features.cycles>0);
    maps.add(rows.join('\n'));
    const seen=new Set([m.start.join(',')]),queue=[m.start];
    for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const p=[x+dx,y+dy],key=p.join(',');if(rows[p[1]]?.[p[0]]==='.'&&!seen.has(key)){seen.add(key);queue.push(p);}}}
    assert.ok(seen.has(m.exit.join(',')));for(const gem of m.gems)assert.ok(seen.has(gem.join(',')));
  }
  assert.equal(maps.size,9);
});
test('adventure goals require collision-free movement, collectibles, exit and scoped values',async()=>{
  const m=await load(6),s=clone(m.reference);
  assert.equal(model.check(m,{program:'moveUp(1);'}).passed,false);
  assert.equal(model.check(m,{program:'observe(1);'}).passed,false);
  assert.equal(model.check(m,{program:s.program.replace('printf(', 'writeOutput(999); printf(')}).passed,false);
  assert.match(model.check(m,{program:'#include <stdio.h>\nint main(void) { int x = 1; { int y = 2; } printf("%d\\n", y); return 0; }'}).error,/scope/);
  assert.match(model.check(m,{program:'window.alert(1);'}).error,/unsupported/i);
});
test('safe expressions respect precedence and reject arbitrary access',()=>{
  assert.equal(model.expression('2 + 3 * 4',()=>0),14);
  assert.equal(model.expression('(2 + 3) * 4',()=>0),20);
  assert.throws(()=>model.expression('constructor.constructor(1)',()=>0));
  assert.throws(()=>model.expression('1 / 0',()=>0));
});

test('Week 8 circuits require real wiring, C scopes and sensor reads',async()=>{
  for(const level of [1,3,5,6,8,10]){
    const m=await load(8,level),s=clone(m.reference);
    assert.equal(m.family,'circuit');assert.equal(m.circuit_kind,'scope_controller');
    assert.equal(m.map,undefined);
    const result=model.check(m,s);assert.equal(result.passed,true,result.error);
    assert.equal(new Set(result.frames.map(f=>f.case_id)).size,3);
    assert.ok(result.frames.some(f=>Object.keys(f.globals).length));
    assert.ok(result.frames.some(f=>Object.keys(f.locals).length));
    assert.ok(result.frames.some(f=>f.source_line>0));
    assert.equal(model.check(m,{...s,wires:[]}).passed,false);
    assert.equal(model.check(m,{...s,wires:[['input','output'],['controller','output']]}).passed,false);
    const wrong=clone(s);wrong.programs.controller=wrong.programs.controller.replace('readInput()','0');
    assert.equal(model.check(m,wrong).passed,false);
    const noGlobal=clone(s);noGlobal.programs.controller=noGlobal.programs.controller.replace(/int steps(?: = \d+)?;/,'');
    assert.equal(model.check(m,noGlobal).passed,false);
  }
  const m=await load(8,8),s=clone(m.reference);
  s.programs.controller=s.programs.controller.replace(/\{ int steps = \d+; printf\("%d\\n", steps\); \}/,'printf("%d\\n", 1);');
  assert.equal(model.check(m,s).passed,false,'Both sibling scopes must exist');
});

test('signal networks broadcast, merge every branch and terminate feedback before output',async()=>{
  const widths=new Set();
  for(const trial of [1,2,3]){
    const m=await load(8,1,'standard',trial),s=clone(m.reference),network=m.signal_network;
    assert.equal(network.version,2);widths.add(network.branch_ids.length);
    const r=model.check(m,s);assert.equal(r.passed,true,r.error);
    for(const c of m.cases){
      const frames=r.frames.filter(f=>f.case_id===c.id);
      for(const round of Array.from({length:network.passes},(_,i)=>i+1)){
        for(const id of network.branch_ids)assert.ok(frames.some(f=>f.active_node===id&&f.scope_node===id&&f.source_line&&f.round===round));
        const merged=frames.find(f=>f.active_node==='merge'&&f.active_edge?.[1]==='loop'&&f.round===round);
        assert.ok(merged,'Every complete branch batch reaches the feedback controller');
        assert.equal(merged.values.merge,network.branch_ids.reduce((total,id)=>total+merged.values[id],0));
      }
      assert.equal(frames.filter(f=>f.active_node==='loop'&&f.active_edge?.[1]==='split').length,network.passes-1);
      assert.equal(frames.filter(f=>f.active_node==='output'&&f.outputs.length===c.expected.length).length,1);
      assert.deepEqual(Array.from(frames.at(-1).outputs),c.expected);
    }
    const broken=clone(s);broken.wires=broken.wires.filter(w=>!(w[0]===network.branch_ids.at(-1)&&w[1]==='merge'));
    assert.equal(model.check(m,broken).passed,false,'A missing merger input cannot silently disappear');
    const bypass=clone(s);bypass.wires.push(['split','output']);assert.equal(model.check(m,bypass).passed,false);
    const duplicate=clone(s);duplicate.wires.push(duplicate.wires[0]);assert.equal(model.check(m,duplicate).passed,false);
    const runaway=clone(s);runaway.nodes.find(n=>n.id==='loop').passes=100000;assert.equal(model.check(m,runaway).passed,false);
    const wrong=clone(s);wrong.programs[network.branch_ids[0]]='#include "logicade.h"\nint main(void) { int signal = readInput(); writeOutput(signal); return 0; }';
    assert.equal(model.check(m,wrong).passed,false,'Every branch must compute its assigned transformation');
    const infinite=clone(s);infinite.programs[network.branch_ids[0]]='#include "logicade.h"\nint main(void) { while(1) {} return 0; }';
    assert.match(model.check(m,infinite).error,/limit/i);
  }
  assert.deepEqual([...widths].sort(),[2,3,4]);
});
test('week seven requires the declared C type and state, not only matching output',async()=>{
  const m=await load(7,1,'standard',2),s=clone(m.reference);
  s.programs[0]=s.programs[0].replace('int resource','double resource').replace('%d','%.1f');
  assert.equal(model.check(m,s).passed,false);
});
test('dynamic JSON cannot disable verification or unbound execution',async()=>{
  const m=await load(3),s=clone(m.reference);
  for(const changed of [{...m,cases:[]},{...m,rules:{...m.rules,max_steps:Infinity}},{...m,family:'unknown'},{...m,rules:{...m.rules,max_nodes:10000}}]){
    const result=model.check(changed,s);assert.equal(result.passed,false);assert.equal(result.correct,0);
  }
});
