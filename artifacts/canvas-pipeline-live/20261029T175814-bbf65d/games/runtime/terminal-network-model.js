/* C-only connected-node adapter and bounded stream scheduler. */
(() => {
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const require=(ok,text)=>{if(!ok)throw Error(text);};
  const ports=['UP','RIGHT','DOWN','LEFT'];
  const finiteValue=value=>require(typeof value==='number'?Number.isFinite(value)&&Math.abs(value)<=1e9:typeof value==='string'&&value.length<=200,'Invalid signal value.');
  function adapt(original,seed=0){
    if(original.network?.version===2)return copy(original);
    require(original.family==='terminal','Only terminal missions use connected nodes.');
    const m=copy(original),wasC=m.language==='c_subset',count=m.difficulty_profile===0?4:6,cols=count/2;
    const coords=Array.from({length:count},(_,i)=>i<cols?[i,0]:[count-1-i,1]);
    const nodes=coords.map(([x,y],i)=>({id:`C${i+1}`,x,y,language:'c_subset'}));
    const links=[{from:'INPUT',out:'OUT',to:nodes[0].id,in:'UP'}];
    for(let i=0;i<count-1;i++){
      const a=nodes[i],b=nodes[i+1],out=b.x>a.x?'RIGHT':b.x<a.x?'LEFT':'DOWN',input={RIGHT:'LEFT',LEFT:'RIGHT',DOWN:'UP'}[out];
      links.push({from:a.id,out,to:b.id,in:input});
    }
    links.push({from:nodes.at(-1).id,out:'DOWN',to:'OUTPUT',in:'IN'});
    // Old stored references describe the approved arithmetic; player code is C.
    const originalCode=m.reference.programs[0],lines=originalCode.split('\n').map(s=>s.trim()).filter(Boolean);
    const straight=!wasC&&lines[0]==='MOV IN ACC'&&lines.at(-1)==='MOV ACC OUT'
      &&lines.slice(1,-1).every(line=>/^(ADD|SUB|MUL|NEG)\b/.test(line));
    const stages=Array.from({length:count},()=>[]);
    function toC(line){
      const [op,operand]=line.split(/\s+/),value=operand==='ACC'?'value':String(Number(operand));
      require(op==='NEG'||operand==='ACC'||Number.isFinite(Number(operand)),'Unsupported stored algorithm operand.');
      return op==='NEG'?'value = -value;':`value = value ${{ADD:'+',SUB:'-',MUL:'*'}[op]} ${value};`;
    }
    if(straight)lines.slice(1,-1).forEach((op,i,list)=>stages[Math.min(count-2,1+Math.floor(i*(count-2)/Math.max(1,list.length)))].push(toC(op)));
    else if(!wasC){require(originalCode.includes('countdown: SUB 1')&&originalCode.includes('JGZ countdown'),'Unsupported stored algorithm control flow.');stages[0]=['while (value > 0) {','    value = value - 1;','  }'];}
    const programs=nodes.map((node,i)=>{
      const input=links.find(e=>e.to===node.id).in,output=links.find(e=>e.from===node.id).out;
      node.input=input;node.output=output;
      const type=wasC&&m.required_declaration?.type==='char'?'char':wasC?'double':'int';
      node.task=i===0&&wasC?m.objective:stages[i].length?`Apply these C statements in order: ${stages[i].join(' ')}`:'Forward each received value unchanged.';
      node.program=i===0&&wasC?m.nodes[0].program:`#include "logicade.h"\nint main(void) {\n  // Read ${input}, complete the node task, then write ${output}.\n  // Use ${type} for the received value.\n  return 0;\n}`;
      if(i===0&&wasC)return originalCode;
      return ['#include "logicade.h"','int main(void) {',`  ${type} value = readPort(${input});`,...stages[i].map(line=>'  '+line),`  writePort(${output}, value);`,'  return 0;','}'].join('\n');
    });
    m.nodes=nodes;m.reference={programs};m.language='c_subset';delete m.instruction_set;
    m.network={version:2,columns:cols,rows:2,links,capacity:1,required_nodes:nodes.map(n=>n.id),compute_node:nodes[0].id,
      adapter_version:'cp1-connected-c-v2',source_language:original.language||'legacy_algorithm'};
    m.output_view=wasC&&m.required_declaration?.type==='char'?'text':!wasC&&(Number(seed)>>>0)%3===0?'image':'numbers';
    return m;
  }
  function validate(m,solution){
    require(m?.family==='terminal'&&m.language==='c_subset'&&m.network?.version===2,'Invalid C node network.');
    require(Number.isInteger(m.rules?.max_steps)&&m.rules.max_steps>0&&m.rules.max_steps<=5000,'Invalid cycle bound.');
    require(Number.isInteger(m.rules?.max_lines)&&m.rules.max_lines>0&&m.rules.max_lines<=200,'Invalid program bound.');
    require(Number.isInteger(m.rules?.max_nodes)&&m.rules.max_nodes>0&&m.rules.max_nodes<=20,'Invalid node bound.');
    require(Array.isArray(m.nodes)&&m.nodes.length>=2&&m.nodes.length<=8&&m.nodes.length<=m.rules.max_nodes,'Invalid network node count.');
    require(new Set(m.nodes.map(n=>n.id)).size===m.nodes.length&&m.nodes.every(n=>/^[A-Za-z]\w{0,20}$/.test(n.id)&&!['INPUT','OUTPUT'].includes(n.id)&&n.language==='c_subset'),'Every node must use C.');
    require(Array.isArray(solution?.programs)&&solution.programs.length===m.nodes.length,'Program every connected node in C.');
    require(solution.programs.every(source=>typeof source==='string'&&source.length<=12000&&source.split('\n').filter(line=>line.trim()).length<=m.rules.max_lines),'C node source or line limit exceeded.');
    require(Array.isArray(m.cases)&&m.cases.length>0&&m.cases.length<=30,'Invalid verification streams.');
    for(const test of m.cases){require(Array.isArray(test.inputs)&&Array.isArray(test.expected)&&test.inputs.length<=100&&test.expected.length>0&&test.expected.length<=100,'Invalid stream length.');for(const value of [...test.inputs,...test.expected])finiteValue(value);}
    require(Array.isArray(m.network.links)&&m.network.links.length<=40&&m.network.capacity===1,'Invalid network links or queue capacity.');
    const ids=new Set(m.nodes.map(n=>n.id)),usedIn=new Set(),usedOut=new Set();
    for(const link of m.network.links){
      require((link.from==='INPUT'||ids.has(link.from))&&(link.to==='OUTPUT'||ids.has(link.to))&&link.from!==link.to,'Unknown or self-connected link.');
      require((link.from==='INPUT'?link.out==='OUT':ports.includes(link.out))&&(link.to==='OUTPUT'?link.in==='IN':ports.includes(link.in)),'Invalid connection port.');
      require(!usedIn.has(link.to+':'+link.in)&&!usedOut.has(link.from+':'+link.out),'A directional port can have one connection.');usedIn.add(link.to+':'+link.in);usedOut.add(link.from+':'+link.out);
    }
    require(m.network.links.filter(e=>e.from==='INPUT').length===1&&m.network.links.filter(e=>e.to==='OUTPUT').length===1,'The network needs exactly one input and output stream.');
    require(m.nodes.every(n=>m.network.links.filter(e=>e.to===n.id).length===1&&m.network.links.filter(e=>e.from===n.id).length===1),'Each C node needs one incoming and one outgoing connection.');
    require(Array.isArray(m.network.required_nodes)&&m.network.required_nodes.length===m.nodes.length&&m.nodes.every(n=>m.network.required_nodes.includes(n.id))&&ids.has(m.network.compute_node),'Every connected node must participate.');
  }
  function execute(m,solution,test){
    const frames=[],outputs=[],channels=m.network.links.map(link=>({...link,queue:link.from==='INPUT'?test.inputs.slice():[]}));
    const nodes=m.nodes.map((definition,i)=>({...definition,source:solution.programs[i],pc:0,vars:{},types:{},last:null,
      readLine:solution.programs[i].split('\n').findIndex(line=>/\bread(?:Port|Input)\s*\(/.test(line))+1,
      active_line:null,blocked_line:null,mode:'IDLE',idle:0,executed:0,reads:0,writes:0,job:null}));
    const snapshot=(tick,transfers)=>frames.push({tick,case_id:test.id,outputs:outputs.slice(),transfers,
      nodes:nodes.map(n=>({id:n.id,pc:n.pc,vars:copy(n.vars),types:copy(n.types),last:n.last,mode:n.mode,active_line:n.active_line,
        blocked_line:n.blocked_line,idle:n.idle,executed:n.executed,reads:n.reads,writes:n.writes})),
      queues:channels.map(c=>({from:c.from,to:c.to,out:c.out,in:c.in,values:c.queue.slice()}))});
    let variables={},types={};
    try{
      for(let tick=0;tick<m.rules.max_steps;tick++){
        let progressed=false;const transfers=[];
        for(const node of nodes){
          node.active_line=null;node.blocked_line=null;
          const incoming=channels.find(c=>c.to===node.id),outgoing=channels.find(c=>c.from===node.id);
          if(!node.job){
            if(!incoming.queue.length){node.mode='READ';node.blocked_line=node.readLine||null;node.idle++;continue;}
            const value=incoming.queue[0];let requested=false;
            const result=globalThis.LogiCadeC.run(node.source,{inputs:[value],max_steps:m.rules.max_steps,
              readPort:direction=>{require(ports[direction]===incoming.in,`${node.id}: input port ${ports[direction]??direction} is not connected.`);require(!requested,`${node.id}: read exactly one signal per main invocation.`);requested=true;return value;},
              writePort:direction=>require(ports[direction]===outgoing.out,`${node.id}: output port ${ports[direction]??direction} is not connected.`)});
            require(result.outputs.length===1&&result.input_reads===1,`${node.id}: main must read exactly one input and send exactly one result.`);
            node.job={result,at:0,emitted:0,consumed:false};
          }
          const job=node.job,row=job.result.trace[job.at];require(row,'C trace is missing.');
          if(row.outputs.length>job.emitted&&outgoing.to!=='OUTPUT'&&outgoing.queue.length>=1){node.mode='WRITE';node.blocked_line=row.source_line;node.idle++;continue;}
          if(row.input_reads&&!job.consumed){
            require(incoming.queue.length>0,'Input signal unavailable.');const value=incoming.queue.shift();job.consumed=true;node.last=incoming.in;node.reads++;
            transfers.push({from:incoming.from,to:node.id,out:incoming.out,in:incoming.in,value});
          }
          node.vars=copy(row.variables);node.types=copy(row.types);node.active_line=row.source_line;node.mode='RUN';node.executed++;progressed=true;
          if(row.outputs.length>job.emitted){
            const value=row.outputs[job.emitted];finiteValue(value);if(outgoing.to==='OUTPUT')outputs.push(value);else outgoing.queue.push(value);
            node.writes++;transfers.push({from:node.id,to:outgoing.to,out:outgoing.out,in:outgoing.in,value});job.emitted++;
          }
          if(node.id===m.network.compute_node){variables=copy(job.result.variables);types=copy(job.result.types);}job.at++;
          if(job.at>=job.result.trace.length){node.job=null;node.pc=0;}else node.pc=job.at;
        }
        snapshot(tick,transfers);
        require(outputs.length<=test.expected.length,'The output stream contains extra values.');
        if(outputs.length===test.expected.length&&channels.every(c=>!c.queue.length)&&nodes.every(n=>!n.job)){
          require(nodes.every(n=>n.reads>0&&n.writes>0),'Every node must receive and forward data.');return {outputs,frames,variables,types};
        }
        require(progressed,'Deadlock: inspect the READ/WRITE statements and connected ports.');
      }
      throw Error('Cycle limit reached. Check C loops, ports and termination.');
    }catch(error){return {outputs,frames,variables,types,error:error.message};}
  }
  function check(m,solution){
    try{
      validate(m,solution);const checks=[],frames=[];
      for(let caseIndex=0;caseIndex<m.cases.length;caseIndex++){
        const test=m.cases[caseIndex],result=execute(m,solution,test),declaration=m.required_declaration;
        const correctType=!declaration||(result.types?.[declaration.name]===declaration.type&&Object.entries(test.required_values||{}).every(([name,value])=>result.variables[name]===value));
        const error=result.error||(!correctType?'Declare the required C type and update its value before printing.':null);
        checks.push({id:test.id,passed:!error&&same(result.outputs,test.expected),outputs:result.outputs,expected:test.expected,error});
        frames.push(...result.frames.map(frame=>({...frame,case_index:caseIndex})));
      }
      return {passed:checks.every(c=>c.passed),checks,total:checks.length,correct:checks.filter(c=>c.passed).length,frames,
        error:checks.find(c=>c.error)?.error||'Compare actual output with the target stream in every case.'};
    }catch(error){return {passed:false,total:1,correct:0,checks:[{id:'network',passed:false,error:error.message}],frames:[],error:error.message};}
  }
  globalThis.LogiCadeTerminalNetworkModel={adapt,check};
})();
