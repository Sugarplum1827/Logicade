/* Bounded data interpreters. Student text is parsed; never evaluated as JavaScript. */
(() => {
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
  const finite=n=>{assert(Number.isFinite(n)&&Math.abs(n)<=1e9,'Numeric limit exceeded.');return n;};
  function expression(source,lookup){
    const tokens=String(source).match(/\d+(?:\.\d+)?|[A-Za-z_]\w*|==|!=|<=|>=|&&|\|\||[()+*/%<>!\-]/g)||[];
    assert(tokens.join('')===String(source).replace(/\s/g,''),'Unsupported expression.');
    let pos=0;
    const priority={'||':1,'&&':2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6};
    function read(min=0,depth=0){
      assert(depth<30,'Expression nesting limit exceeded.');
      const t=tokens[pos++];let a;
      if(t==='-'||t==='!'){const n=read(7,depth+1);a=t==='-'?-n:Number(!n);}
      else if(t==='('){a=read(0,depth+1);assert(tokens[pos++]===')','Missing closing parenthesis.');}
      else if(/^\d/.test(t||''))a=Number(t);
      else {assert(/^[A-Za-z_]\w*$/.test(t||''),'Expected a number or variable.');a=lookup(t);}
      while(pos<tokens.length&&(priority[tokens[pos]]||0)>min){
        const op=tokens[pos++],b=read(priority[op],depth+1);
        if(op==='+')a+=b;else if(op==='-')a-=b;else if(op==='*')a*=b;
        else if(op==='/'||op==='%'){assert(b!==0,'Division by zero.');a=op==='/'?Math.trunc(a/b):a%b;}
        else a=Number(op==='=='?a===b:op==='!='?a!==b:op==='<'?a<b:op==='>'?a>b:op==='<='?a<=b:op==='>='?a>=b:op==='&&'?Boolean(a&&b):Boolean(a||b));
      }
      return finite(a);
    }
    const result=read();assert(pos===tokens.length,'Unexpected expression tokens.');return result;
  }
  function terminal(m,programs,test){
    if(m.language==='c_subset'){
      assert(programs.length===1,'This C station has one program.');const outputs=[],frames=[];let last;
      for(const input of test.inputs){last=globalThis.LogiCadeC.run(programs[0],{inputs:[input],max_steps:m.rules.max_steps});
        for(const row of last.trace)frames.push({tick:frames.length,nodes:[{pc:-1,acc:row.outputs.at(-1)??0,bak:0,vars:row.variables,mode:'C execution'}],outputs:[...outputs,...row.outputs],stdout:row.stdout});
        assert(last.outputs.length===1,'Print exactly one result for each input value.');outputs.push(...last.outputs);
      }return {outputs,frames,variables:last.variables,types:last.types};
    }
    assert(programs.length===m.nodes.length,'Each terminal node requires a program.');
    const nodes=programs.map(source=>{
      assert(typeof source==='string'&&source.length<=12000,'Node program is too long.');
      const lines=source.split(/\r?\n/).map(s=>s.split('#')[0].trim()).filter(Boolean),labels={};
      assert(lines.length<=m.rules.max_lines,'Node instruction limit exceeded.');
      const code=[];for(const line of lines){const label=line.match(/^([A-Za-z_]\w*):\s*(.*)$/);if(label){assert(!Object.hasOwn(labels,label[1]),'Duplicate label.');labels[label[1]]=code.length;if(label[2])code.push(label[2]);}else code.push(line);}
      assert(code.length>0,'Every node needs instructions.');return {code,labels,pc:0,acc:0,bak:0,vars:{},stack:[],mode:'idle'};
    });
    const queues=Array.from({length:nodes.length+1},()=>[]);queues[0]=test.inputs.slice();
    const frames=[],outputs=[];
    for(let tick=0;tick<m.rules.max_steps;tick++){
      let progressed=false;
      nodes.forEach((node,index)=>{
        const line=node.code[node.pc],parts=line.replace(/,/g,' ').split(/\s+/),op=parts[0].toUpperCase();let next=(node.pc+1)%node.code.length;
        assert(m.instruction_set.includes(op),`Node ${index+1}: unsupported instruction ${op}.`);
        const get=x=>x?.toUpperCase()==='ACC'?node.acc:x?.toUpperCase()==='BAK'?node.bak:/^-?\d+$/.test(x||'')?Number(x):Object.hasOwn(node.vars,x)?node.vars[x]:Object.hasOwn(m.constants||{},x)?m.constants[x]:(()=>{throw Error(`Undefined register or variable: ${x}`);})();
        node.mode='exec';
        if(op==='MOV'){
          assert(parts.length===3,'MOV requires source and destination.');
          if(parts[1].toUpperCase()==='IN'&&!queues[index].length){node.mode='read blocked';return;}
          if(parts[2].toUpperCase()==='OUT'&&index<nodes.length-1&&queues[index+1].length>=8){node.mode='write blocked';return;}
          const value=parts[1].toUpperCase()==='IN'?queues[index].shift():get(parts[1]);
          if(parts[2].toUpperCase()==='OUT'){if(index===nodes.length-1)outputs.push(value);else queues[index+1].push(value);}
          else {assert(parts[2].toUpperCase()==='ACC','MOV destination must be ACC or OUT.');node.acc=value;}
        }else if(['ADD','SUB','MUL'].includes(op)){assert(parts.length===2,`${op} requires one operand.`);const x=get(parts[1]);node.acc=finite(op==='ADD'?node.acc+x:op==='SUB'?node.acc-x:node.acc*x);}
        else if(op==='NEG')node.acc=-node.acc;
        else if(op==='SAV')node.bak=node.acc;
        else if(op==='SWP')[node.acc,node.bak]=[node.bak,node.acc];
        else if(op==='PUSH'){
          assert(m.practice_only===true,'Stack instructions belong to the memory practice lab.');
          assert(parts.length===2&&node.stack.length<32,'PUSH needs one value; stack capacity is 32.');node.stack.push(finite(get(parts[1])));
        }else if(op==='POP'){
          assert(m.practice_only===true,'Stack instructions belong to the memory practice lab.');
          assert(parts.length===2&&parts[1].toUpperCase()==='ACC','Use POP ACC.');
          assert(node.stack.length>0,'Stack underflow: PUSH a value before POP.');node.acc=node.stack.pop();
        }
        else if(op==='INT'||op==='SET'){
          assert(parts.length===3&&/^[a-z_]\w*$/i.test(parts[1]),'Use INT name value or SET name value.');
          assert(op==='INT'||Object.hasOwn(node.vars,parts[1]),'Declare the variable with INT first.');
          // INT is an executable initialization on each input iteration.
          node.vars[parts[1]]=get(parts[2]);
        }else if(['JMP','JEZ','JGZ','JLZ'].includes(op)){
          assert(Object.hasOwn(node.labels,parts[1]),'Jump label not found.');
          if(op==='JMP'||op==='JEZ'&&node.acc===0||op==='JGZ'&&node.acc>0||op==='JLZ'&&node.acc<0)next=node.labels[parts[1]];
        }
        node.pc=next;progressed=true;
      });
      frames.push({tick,nodes:clone(nodes.map(({pc,acc,bak,vars,stack,mode})=>({pc,acc,bak,vars,stack,mode}))),outputs:outputs.slice(),queues:clone(queues)});
      if(outputs.length>=test.expected.length&&queues.every(q=>q.length===0)&&nodes.every(n=>n.pc===0))return {outputs,frames,variables:clone(nodes[0].vars)};
      assert(progressed,'Deadlock: nodes are waiting for input or space.');
    }
    throw Error('Cycle limit reached. Check loops and node connections.');
  }
  function runScopeController(m,source,inputs){
    assert(typeof source==='string'&&source.length<=12000&&source.split('\n').length<=m.rules.max_lines,'Controller C source is missing or too long.');
    const ast=globalThis.LogiCadeC.parse(source),contract=m.scope_contract;
    assert(contract&&contract.global_names.every(name=>ast.globals.some(n=>n.name===name&&n.type==='int')),'Declare the required int variable at file scope, before main.');
    const declarations=[];let block=0;
    function visit(node,depth=0,parent=0){if(!node||typeof node!=='object')return;
      if(node.kind==='block'){const id=++block;for(const child of node.statements)visit(child,depth+1,id);return;}
      if(node.kind==='declare')declarations.push({name:node.name,depth,parent});
      for(const [key,value] of Object.entries(node))if(key!=='statements'&&value&&typeof value==='object'){
        if(Array.isArray(value))value.forEach(v=>visit(v,depth,parent));else visit(value,depth,parent);
      }
    }visit(ast.main);
    if(contract.local_name)assert(declarations.some(n=>n.name===contract.local_name&&n.depth>=contract.minimum_depth),'Declare the required local variable in its intended block scope.');
    if(contract.sibling_blocks)assert(new Set(declarations.filter(n=>n.name===contract.local_name&&n.depth===2).map(n=>n.parent)).size>=2,'Use two separate sibling local blocks.');
    if(contract.zero_initialized_global)assert(ast.globals.some(n=>n.name==='steps'&&n.value===null),'Demonstrate implicit file-scope zero initialization with int steps; before main.');
    const r=globalThis.LogiCadeC.run(source,{inputs,max_steps:m.rules.max_steps});
    assert(r.input_reads===1,'Read the sensor signal once for each test case.');
    assert(Object.entries(m.expected_globals).every(([name,value])=>r.globals[name]===value),'The final global values do not match the scope contract.');
    return r;
  }
  function scopeCircuit(m,solution,test){
    if(m.signal_network?.version===2)return scopeNetwork(m,solution,test);
    const nodes=solution.nodes,wires=solution.wires,source=solution.programs?.controller;
    assert(Array.isArray(nodes)&&nodes.length===m.nodes.length,'Keep the sensor, controller and output probe.');
    assert(new Set(nodes.map(n=>n.id)).size===nodes.length&&m.nodes.every(n=>nodes.some(v=>v.id===n.id&&v.type===n.type)),'Circuit components cannot change roles.');
    assert(Array.isArray(wires)&&wires.length===2&&wires.every(w=>Array.isArray(w)&&w.length===2),'Connect exactly the two required signal wires.');
    assert(wires.some(w=>w[0]==='input'&&w[1]==='controller')&&wires.some(w=>w[0]==='controller'&&w[1]==='output'),'Wire sensor input → controller → output; bypassing the controller is not a solution.');
    const r=runScopeController(m,source,test.inputs);
    return {outputs:r.outputs,variables:r.variables,types:r.types,frames:r.trace.map(row=>({
      input:test.inputs[0],case_id:test.id,values:{input:test.inputs[0],controller:row.outputs.at(-1)??'—',output:row.outputs.at(-1)??'—'},
      outputs:row.outputs,globals:row.globals,locals:row.locals,source_line:row.source_line,input_reads:row.input_reads,stdout:row.stdout,
    }))};
  }
  function scopeNetwork(m,solution,test){
    const network=m.signal_network,nodes=solution.nodes,wires=solution.wires,programs=solution.programs;
    assert(Array.isArray(nodes)&&nodes.length===m.nodes.length&&nodes.length<=m.rules.max_nodes,'Keep every component required by this network.');
    assert(new Set(nodes.map(n=>n.id)).size===nodes.length&&m.nodes.every(n=>nodes.some(v=>v.id===n.id&&v.type===n.type)),'Network component identities and roles must remain.');
    const ids=new Set(nodes.map(n=>n.id)),key=w=>JSON.stringify(w);
    assert(Array.isArray(wires)&&wires.length<=64&&wires.every(w=>Array.isArray(w)&&w.length===2&&ids.has(w[0])&&ids.has(w[1])&&w[0]!==w[1]),'Every signal wire needs two different existing endpoints.');
    assert(new Set(wires.map(key)).size===wires.length,'Duplicate signal wires are not allowed.');
    assert(Array.isArray(network.required_wires)&&equal(wires.map(key).sort(),network.required_wires.map(key).sort()),'Connect every required branch, merger input, feedback path and final output. Remove unintended bypass wires.');
    assert(Array.isArray(network.branch_ids)&&network.branch_ids.length>=2&&network.branch_ids.length<=6,'A network needs 2–6 branch controllers.');
    assert(network.merge_mode==='sum','This mission combines branches with SUM.');
    const loop=nodes.find(n=>n.id==='loop');
    assert(Number.isInteger(loop?.passes)&&loop.passes>=1&&loop.passes<=6&&loop.passes===network.passes,'Set the required bounded feedback pass count (1–6).');
    assert(Number.isInteger(network.max_queue)&&network.max_queue>0&&network.max_queue<=64,'Invalid network queue limit.');
    assert(Number.isInteger(m.scope_trace_length)&&m.scope_trace_length>0&&m.scope_trace_length<30,'Missing C scope trace contract.');
    const outgoing=id=>wires.filter(w=>w[0]===id).map(w=>w[1]);
    const incoming=id=>wires.filter(w=>w[1]===id).map(w=>w[0]);
    const pending=[{to:'input',from:null,value:test.inputs[0],round:1}],merges=new Map(),values={},frames=[],watch=[];
    let ticks=0,budget=0,lastScope=null,lastScopeNode=null,controllerState=null,controllerRuns=0,outputCount=0,completedPasses=0;
    function snapshot(fields={}){
      frames.push({tick:ticks,input:test.inputs[0],case_id:test.id,values:clone(values),outputs:watch.slice(),
        globals:clone(lastScope?.globals||{}),locals:clone(lastScope?.locals||{}),scope_node:lastScopeNode,source_line:null,
        round:completedPasses+1,passes:loop.passes,pending:pending.length,...fields});
      assert(frames.length<=m.rules.max_steps*2,'Signal trace limit exceeded.');
    }
    function send(from,to,value,round){
      finite(value);assert(pending.length<network.max_queue,'Signal queue capacity exceeded.');
      pending.push({from,to,value,round});snapshot({active_node:from,active_edge:[from,to],round});
    }
    function execute(id,value,round){
      const source=programs?.[id];
      assert(typeof source==='string'&&source.length<=12000&&source.split('\n').length<=m.rules.max_lines,`C program missing or too long: ${id}.`);
      const r=id==='controller'?runScopeController(m,source,[value]):globalThis.LogiCadeC.run(source,{inputs:[value],max_steps:m.rules.max_steps});
      budget+=r.steps;assert(budget<=m.rules.max_steps,'Network execution limit reached. Reduce the controller loops.');
      assert(r.input_reads===1,`${id}: read exactly one incoming signal.`);
      if(id==='controller'){
        assert(++controllerRuns===1,'The scope controller runs once before the feedback network.');
        assert(r.outputs.length===m.scope_trace_length+1&&r.outputs.at(-1)===value,'Print the scope trace, then forward the original signal once.');
        controllerState=r;
      }else{
        const task=network.branch_tasks?.[id];assert(task&&['add','multiply'].includes(task.operation)&&Number.isInteger(task.operand)&&Math.abs(task.operand)<=30,'Invalid branch task.');
        const expected=finite(task.operation==='add'?value+task.operand:value*task.operand);
        assert(r.outputs.length===1&&r.outputs[0]===expected,`${id}: ${task.description}`);
      }
      for(const row of r.trace){
        if(id==='controller')watch.splice(0,watch.length,...row.outputs.slice(0,m.scope_trace_length));
        lastScope=row;lastScopeNode=id;
        snapshot({active_node:id,round,globals:row.globals,locals:row.locals,source_line:row.source_line,stdout:row.stdout});
      }
      return r.outputs.at(-1);
    }
    while(pending.length){
      assert(++ticks<=m.rules.max_steps&&++budget<=m.rules.max_steps,'Network execution limit reached. Check feedback termination.');
      const token=pending.shift(),node=nodes.find(n=>n.id===token.to);assert(node,'Signal reached a missing component.');
      assert(Number.isInteger(token.round)&&token.round>=1&&token.round<=loop.passes,'Feedback exceeded the allowed passes.');
      values[node.id]=token.value;snapshot({active_node:node.id,active_edge:token.from?[token.from,node.id]:null,round:token.round});
      if(node.type==='INPUT')outgoing(node.id).forEach(to=>send(node.id,to,token.value,token.round));
      else if(node.type==='MCU'){
        const value=execute(node.id,token.value,token.round);values[node.id]=value;
        outgoing(node.id).forEach(to=>send(node.id,to,value,token.round));
      }else if(node.type==='SPLITTER'){
        const targets=outgoing(node.id);assert(targets.length>=2,'A splitter must feed multiple branches.');
        targets.forEach(to=>send(node.id,to,token.value,token.round));
      }else if(node.type==='MERGER'){
        const inputs=incoming(node.id);assert(inputs.length>=2,'A merger must combine multiple incoming branches.');
        const batch=merges.get(token.round)||new Map();assert(!batch.has(token.from),'A merger received a duplicate branch result in one pass.');
        batch.set(token.from,token.value);merges.set(token.round,batch);
        if(inputs.every(id=>batch.has(id))){
          const sum=finite(inputs.reduce((total,id)=>total+batch.get(id),0));values[node.id]=sum;merges.delete(token.round);
          outgoing(node.id).forEach(to=>send(node.id,to,sum,token.round));
        }
      }else if(node.type==='LOOP'){
        assert(token.round===completedPasses+1,'Feedback passes must complete in order.');completedPasses=token.round;
        const next=token.round<loop.passes?'split':'output';
        assert(outgoing(node.id).includes(next),'Connect the feedback return and final output paths.');
        send(node.id,next,token.value,token.round<loop.passes?token.round+1:token.round);
      }else if(node.type==='OUTPUT'){
        assert(++outputCount===1&&completedPasses===loop.passes,'Output is permitted once, after every feedback pass.');
        watch.push(token.value);snapshot({active_node:node.id,round:token.round});
      }else throw Error('Unsupported signal component.');
    }
    assert(outputCount===1&&merges.size===0,'Network stalled: a branch or merger input is missing.');
    assert(controllerRuns===1&&completedPasses===network.passes,'The network must execute the scope controller and every required feedback pass.');
    return {outputs:watch,frames,variables:controllerState?.variables,types:controllerState?.types};
  }
  function circuit(m,solution,test){
    if(m.circuit_kind==='scope_controller')return scopeCircuit(m,solution,test);
    const nodes=solution.nodes,wires=solution.wires;
    assert(Array.isArray(nodes)&&nodes.length<=m.rules.max_nodes,'Component limit exceeded.');
    assert(new Set(nodes.map(n=>n.id)).size===nodes.length,'Duplicate component identifiers.');
    assert(nodes.find(n=>n.id==='input')?.type==='INPUT'&&nodes.find(n=>n.id==='output')?.type==='OUTPUT','Input and output ports must remain.');
    const incoming=new Map();
    for(const [a,b] of wires){assert(nodes.some(n=>n.id===a)&&nodes.some(n=>n.id===b),'Wire endpoint is missing.');assert(a!==b,'A component cannot connect to itself.');assert(!incoming.has(b),'Each component has only one input pin.');incoming.set(b,a);}
    const outputs=[],frames=[];
    for(const input of test.inputs){
      const values={},visiting=new Set();
      function read(id){
        if(Object.hasOwn(values,id))return values[id];assert(!visiting.has(id),'Feedback loop detected. Use an acyclic circuit.');visiting.add(id);
        const n=nodes.find(n=>n.id===id);assert(n,'Missing component.');let value=input;
        if(n.type!=='INPUT'){
          assert(incoming.has(id),`Connect the input pin of ${id}.`);value=read(incoming.get(id));
          assert(n.type==='OUTPUT'||m.palette.includes(n.type),'Component is not allowed in this mission.');
          const k=Number(n.value||0);assert(Number.isFinite(k)&&Math.abs(k)<=1000,'Invalid component value.');
          if(n.type==='ADD')value+=k;else if(n.type==='SUB')value-=k;else if(n.type==='MUL')value*=k;
          else if(n.type==='NEG')value=-value;else if(n.type==='SQUARE')value*=value;
        }
        visiting.delete(id);values[id]=finite(value);return value;
      }
      outputs.push(read('output'));frames.push({input,values,outputs:outputs.slice()});
    }
    return {outputs,frames};
  }
  // Geometry follows the same outgoing directions as item transport. A bend is
  // inferred only from an adjacent production piece actually pointing here.
  function conveyorPath(machine,machines){
    const delta={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]},out=delta[machine.dir];
    if(!out)return null;
    const incoming=machines.flatMap(n=>n!==machine&&['source','belt','smelter','assembler','splitter','router','merger'].includes(n.type)?(n.type==='splitter'||n.type==='router'?Object.values(n.outputs||{}):[n.dir]).filter(dir=>delta[dir]&&n.x+delta[dir][0]===machine.x&&n.y+delta[dir][1]===machine.y).map(dir=>delta[dir]):[]);
    const input=incoming.find(d=>d[0]===out[0]&&d[1]===out[1])||incoming.find(d=>d[0]*out[0]+d[1]*out[1]===0)||out;
    return {curved:input[0]*out[0]+input[1]*out[1]===0,
      start:[.5-input[0]*.5,.5-input[1]*.5],control:[.5,.5],
      end:[.5+out[0]*.5,.5+out[1]*.5],direction:machine.dir};
  }
  function factory(m,solution){
    if(m.source_exercise)globalThis.LogiCadeC.sourceCheck(m.source_exercise,solution.source_order,solution.c_categories);
    const machines=clone(solution.machines),wires=solution.wires;
    const delta={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]},routing=m.routing;
    const controllers=machines.filter(x=>['if_else','while','for'].includes(x.type));
    assert(controllers.length===1,'Place exactly one controller sprite on the gold socket.');
    const controller=controllers[0];
    assert(controller.type===m.controller.required_kind,'Use the controller type described in the mission objective.');
    assert(controller.x===m.controller.socket[0]&&controller.y===m.controller.socket[1],'Drop the controller onto its gold socket.');
    const limit=Number(controller.quota);assert(Number.isInteger(limit)&&limit>0&&limit<=m.ore,'Batch size must be a whole number within the available ore.');
    assert(machines.filter(x=>x.type==='belt').length<=m.build_budget,'Conveyor budget exceeded.');
    const cells=new Map(),ids=new Map();
    for(const machine of machines){assert(Number.isInteger(machine.x)&&Number.isInteger(machine.y)&&machine.x>=0&&machine.y>=0&&machine.x<m.width&&machine.y<m.height,'Machine outside map boundary.');const key=machine.x+','+machine.y;assert(!cells.has(key),'Two machines occupy one cell.');assert(typeof machine.id==='string'&&/^[a-zA-Z0-9_]+$/.test(machine.id)&&!['__proto__','constructor','prototype'].includes(machine.id),'Invalid machine ID.');assert(!ids.has(machine.id),'Duplicate machine ID.');assert(['source','output','belt','smelter','assembler','generator','if_else','while','for','splitter','router','merger'].includes(machine.type),'Unknown machine.');assert(delta[machine.dir],'Invalid conveyor direction.');cells.set(key,machine);ids.set(machine.id,machine);}
    const ports=n=>n.type==='splitter'||n.type==='router'?Object.values(n.outputs||{}):[n.dir];
    const targets=routing?.targets||[];
    if(routing){
      assert(routing.version===1&&['separate_outputs','merge_midpoint','merge_endpoint'].includes(routing.topology),'Invalid routing contract.');
      assert(Array.isArray(targets)&&targets.length===2&&new Set(targets.map(g=>g.id)).size===2&&targets.every(g=>['A','B','IF','ELSE'].includes(g.id)&&Number.isInteger(g.target)&&g.target>0&&Array.isArray(g.via)&&g.via.length>0)&&targets.reduce((s,g)=>s+g.target,0)===m.target,'Invalid branch targets.');
      const forks=machines.filter(n=>n.type==='splitter'||n.type==='router'),f=routing.fork;
      assert(forks.length===1&&forks[0].id===f.id&&forks[0].type===f.type,'Place the requested splitter or router junction.');
      const fork=forks[0];assert(fork.x===f.position[0]&&fork.y===f.position[1],'Place the junction on its marked socket.');
      assert(equal(Object.keys(fork.outputs||{}).sort(),f.branches.slice().sort())&&ports(fork).every(d=>delta[d])&&new Set(ports(fork)).size===2,'Choose two distinct valid fork output directions.');
      if(fork.type==='router'){assert(['even','threshold'].includes(f.condition?.kind)&&(f.condition.kind!=='threshold'||Number.isFinite(f.condition.value)&&Math.abs(f.condition.value)<=1000),'Invalid router condition.');assert(equal(fork.condition,f.condition),'Set the router condition to the rule in the mission.');}
      const mergers=machines.filter(n=>n.type==='merger');
      if(routing.merge){const expected=routing.merge;assert(mergers.length===1&&mergers[0].id===expected.id&&mergers[0].x===expected.position[0]&&mergers[0].y===expected.position[1],'Place the merger on its marked socket.');}
      else assert(!mergers.length,'This contract uses separate output depots.');
      assert(targets.every(g=>ids.get(g.output)?.type==='output'&&g.via.every(id=>m.recipes[ids.get(id)?.type])),'Branch destination or processing machine missing.');
      assert(Array.isArray(m.ore_values)&&m.ore_values.length>=m.ore&&m.ore_values.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e9),'Invalid ore input values.');
    }else assert(!machines.some(n=>['splitter','router','merger'].includes(n.type)),'This mission has no branching contract.');
    for(const fixed of m.machines.filter(x=>x.fixed)){assert(equal(ids.get(fixed.id),fixed),'Fixed machinery cannot be changed.');}
    const powered=new Set(machines.filter(x=>x.type==='generator').map(x=>x.id));
    for(const [a,b] of wires)assert(ids.has(a)&&ids.has(b),'Power wire endpoint missing.');
    for(let i=0;i<machines.length;i++)for(const [a,b] of wires){if(powered.has(a))powered.add(b);if(powered.has(b))powered.add(a);}
    for(const x of machines.filter(x=>['source','smelter','assembler','splitter','router','merger'].includes(x.type)))assert(powered.has(x.id),`Power ${x.type} ${x.id} before running.`);
    assert(powered.has(controller.id),'Connect generator power to the controller sprite.');
    const buffers={},frames=[],deliveredByOutput={},branchDelivered=Object.fromEntries(targets.map(g=>[g.id,0])),seen=new Set(),splitNext={},mergeLast={},mergeAccepted={};let released=0,delivered=0;
    const sources=machines.filter(x=>x.type==='source');assert(sources.length===1,'Place exactly one ore source.');const source=sources[0];
    const predecessors=new Map(machines.map(n=>[n.id,machines.filter(p=>ports(p).some(dir=>{const d=delta[dir];return d&&p.x+d[0]===n.x&&p.y+d[1]===n.y;})).map(p=>p.id).sort()]));
    const finish=error=>{const checks=[{id:'production_contract',passed:delivered===m.target&&released===limit&&!Object.keys(buffers).length},...targets.map(g=>({id:'branch_'+g.id,passed:branchDelivered[g.id]===g.target,outputs:[branchDelivered[g.id]],expected:[g.target]})),...(m.source_exercise?[{id:'c_source_components',passed:true}]:[])];return {outputs:[delivered],frames,checks,passed:!error&&checks.every(c=>c.passed),error:error||checks.filter(c=>!c.passed).map(c=>c.id).join(', ')};};
    for(let tick=0;tick<m.rules.max_steps;tick++){
      for(const machine of machines){
        const item=buffers[machine.id];if(!item)continue;
        if(machine.type==='output'){assert(item.type==='component','Output requires a finished component.');assert(!seen.has(item.id),'Duplicate delivered item.');seen.add(item.id);delivered++;deliveredByOutput[machine.id]=(deliveredByOutput[machine.id]||0)+1;for(const goal of targets)if(item.branch===goal.id&&machine.id===goal.output&&goal.via.every(id=>item.history.includes(id)))branchDelivered[goal.id]++;delete buffers[machine.id];}
        else if(m.recipes[machine.type]&&!item.processed){const recipe=m.recipes[machine.type];assert(item.type===recipe.input,`${machine.type} needs ${recipe.input}, received ${item.type}.`);item.type=recipe.output;item.ready=tick+recipe.ticks;item.processed=true;item.history.push(machine.id);}
      }
      const candidates=new Map(),routeActions={};
      for(const machine of machines){const item=buffers[machine.id];if(!item||item.ready>tick)continue;let direction=machine.dir,branch=null;
        if(machine.type==='splitter'||machine.type==='router'){
          const labels=routing.fork.branches;
          branch=machine.type==='splitter'?labels[splitNext[machine.id]||0]:(machine.condition.kind==='even'?item.value%2===0:item.value>=machine.condition.value)?labels[0]:labels[1];
          direction=machine.outputs[branch];routeActions[machine.id]={branch,direction,item_id:item.id,value:item.value,status:'waiting'};
        }
        const [dx,dy]=delta[direction],next=cells.get((machine.x+dx)+','+(machine.y+dy));
        if(!next||!['belt','smelter','assembler','output','splitter','router','merger'].includes(next.type)||buffers[next.id])continue;
        const list=candidates.get(next.id)||[];list.push({from:machine.id,to:next.id,branch});candidates.set(next.id,list);
      }
      for(const [to,list] of candidates){
        const next=ids.get(to),order=predecessors.get(to),last=order.indexOf(mergeLast[to]);
        if(next.type!=='merger')assert(list.length===1,'Use a merger where two conveyors join.');
        list.sort((a,b)=>((order.indexOf(a.from)-last-1+order.length)%order.length)-((order.indexOf(b.from)-last-1+order.length)%order.length));
        const move=list[0],item=buffers[move.from];buffers[to]={...item,history:item.history.slice(),processed:false,...(move.branch?{branch:move.branch}:{})};delete buffers[move.from];
        if(move.branch){routeActions[move.from].status='sent';if(ids.get(move.from).type==='splitter')splitNext[move.from]=((splitNext[move.from]||0)+1)%2;}
        if(next.type==='merger'){mergeLast[to]=move.from;mergeAccepted[to]??={};const label=item.branch||'unassigned';mergeAccepted[to][label]=(mergeAccepted[to][label]||0)+1;}
      }
      const sourceClear=!buffers[source.id],condition=released<limit;
      const action=!condition?'stopped':!sourceClear?(controller.type==='if_else'?'ELSE: wait':'wait for source'):(controller.type==='if_else'?'IF: release':controller.type==='while'?'WHILE: release':`FOR iteration ${released+1}: release`);
      if(sourceClear&&condition){buffers[source.id]={id:released+1,value:m.ore_values?.[released]??released+1,type:'ore',ready:tick,processed:false,history:[]};released++;}
      frames.push({tick,released,delivered,buffers:clone(buffers),powered:[...powered],delivered_by_output:clone(deliveredByOutput),branch_delivered:clone(branchDelivered),routes:routeActions,merge_accepted:clone(mergeAccepted),controller:{kind:controller.type,condition,source_clear:sourceClear,iteration:released,action}});
      if(released===limit&&!Object.keys(buffers).length)return finish('');
    }
    const result=finish('Production stalled or cycle limit reached. Inspect branch ports, buffers, gaps, power and batch size.');result.checks[0].passed=false;return result;
  }
  function adventure(m,source){
    if(m.language==='c_subset')return cAdventure(m,source);
    assert(source.length<12000,'Program is too long.');
    const tokens=source.replace(/\/\/[^\n]*/g,'').match(/[{}]|[^{};\n]+/g)?.map(x=>x.trim()).filter(Boolean)||[];
    assert(tokens.length<=m.rules.max_lines*3,'Program size limit exceeded.');
    const scopes=[Object.create(null)],watch=[],gems=new Set(),frames=[];let x=m.start[0],y=m.start[1],steps=0;
    const find=name=>{for(let i=scopes.length-1;i>=0;i--)if(Object.hasOwn(scopes[i],name))return scopes[i];throw Error(`Variable ${name} is not declared in this scope.`);};
    const get=name=>find(name)[name];
    function execute(a,b,depth=0){
      assert(depth<12,'Block nesting limit exceeded.');
      for(let i=a;i<b;i++){
        assert(++steps<=m.rules.max_steps,'Execution limit reached.');const line=tokens[i];
        if(line==='{'){let end=i+1,nesting=1;for(;end<b&&nesting;end++){if(tokens[end]==='{')nesting++;else if(tokens[end]==='}')nesting--;}assert(nesting===0,'Missing closing brace.');scopes.push(Object.create(null));execute(i+1,end-1,depth+1);scopes.pop();i=end-1;continue;}
        assert(line!=='}','Unexpected closing brace.');
        let match;
        if((match=line.match(/^int\s+([a-z_]\w*)\s*=\s*(.+)$/i))){assert(!Object.hasOwn(scopes.at(-1),match[1]),'Variable already declared in this block.');scopes.at(-1)[match[1]]=expression(match[2],get);}
        else if((match=line.match(/^([a-z_]\w*)\s*=\s*(.+)$/i))){find(match[1])[match[1]]=expression(match[2],get);}
        else if((match=line.match(/^(?:hero\.)?(moveRight|moveLeft|moveUp|moveDown|observe)\s*\((.*)\)$/))){
          const n=expression(match[2],get);
          if(match[1]==='observe')watch.push(n);
          else {
            assert(Number.isInteger(n)&&n>=0&&n<=50,'Movement requires 0–50 whole steps.');const [dx,dy]={moveRight:[1,0],moveLeft:[-1,0],moveUp:[0,-1],moveDown:[0,1]}[match[1]];
            for(let j=0;j<n;j++){
              assert(++steps<=Math.min(m.rules.max_steps,m.command_budget),'Movement budget exceeded.');const nx=x+dx,ny=y+dy;
              assert(m.map[ny]?.[nx]==='.',`Blocked by a wall or boundary at (${nx}, ${ny}).`);x=nx;y=ny;
              for(const [gx,gy] of m.gems)if(x===gx&&y===gy)gems.add(gx+','+gy);
              frames.push({line:i,x,y,gems:[...gems],watch:watch.slice(),variables:Object.assign({},...scopes)});
            }
          }
        }else throw Error(`Instruction ${i+1}: unsupported syntax. Use the command reference.`);
        frames.push({line:i,x,y,gems:[...gems],watch:watch.slice(),variables:Object.assign({},...scopes)});
      }
    }
    execute(0,tokens.length);
    const checks=[{id:'collectibles',passed:gems.size===m.gems.length},{id:'exit',passed:x===m.exit[0]&&y===m.exit[1]},
                  {id:'variable_trace',passed:equal(watch,m.expected_watch)}];
    return {outputs:watch,frames,checks,passed:checks.every(x=>x.passed),error:checks.filter(x=>!x.passed).map(x=>x.id).join(', ')};
  }
  function cAdventure(m,source){
    let x=m.start[0],y=m.start[1],steps=0;const gems=new Set(),frames=[];
    const record=state=>frames.push({x,y,gems:[...gems],watch:state.outputs,variables:state.variables,globals:state.globals,locals:state.locals,stdout:state.stdout});
    const result=globalThis.LogiCadeC.run(source,{max_steps:m.rules.max_steps,step:record,command:(name,n,state)=>{
      if(name==='observe')throw Error('Use printf for this C lesson.');
      assert(Number.isInteger(n)&&n>=0&&n<=50,'Movement requires 0–50 whole steps.');const [dx,dy]={moveRight:[1,0],moveLeft:[-1,0],moveUp:[0,-1],moveDown:[0,1]}[name];
      for(let i=0;i<n;i++){assert(++steps<=m.command_budget,'Movement budget exceeded.');assert(m.map[y+dy]?.[x+dx]==='.',`Blocked by a wall or boundary at (${x+dx}, ${y+dy}).`);x+=dx;y+=dy;for(const [gx,gy] of m.gems)if(x===gx&&y===gy)gems.add(gx+','+gy);record(state);}
    }});
    const checks=[{id:'collectibles',passed:gems.size===m.gems.length},{id:'exit',passed:x===m.exit[0]&&y===m.exit[1]},
      {id:'variable_trace',passed:equal(result.outputs,m.expected_watch)},
      {id:'file_scope_state',passed:equal(result.globals,m.expected_globals||{})}];
    return {outputs:result.outputs,frames,checks,passed:checks.every(c=>c.passed),error:checks.filter(c=>!c.passed).map(c=>c.id).join(', ')};
  }
  function check(m,solution){
    try{
      assert(m?.version===1&&['terminal','circuit','factory','adventure'].includes(m.family),'Unsupported mission schema or family.');
      assert(Number.isInteger(m.rules?.max_steps)&&m.rules.max_steps>0&&m.rules.max_steps<=5000,'Invalid execution bound.');
      assert(Number.isInteger(m.rules?.max_lines)&&m.rules.max_lines>0&&m.rules.max_lines<=200,'Invalid program bound.');
      assert(Number.isInteger(m.rules?.max_nodes)&&m.rules.max_nodes>0&&m.rules.max_nodes<=20,'Invalid component bound.');
      if(m.family==='terminal'||m.family==='circuit'){
        assert(Array.isArray(m.cases)&&m.cases.length>0&&m.cases.length<=30,'A mission needs 1–30 verification cases.');
        for(const c of m.cases){assert(Array.isArray(c.inputs)&&Array.isArray(c.expected)&&c.inputs.length<=100&&c.expected.length>0&&c.expected.length<=100,'Invalid verification stream.');for(const v of [...c.inputs,...c.expected])assert(typeof v==='number'?Number.isFinite(v)&&Math.abs(v)<=1e9:typeof v==='string'&&v.length<=200,'Invalid stream value.');}
        if(m.family==='terminal')assert(Array.isArray(m.nodes)&&m.nodes.length>0&&m.nodes.length<=8,'Invalid terminal node count.');
      }
      if(m.family==='factory'){
        assert(Number.isInteger(m.width)&&Number.isInteger(m.height)&&m.width>0&&m.height>0&&m.width<=32&&m.height<=32,'Invalid factory dimensions.');
        assert(Array.isArray(solution.machines)&&solution.machines.length<=m.width*m.height,'Invalid machine count.');
        assert(Number.isInteger(m.target)&&Number.isInteger(m.ore)&&m.target>0&&m.ore>=m.target&&m.ore<=100,'Invalid production quota.');
        for(const r of Object.values(m.recipes))assert(Number.isInteger(r.ticks)&&r.ticks>0&&r.ticks<=100,'Invalid recipe duration.');
      }
      if(m.family==='adventure')assert(Array.isArray(m.map)&&m.map.length>0&&m.map.length<=50&&m.map.every(row=>typeof row==='string'&&row.length>0&&row.length<=50)&&Array.isArray(m.gems)&&m.gems.length<=20,'Invalid adventure map.');
      if(m.family==='factory'||m.family==='adventure'){
        const r=m.family==='factory'?factory(m,solution):adventure(m,solution.program);
        const checks=r.checks||[{id:'production_contract',passed:r.passed}];
        return {...r,checks,total:checks.length,correct:checks.filter(x=>x.passed).length};
      }
      const checks=[],frames=[];
      for(const test of m.cases){
        try{const r=m.family==='terminal'?terminal(m,solution.programs,test):circuit(m,solution,test);const variableOK=(!m.required_variable||Object.hasOwn(r.variables||{},m.required_variable)&&r.variables[m.required_variable]===test.expected.at(-1))&&(!m.required_declaration||r.types?.[m.required_declaration.name]===m.required_declaration.type&&Object.entries(test.required_values||{}).every(([k,v])=>r.variables[k]===v));checks.push({id:test.id,passed:equal(r.outputs,test.expected)&&variableOK,outputs:r.outputs,expected:test.expected,error:variableOK?null:'Declare the required type and update its value before output.'});if(!frames.length||m.circuit_kind==='scope_controller')frames.push(...r.frames);}
        catch(e){checks.push({id:test.id,passed:false,error:e.message});}
      }
      return {passed:checks.every(x=>x.passed),checks,total:checks.length,correct:checks.filter(x=>x.passed).length,frames,
              error:checks.find(x=>!x.passed)?.error||'Compare the actual output with every expected stream.'};
    }catch(e){return {passed:false,total:1,correct:0,checks:[{id:'execution',passed:false,error:e.message}],frames:[],error:e.message};}
  }
  globalThis.LogiCadeProgramModel={check,expression,conveyorPath};
})();
