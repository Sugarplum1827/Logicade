import { createProgram } from './automation-language.js';
import { FIELD_ACTIONS,FIELD_SENSORS,readField,beginAction } from './field-state.js';

export function fieldProgram(farm,source){
  const vm=createProgram(source,{actions:FIELD_ACTIONS,sensors:FIELD_SENSORS,read:(name,args)=>readField(farm,name,args)});
  const run={status:'running',line:1,events:[],message:'Helper program running.',vm,pending:null,lastResult:undefined,paused:false};
  function finish(ok,message){
    run.status=ok?'complete':'error';run.message=message;farm.message=message;
    farm.programHistory.push({ok,time:farm.time,stats:{...vm.stats},actions:run.events.filter(e=>e.kind==='action').map(e=>({...e,args:[...e.args]})),variables:vm.variables});
    if(farm.programHistory.length>30)farm.programHistory.shift();
  }
  run.stop=()=>{if(run.status!=='running')return;farm.helper.task=null;farm.helper.path=[];run.status='stopped';run.message='Program stopped. Changes already made to the farm remain.';farm.message=run.message;};
  run.tick=results=>{
    if(run.status!=='running'||run.paused)return;
    if(run.pending){
      const result=results.find(r=>r.who==='helper');if(!result)return;
      run.events.push({...run.pending,ok:result.ok,message:result.message});run.pending=null;
      if(!result.ok){finish(false,`Line ${run.line}: ${result.message}`);return;}run.lastResult=result.result;
    }
    try{
      for(let count=0;count<100;count++){
        const next=vm.iterator.next(run.lastResult);run.lastResult=undefined;
        if(next.done){finish(true,'Program completed. Its changes remain in the farm.');return;}
        run.line=next.value.line;
        if(next.value.kind==='compute')continue;
        const event=next.value,result=beginAction(farm,'helper',event.name,event.args);
        if(!result.ok){run.events.push({...event,ok:false,message:result.message});finish(false,`Line ${event.line}: ${result.message}`);return;}
        run.pending=event;return;
      }
    }catch(error){finish(false,error.message);}
  };
  return run;
}
