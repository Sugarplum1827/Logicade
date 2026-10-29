/* Trusted verification harness. Model output is JSON data, never JS source. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let input='';process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{input+=chunk;if(input.length>800000)process.exit(2);});
process.stdin.on('end',()=>{
  try{
    const game=JSON.parse(input),root=process.argv[2],scope=vm.createContext({game});
    for(const name of ['c-runtime.js','program-model.js','flowchart-model.js','terminal-network-model.js'])
      new vm.Script(fs.readFileSync(path.join(root,'runtime',name),'utf8')).runInContext(scope,{timeout:1000});
    const result=new vm.Script(`(() => {
      if(game.flowchart){
        const p=game.flowchart,r=LogiCadeFlowchartModel.check(p,p.solution);
        const bad=LogiCadeFlowchartModel.check(p,{...p.solution,start:'end'});
        if(!r.passed||bad.passed)throw Error('Flowchart reference/negative-control failed: '+JSON.stringify(r.errors));
        return {passed:true,cases:p.cases.length,negative_control:true};
      }
      const m=game.programming?.family==='terminal'?LogiCadeTerminalNetworkModel.adapt(game.programming,game.seed):game.programming;
      if(!m)throw Error('Unsupported runtime verifier family');
      const check=m.network?LogiCadeTerminalNetworkModel.check:LogiCadeProgramModel.check;
      const r=check(m,JSON.parse(JSON.stringify(m.reference)));
      const invalid=m.family==='factory'?{...m.reference,wires:[]}:m.family==='terminal'?{programs:m.nodes.map(()=> '__invalid__')}:m.family==='circuit'?{...m.reference,wires:[]}:{program:'__invalid__'};
      const bad=check(m,invalid);
      if(!r.passed||bad.passed)throw Error('Reference/negative-control failed: '+(r.error||JSON.stringify(r.checks)));
      return {passed:true,cases:r.total,frames:r.frames.length,negative_control:true,
        ...(m.network?{terminal_network_version:m.network.version,language:'c',node_count:m.nodes.length}:{})};
    })()`).runInContext(scope,{timeout:4000});
    process.stdout.write(JSON.stringify(result));
  }catch(error){process.stdout.write(JSON.stringify({passed:false,error:String(error.message).slice(0,700)}));process.exitCode=1;}
});
