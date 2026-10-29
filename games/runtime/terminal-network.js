(() => {
  'use strict';
  function start(setup){
    const game=setup.game,model=globalThis.LogiCadeTerminalNetworkModel,m=model.adapt(game.programming,game.seed);
    const shell=document.querySelector('#game-shell');shell.replaceChildren();shell.className='terminal-network-shell';
    document.body.classList.add('terminal-network-game','c-node-game');
    const make=(tag,text,parent,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;parent?.appendChild(e);return e;};
    const button=(label,parent,click)=>{const b=make('button',label,parent);b.type='button';b.onclick=click;return b;};
    const state={programs:m.nodes.map(n=>n.program),frames:[],at:-1,result:null,recorded:false,playing:false,hostPaused:false,
      done:false,lives:Number(game.starting_lives)||3,checks:0,correct:0,tested:0,hints:0,events:0,speed:20,elapsed:0,started:0,last:0,carry:0};
    const post=(type,fields={})=>window.parent.postMessage({channel:'logicade-game',version:1,type,
      event_id:`network-${game.file_id}-${++state.events}`,time_ms:Math.round(state.elapsed*1000),...fields},'*');
    const header=make('header',null,shell,'network-header');make('strong',m.title,header);const metrics=make('span','',header);
    const main=make('div',null,shell,'network-layout'),side=make('aside',null,main,'network-sidebar');
    make('h1','MISSION',side);make('p',m.objective,side,'network-objective');
    const mission=make('details',null,side);make('summary','Lesson and node instructions',mission);globalThis.LogiCadeLessonGuide?.mount(mission,game.lesson);
    make('p','Every node runs a C main function once for each incoming signal. Read the connected input, complete the node task and send one result. White lines executed this cycle; gray lines are waiting for data or space. Each connection holds one signal.',mission);
    make('pre','#include "logicade.h"\nint main(void) {\n  int value = readPort(LEFT);\n  value = value + 1;\n  writePort(RIGHT, value);\n  return 0;\n}',mission);
    make('p','readPort(direction) and writePort(direction, value) are LogiCade helpers declared in logicade.h. UP, RIGHT, DOWN and LEFT name the connected ports. They are not standard C library functions. readInput() aliases the incoming port and printf can send a value to the outgoing port in existing C lessons. Use double to preserve fractional values or char for character signals.',mission);
    make('p','Supported C subset: int, float, double, char; declarations and assignments; arithmetic and comparisons; if/else, while, for, i++, i-- and compound assignments; blocks; return 0. Execution is bounded. No pointers, arrays, external libraries or arbitrary native code.',mission);
    const inputText=make('p','',side,'network-input');
    const output=make('section',null,side,'network-output');output.setAttribute('aria-label','Target and actual output');
    const results=make('div',null,side,'network-results');
    const boardScroll=make('section',null,main,'network-board-scroll');boardScroll.setAttribute('aria-label','Connected programmable nodes');
    boardScroll.tabIndex=0;
    const board=make('div',null,boardScroll,'network-board');board.style.setProperty('--network-columns',m.network.columns);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('network-links');svg.setAttribute('aria-hidden','true');board.appendChild(svg);
    const cards=m.nodes.map((node,i)=>{
      const card=make('section',null,board,'network-node');card.style.gridColumn=node.x+1;card.style.gridRow=node.y+1;card.setAttribute('aria-label',`Node ${node.id}`);
      const head=make('header',null,card);make('strong',node.id,head);make('small','C PROGRAM',head);
      const portLabel=make('p',`${node.input} IN → ${node.output} OUT`,card,'network-ports');
      const hint=make('details',null,card,'network-node-task');make('summary','Node task',hint);make('p',node.task,hint);
      const body=make('div',null,card,'network-node-body'),code=make('div',null,body,'network-code');
      const pre=make('pre',null,code);pre.setAttribute('aria-hidden','true');
      const area=make('textarea',null,code);area.value=state.programs[i];area.wrap='off';area.spellcheck=false;area.maxLength=12000;
      area.setAttribute('aria-label',`Node ${node.id} program`);area.setAttribute('autocomplete','off');
      const registers=make('dl',null,body,'network-registers'),fields={};
      for(const label of ['LINE','READ','SENT','MODE','IDLE']){make('dt',label,registers);fields[label]=make('dd',label==='MODE'?'IDLE':'0',registers);}
      const variables=make('pre','Variables: not executing',card,'network-variable-watch');variables.setAttribute('aria-label',`Node ${node.id} C variables`);
      function highlight(frame){
        pre.replaceChildren();state.programs[i].split('\n').forEach((line,lineIndex)=>{
          const row=make('span',line||' ',pre);row.dataset.line=lineIndex+1;
          if(frame?.active_line===lineIndex+1)row.className='executing';else if(frame?.blocked_line===lineIndex+1)row.className='blocked';
        });
        pre.scrollTop=area.scrollTop;pre.scrollLeft=area.scrollLeft;
      }
      area.addEventListener('scroll',()=>{pre.scrollTop=area.scrollTop;pre.scrollLeft=area.scrollLeft;});
      area.oninput=()=>{if(state.done)return;state.programs[i]=area.value;state.playing=false;state.result=null;state.frames=[];state.at=-1;state.recorded=false;
        post('checkpoint_saved',{payload:{mission_id:m.mission_id,terminal_network_version:2,language:'c',solution:{programs:state.programs.slice()}}});say('C program changed. Run or Step to test the connected network.');render();};
      highlight();return {card,pre,area,fields,highlight,portLabel,variables};
    });
    const footer=make('footer',null,shell,'network-footer'),controls=make('nav',null,footer);controls.setAttribute('aria-label','Network execution controls');
    const feedback=make('p','Program all nodes, then Run. Step follows one cycle through the connected network.',footer,'network-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
    function say(text){feedback.textContent=text;}
    function begin(){if(!state.started){state.started=performance.now();state.last=state.started;post('game_started',{game_id:game.file_id,variation_id:game.variation_id,terminal_network_version:2,language:'c'});}}
    function prepare(){begin();state.result=model.check(m,{programs:state.programs});state.frames=state.result.frames;state.at=-1;state.recorded=false;state.carry=0;results.replaceChildren();
      post('custom',{event_type:'program_execution_started',payload:{family:'terminal',mission_id:m.mission_id,terminal_network_version:2,language:'c',node_count:m.nodes.length}});
      say('Executing connected nodes. White = executed; gray READ/WRITE = waiting.');
    }
    function advance(renderNow=true){if(state.done||state.hostPaused||!state.result)return;if(state.at<state.frames.length-1)state.at++;if(renderNow)render();if(state.at>=state.frames.length-1)complete();}
    function complete(){
      if(state.recorded||!state.result)return;state.recorded=true;state.playing=false;state.checks++;const r=state.result;state.tested+=r.total;state.correct+=r.correct;
      for(const test of r.checks){make('p',`${test.passed?'PASS':'FAIL'} ${test.id}${test.error?' · '+test.error:''}`,results);
        post('question_answered',{entity_id:test.id,payload:{question_id:test.id,correct:test.passed,attempt_number:state.checks,answer_type:'connected_node_execution'}});}
      post('custom',{event_type:'program_execution_checked',payload:{mission_id:m.mission_id,family:'terminal',correct:r.correct,total:r.total,terminal_network_version:2,language:'c',node_count:m.nodes.length}});
      if(r.passed)finish(true,'program_goals_verified');else{state.lives--;say('Check failed. '+(r.error||'Output differs from the target. Revise the highlighted nodes and try again.'));if(!state.lives)finish(false,'program_checks_exhausted');}render();
    }
    function finish(won,reason){state.done=true;state.playing=false;cards.forEach(c=>c.area.disabled=true);if(won){say('All streams verified. Every C node forwarded data. Mission complete.');post('activity_completed',{entity_id:m.mission_id,payload:{won,family:'terminal',terminal_network_version:2,language:'c'}});}
      post('game_over',{won,reason,score:won?100:Math.round(state.correct/Math.max(1,state.tested)*100),accuracy:state.correct/Math.max(1,state.tested),answered:state.tested,correct:state.correct,error_count:state.tested-state.correct,hint_count:state.hints,duration_sec:state.elapsed,formal_assessment:false,accuracy_basis:'program_execution_goals'});
    }
    function play(speed){if(state.hostPaused||state.done)return;state.speed=speed;if(!state.result||state.recorded)prepare();state.playing=true;if(!state.frames.length)complete();}
    button('Stop',controls,()=>{if(state.done)return;state.playing=false;state.frames=[];state.at=-1;state.result=null;state.recorded=false;state.carry=0;results.replaceChildren();say('Simulation reset. Node programs and previous checks are retained.');render();});
    button('Pause',controls,()=>{if(state.done)return;state.playing=false;say('Execution paused. Run or Step to continue from this cycle.');});
    button('Run',controls,()=>play(20));button('Fast',controls,()=>play(200));
    button('Step',controls,()=>{if(state.done||state.hostPaused)return;state.playing=false;if(!state.result||state.recorded)prepare();advance();});
    function frame(){return state.frames[state.at];}
    function renderOutput(){
      const f=frame(),test=m.cases[f?.case_index??0],actual=f?.outputs||[];
      inputText.textContent=`INPUT [${test.inputs.join(', ')}]`;output.replaceChildren();
      if(m.output_view==='image'){
        const values=test.expected.map(v=>typeof v==='number'?v:String(v).charCodeAt(0)),lo=Math.min(...values),hi=Math.max(...values),width=Math.ceil(Math.sqrt(values.length)),height=Math.ceil(values.length/width);
        for(const [label,data] of [['TARGET',test.expected],['ACTUAL',actual]]){
          make('h2',label,output);const image=make('canvas',null,output,'network-image');image.width=180;image.height=180;image.setAttribute('aria-label',`${label} grayscale signal image: ${data.join(', ')||'no output yet'}`);
          const ctx=image.getContext('2d');ctx.fillStyle='#1b1d1b';ctx.fillRect(0,0,180,180);
          data.slice(0,values.length).forEach((value,i)=>{const n=typeof value==='number'?value:String(value).charCodeAt(0),gray=hi===lo?(n===lo?255:0):Math.max(0,Math.min(255,Math.round((n-lo)/(hi-lo)*255)));ctx.fillStyle=`rgb(${gray},${gray},${gray})`;ctx.fillRect(i%width*180/width,Math.floor(i/width)*180/height,Math.ceil(180/width),Math.ceil(180/height));});
        }
        make('small',`Grayscale encoding · ${values.length} signals · fixed target range ${lo} to ${hi}. Exact stream values still determine success.`,output);
      }else if(m.output_view==='text'){
        for(const [label,data] of [['TARGET',test.expected],['ACTUAL',actual]]){make('h2',label,output);make('pre',data.map(v=>typeof v==='string'?v:Number.isInteger(v)&&v>=32&&v<=126?String.fromCharCode(v):String(v)).join(''),output,'network-text-output');}
        make('small','Character signals appear as text. Printable integer ASCII codes are rendered as characters.',output);
      }else{
        const table=make('table',null,output);make('caption','TARGET / ACTUAL',table);const head=make('tr',null,make('thead',null,table));make('th','#',head);make('th','TARGET',head);make('th','ACTUAL',head);
        const body=make('tbody',null,table);test.expected.forEach((value,i)=>{const row=make('tr',null,body);make('td',i+1,row);make('td',String(value),row);make('td',i<actual.length?String(actual[i]):'—',row);if(i<actual.length)row.className=actual[i]===value?'match':'mismatch';});
      }
    }
    function links(f){
      const rect=board.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);svg.replaceChildren();
      const point=(id,port)=>{const i=m.nodes.findIndex(n=>n.id===id);if(i<0)return null;const r=cards[i].card.getBoundingClientRect(),x=r.left-rect.left,y=r.top-rect.top;return port==='UP'?[x+r.width/2,y]:port==='DOWN'?[x+r.width/2,y+r.height]:port==='LEFT'?[x,y+r.height/2]:[x+r.width,y+r.height/2];};
      for(const link of m.network.links){
        const a=point(link.from,link.out),b=point(link.to,link.in);if(!a||!b)continue;
        const transfer=f?.transfers.find(t=>t.from===link.from&&t.to===link.to),path=document.createElementNS(svg.namespaceURI,'path');
        path.setAttribute('d',`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`);path.setAttribute('class',transfer?'signal-active':'');svg.appendChild(path);
        const dx=b[0]-a[0],dy=b[1]-a[1],angle=Math.atan2(dy,dx),mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
        const arrow=document.createElementNS(svg.namespaceURI,'path');arrow.setAttribute('d',`M ${mx-7*Math.cos(angle-.5)} ${my-7*Math.sin(angle-.5)} L ${mx} ${my} L ${mx-7*Math.cos(angle+.5)} ${my-7*Math.sin(angle+.5)}`);arrow.setAttribute('class',transfer?'signal-active':'');svg.appendChild(arrow);
        if(transfer){const label=document.createElementNS(svg.namespaceURI,'text');label.setAttribute('x',mx+7);label.setAttribute('y',my-6);label.textContent=String(transfer.value);svg.appendChild(label);}
      }
    }
    function render(){
      const f=frame();metrics.textContent=`${f?.case_id||'BUILD'} / CYCLE ${f?f.tick+1:0} · ${m.nodes.length} NODES · ${state.checks} CHECKS · ${state.lives} LIVES`;
      cards.forEach((card,i)=>{const node=f?.nodes[i];card.highlight(node);card.fields.LINE.textContent=node?.active_line??node?.blocked_line??'—';card.fields.READ.textContent=node?.reads??0;card.fields.SENT.textContent=node?.writes??0;card.fields.MODE.textContent=node?.mode||'IDLE';card.fields.IDLE.textContent=f?`${Math.round((node?.idle||0)/(f.tick+1)*100)}%`:'—';card.variables.textContent=Object.entries(node?.vars||{}).map(([name,value])=>`${node.types[name]} ${name} = ${node.types[name]==='char'?JSON.stringify(String.fromCharCode(value))+' ('+value+')':value}`).join('\n')||'Variables: not executing';});
      renderOutput();links(f);
    }
    window.addEventListener('message',event=>{if(event.source!==window.parent)return;const msg=event.data;if(msg?.channel!=='logicade-host'||msg.version!==1)return;
      if(msg.type==='initialize')begin();else if(msg.type==='pause'){state.resumePlaying=state.playing;state.hostPaused=true;state.playing=false;post('game_paused');}
      else if(msg.type==='resume'){state.hostPaused=false;state.playing=Boolean(state.resumePlaying);state.resumePlaying=false;post('game_resumed');}
      else if(msg.type==='hint'&&!state.done){state.hints++;say(m.hint);post('hint_used',{payload:{source:'host_oracle',mission_id:m.mission_id}});}});
    window.addEventListener('keydown',event=>{if(event.key==='Escape'){state.playing=false;post('pause_request');}});
    const observer=new ResizeObserver(()=>links(frame()));observer.observe(board);
    window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
    function tick(now){const guiding=globalThis.LogiCadeFirstVisitGuide?.active,delta=state.last?Math.min(.2,(now-state.last)/1000):0;state.last=now;if(!guiding&&state.started&&!state.hostPaused&&!state.done)state.elapsed+=Math.max(0,delta);
      if(!guiding&&state.playing&&!state.hostPaused&&!state.done){state.carry+=delta*state.speed;let steps=Math.min(40,Math.floor(state.carry));state.carry-=steps;const changed=steps>0;while(steps--&&state.playing)advance(false);if(changed)render();}requestAnimationFrame(tick);}
    render();requestAnimationFrame(tick);
  }
  globalThis.LogiCadeTerminalNetwork={start};
})();
