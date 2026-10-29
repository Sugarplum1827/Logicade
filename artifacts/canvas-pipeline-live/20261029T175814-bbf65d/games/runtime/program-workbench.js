(() => {
  'use strict';
  function start(setup){
    const game=setup.game,m=game.programming,model=globalThis.LogiCadeProgramModel;
    const shell=document.querySelector('#game-shell'),canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),live=document.querySelector('#live-region');
    canvas.setAttribute('aria-label',`${m.family} simulation workspace. ${m.controls}`);
    document.body.classList.add('programming-workbench',`family-${m.family}`);
    const make=(tag,text,parent,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;if(parent)parent.appendChild(el);return el;};
    const header=make('header',null,shell,'workbench-header');make('strong',m.title,header);const metrics=make('span','',header);
    const layout=make('div',null,shell,'workbench-layout');const world=make('section',null,layout,'workbench-world');world.appendChild(canvas);
    const sidebar=make('aside',null,layout,'workbench-sidebar');make('h1','Mission',sidebar);make('p',m.objective,sidebar);
    globalThis.LogiCadeLessonGuide?.mount(sidebar,game.lesson);
    const instructions=make('details',null,sidebar);make('summary','Rules and command reference',instructions);make('p',m.controls,instructions);
    if(m.language==='c_subset')make('pre','#include <stdio.h>\n#include "logicade.h"\nint main(void) {\n  int value = 3;\n  printf("%d\\n", value);\n  // Movement or game-port helpers depend on this station.\n  return 0;\n}\nSupported: int, float, double, char; + - * / %; braces; initialization and assignment. This is a bounded C practice subset, not a complete compiler.',instructions);
    if(m.language!=='c_subset')make('pre',m.family==='terminal'?'MOV IN ACC / MOV ACC OUT\nADD n / SUB n / MUL n / NEG\nSAV / SWP / label: / JMP label\nINT name value / SET name value':m.family==='adventure'?'int steps = 2;\nmoveRight(steps);\nmoveDown(1);\nobserve(steps);\n{ int steps = 3; observe(steps); }':m.family==='factory'?'Ore → smelter → plate → assembler → component\nGold socket: batch controller.\nPurple socket: splitter or conditional router.\nBlue socket: merger, one waiting item at a time.\nSplitters alternate; blocked branches wait.\nRouters send IF / ELSE according to item value.\nMergers alternate ready incoming paths fairly.':'INPUT → operations → OUTPUT\nOne wire per input pin.\nOperations: ADD, SUB, MUL, NEG, SQUARE, RELAY',instructions);
    const editors=make('div',null,sidebar,'workbench-editors'),inspector=make('div',null,sidebar,'workbench-inspector');
    if(m.constants){make('h2','Archive dictionary',sidebar);for(const [name,value] of Object.entries(m.constants))make('pre',`${name}: ${value}`,sidebar,'workbench-fixture');}
    const footer=make('footer',null,shell,'workbench-controls');const feedback=make('p','Build a solution, then Run or Step to inspect its execution.',sidebar,'workbench-feedback');feedback.setAttribute('role','status');
    const results=make('div',null,sidebar,'workbench-results');
    const state={solution:{},frames:[],at:-1,result:null,running:false,paused:false,done:false,checks:0,tested:0,correct:0,hints:0,lives:Number(game.starting_lives)||3,selected:null,wire:null,tool:'belt',dir:'E',events:0,started:0,last:0,elapsed:0,dirty:true,drag:null};
    const copy=x=>JSON.parse(JSON.stringify(x));
    state.solution=m.family==='terminal'?{programs:m.nodes.map(n=>n.program)}:m.family==='circuit'?{nodes:copy(m.nodes),wires:copy(m.wires)}:m.family==='factory'?{machines:copy(m.machines),wires:copy(m.wires)}:{program:m.program};
    if(m.source_exercise){state.solution.source_order=[];state.solution.c_categories={};}
    state.quota=1;
    const images={};for(const [key,url] of Object.entries(game.assets||{}))if(/\.png$/i.test(url)){const img=new Image();img.src=url;images[key]=img;}
    const post=(type,fields={})=>window.parent.postMessage({channel:'logicade-game',version:1,type,event_id:`program-${game.file_id}-${++state.events}`,time_ms:state.started?Math.round(performance.now()-state.started):0,...fields},'*');
    function begin(){if(!state.started){state.started=performance.now();state.last=state.started;post('game_started',{game_id:game.file_id,variation_id:game.variation_id});}}
    const say=text=>{feedback.textContent=text;live.textContent=text;};
    function sound(key){const src=game.assets?.[key];if(src){const a=new Audio(src);a.volume=.25;a.play().catch(()=>{});}}
    function checkpoint(){post('checkpoint_saved',{payload:{mission_id:m.mission_id,solution:copy(state.solution)}});}
    function changed(){if(state.done)return;state.running=false;state.frames=[];state.at=-1;state.result=null;state.dirty=true;checkpoint();draw();}
    const button=(label,parent,fn)=>{const b=make('button',label,parent);b.type='button';b.onclick=fn;return b;};
    function editor(label,value,change){const wrap=make('label',label,editors);const area=make('textarea',null,wrap);area.value=value;area.spellcheck=false;area.maxLength=12000;area.setAttribute('aria-label',label);area.oninput=()=>{change(area.value);changed();};return area;}
    if(m.family==='terminal')m.nodes.forEach((node,i)=>editor(`Node ${node.id} program`,state.solution.programs[i],value=>state.solution.programs[i]=value));
    if(m.family==='adventure')editor('Adventure program',m.program,value=>state.solution.program=value);
    if(m.family==='terminal'||m.family==='circuit'){
      make('h2','Input → expected output',sidebar);for(const c of m.cases)make('pre',`${c.inputs.join(', ')}\n→ ${c.expected.join(', ')}`,sidebar,'workbench-fixture');
    }
    const run=button('Run',footer,()=>{if(state.paused||state.done)return;begin();if(!state.result||state.result.recorded)prepare();state.running=true;if(!state.frames.length)complete();});
    button('Step',footer,()=>{if(state.paused||state.done)return;begin();state.running=false;if(!state.result||state.result.recorded)prepare();advance();});
    button('Reset simulation',footer,()=>{if(state.done)return;state.running=false;state.frames=[];state.at=-1;state.result=null;post('custom',{event_type:'program_reset',payload:{mission_id:m.mission_id}});say('Execution reset. Your design and previous check results are retained.');draw();});
    button('Pause',footer,()=>{if(!state.done){state.paused=true;post('pause_request');post('game_paused');draw();}});
    function prepare(){
      state.result=model.check(m,state.solution);state.frames=state.result.frames||[];state.at=-1;state.dirty=false;
      post('custom',{event_type:'program_execution_started',payload:{family:m.family,mission_id:m.mission_id}});
      say('Executing your solution. Watch the state and outputs.');
    }
    function advance(){if(!state.result)return;if(state.at<state.frames.length-1){state.at++;post('custom',{event_type:'program_step',payload:{mission_id:m.mission_id,step:state.at}});draw();}if(state.at>=state.frames.length-1)complete();}
    function complete(){
      if(!state.result||state.result.recorded)return;const r=state.result;r.recorded=true;state.running=false;state.checks++;state.tested+=r.total;state.correct+=r.correct;results.replaceChildren();
      for(const c of r.checks){make('p',`${c.passed?'✓':'✕'} ${c.id}${c.outputs?' · actual '+c.outputs.join(', '):''}${c.error?' · '+c.error:''}`,results);post('question_answered',{entity_id:c.id,payload:{question_id:c.id,correct:c.passed,attempt_number:state.checks,answer_type:'program_execution'}});}
      post('custom',{event_type:'program_execution_checked',payload:{mission_id:m.mission_id,family:m.family,correct:r.correct,total:r.total}});
      if(r.passed){say('All goals verified. Mission complete.');sound('success_sound');finish(true,'program_goals_verified');}
      else{state.lives--;sound('error_sound');say(r.error||'The outputs do not satisfy the mission. Inspect the trace and revise your solution.');if(!state.lives)finish(false,'program_checks_exhausted');}
      draw();
    }
    function finish(won,reason){state.done=true;state.running=false;editors.querySelectorAll('textarea').forEach(e=>e.disabled=true);if(won)post('activity_completed',{entity_id:m.mission_id,payload:{won,family:m.family}});post('game_over',{won,reason,score:won?100:Math.round(state.correct/Math.max(1,state.tested)*100),accuracy:state.correct/Math.max(1,state.tested),answered:state.tested,correct:state.correct,error_count:state.tested-state.correct,hint_count:state.hints,duration_sec:state.elapsed,formal_assessment:false,accuracy_basis:'program_execution_goals'});}
    let fromSelect,toSelect,componentSelect,valueInput;
    function connectionControls(nodes){
      const fromLabel=make('label','Wire from',inspector);fromSelect=make('select',null,fromLabel);
      const toLabel=make('label','Wire to',inspector);toSelect=make('select',null,toLabel);
      for(const n of nodes){const a=make('option',n.id,fromSelect);a.value=n.id;const b=make('option',n.id,toSelect);b.value=n.id;}
      button('Connect pins',inspector,()=>connect(fromSelect.value,toSelect.value));
      button('Clear wires',inspector,()=>{if(state.done)return;state.solution.wires=[];changed();});
    }
    function connect(a,b){if(state.done||state.paused)return;if(a===b){say('Choose two different endpoints.');return;}if(m.family==='circuit')state.solution.wires=state.solution.wires.filter(w=>w[1]!==b);state.solution.wires.push([a,b]);state.wire=null;changed();say(`Connected ${a} → ${b}.`);}
    function factoryTray(){
      if(m.source_exercise){
        const exercise=m.source_exercise,panel=make('section',null,editors,'c-source-builder');panel.setAttribute('aria-label','C source assembly');
        const refreshSource=()=>{panel.replaceChildren();make('h2','Build the C source',panel);make('p',exercise.prompt,panel);
          for(const part of exercise.parts){const b=button('Add source block: '+part.label,panel,()=>{if(state.done||state.paused)return;state.solution.source_order.push(part.id);changed();refreshSource();});b.disabled=state.solution.source_order.includes(part.id);}
          const ordered=state.solution.source_order.map(id=>exercise.parts.find(p=>p.id===id));make('pre',ordered.map(p=>p.code).join('\n')||'Select source blocks in program order.',panel);
          for(const part of ordered)button('Remove source block: '+part.label,panel,()=>{if(state.done||state.paused)return;state.solution.source_order=state.solution.source_order.filter(id=>id!==part.id);changed();refreshSource();});
          for(const token of Object.keys(exercise.categories)){const label=make('label','Classify '+token,panel),select=make('select',null,label);select.setAttribute('aria-label','Classify '+token);for(const value of ['', 'keyword','identifier','directive']){const option=make('option',value||'Choose a category',select);option.value=value;}select.value=state.solution.c_categories[token]||'';select.onchange=()=>{if(!state.done&&!state.paused){state.solution.c_categories[token]=select.value;changed();}};}
        };refreshSource();
      }
      if(m.routing){make('h2','Branch contracts',editors);for(const goal of m.routing.targets)make('p',`${goal.id} · ${goal.label}: ${goal.target} components through ${goal.via.join(' → ')} → ${goal.output}`,editors,'factory-contract');make('p','Ore values: '+m.ore_values.slice(0,m.target).join(', '),editors,'factory-contract');}
      make('h2','Drag machine sprites onto the grid',editors);
      const tray=make('div',null,editors,'factory-sprite-tray');
      const descriptions={belt:['Conveyor','Horizontal, vertical or rounded corner. R rotates its output; connecting the input forms the bend.'],splitter:['Splitter','Alternate A / B outputs. Wait if the scheduled branch is full.'],router:['Conditional router','Send each item to its IF or ELSE output using the configured condition.'],merger:['Merger','Combine two incoming paths fairly into one output.'],if_else:['IF / ELSE controller','If the source is clear, release an item; otherwise wait. Stop after the batch.'],while:['WHILE controller','Keep releasing while released items are below the batch size.'],for:['FOR controller','Release one item for each counted batch iteration.']};
      for(const [kind,[label,description]] of Object.entries(descriptions)){
        const card=button(label,tray,()=>{state.tool=kind;say(description);});card.className='factory-sprite-card';card.setAttribute('aria-label','Select '+label);card.title=description;
        const img=make('img',null,card);img.src=game.assets[kind==='belt'?'factory_tile':'machine_'+kind];img.alt='';img.draggable=false;make('small',description,card);
        let start=null,ghost=null;
        card.onpointerdown=e=>{if(state.done||state.paused)return;start={x:e.clientX,y:e.clientY};state.tool=kind;card.setPointerCapture(e.pointerId);};
        card.onpointermove=e=>{if(!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)<5)return;if(!ghost){ghost=img.cloneNode();ghost.className='factory-drag-ghost';document.body.appendChild(ghost);}ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';};
        const end=e=>{if(ghost){ghost.remove();ghost=null;const r=canvas.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<r.right&&e.clientY>=r.top&&e.clientY<r.bottom){const p=point(e);applyCell(Math.floor((p.x-80)/76),Math.floor((p.y-78)/76));}}start=null;if(card.hasPointerCapture(e.pointerId))card.releasePointerCapture(e.pointerId);};
        card.onpointerup=end;card.onpointercancel=e=>{ghost?.remove();ghost=null;start=null;};
      }
      const quotaLabel=make('label','New controller batch size',editors),input=make('input',null,quotaLabel);input.type='number';input.min=1;input.max=m.ore;input.value=1;input.setAttribute('aria-label','New controller batch size');input.oninput=()=>state.quota=Number(input.value);
    }
    function refreshInspector(){
      if(!['circuit','factory'].includes(m.family))return;inspector.replaceChildren();
      if(m.family==='circuit'){
        const label=make('label','Component type',inspector);componentSelect=make('select',null,label);for(const op of m.palette){const o=make('option',op,componentSelect);o.value=op;}
        const valueLabel=make('label','Component value',inspector);valueInput=make('input',null,valueLabel);valueInput.type='number';valueInput.value=m.component_default;valueInput.min=-1000;valueInput.max=1000;
        button('Add component',inspector,()=>{if(state.done||state.paused)return;const nodes=state.solution.nodes;if(nodes.length>=m.rules.max_nodes){say('Component limit reached.');return;}const id='chip'+(++state.events);nodes.splice(nodes.length-1,0,{id,type:componentSelect.value,value:Number(valueInput.value),x:.25+(nodes.length%3)*.2,y:.25+Math.floor(nodes.length/3)*.25});changed();refreshInspector();});
        for(const n of state.solution.nodes.filter(n=>!n.fixed)){const row=make('div',null,inspector,'component-row');make('span',`${n.id}: ${n.type}`,row);const input=make('input',null,row);input.type='number';input.value=n.value;input.setAttribute('aria-label',`${n.id} value`);input.onchange=()=>{n.value=Number(input.value);changed();};button(`Remove ${n.id}`,row,()=>{if(state.done)return;state.solution.nodes=state.solution.nodes.filter(x=>x.id!==n.id);state.solution.wires=state.solution.wires.filter(w=>!w.includes(n.id));changed();refreshInspector();});}
        connectionControls(state.solution.nodes);
      }else{
        make('p',`Ore ${m.ore} · target ${m.target} · belt budget ${m.build_budget}`,inspector);
        for(const controller of state.solution.machines.filter(n=>['if_else','while','for'].includes(n.type))){
          const label=make('label',`${controller.id} batch size`,inspector),input=make('input',null,label);input.type='number';input.min=1;input.max=m.ore;input.value=controller.quota;input.setAttribute('aria-label',`${controller.id} batch size`);input.oninput=()=>{if(!state.done){controller.quota=Number(input.value);changed();}};
        }
        const directionControl=(label,value,update)=>{const wrap=make('label',label,inspector),select=make('select',null,wrap);select.setAttribute('aria-label',label);for(const d of ['N','E','S','W']){const option=make('option',d,select);option.value=d;}select.value=value;select.onchange=()=>{if(!state.done&&!state.paused){update(select.value);changed();}};};
        for(const n of state.solution.machines.filter(n=>['splitter','router','merger'].includes(n.type))){
          make('h2',n.id+' · '+n.type,inspector);
          if(n.type==='merger')directionControl(`${n.id} output direction`,n.dir,value=>n.dir=value);
          else for(const label of Object.keys(n.outputs))directionControl(`${n.id} ${label} output direction`,n.outputs[label],value=>n.outputs[label]=value);
          if(n.type==='router'){
            const label=make('label',`${n.id} condition`,inspector),select=make('select',null,label);select.setAttribute('aria-label',`${n.id} condition`);
            for(const [value,text] of [['even','Item value is even'],['threshold','Item value >= threshold']]){const o=make('option',text,select);o.value=value;}select.value=n.condition.kind;
            select.onchange=()=>{if(state.done||state.paused)return;n.condition=select.value==='threshold'?{kind:'threshold',value:1}:{kind:'even'};changed();refreshInspector();};
            if(n.condition.kind==='threshold'){const label=make('label',`${n.id} threshold`,inspector),input=make('input',null,label);input.type='number';input.min=-1000;input.max=1000;input.value=n.condition.value;input.setAttribute('aria-label',`${n.id} threshold`);input.oninput=()=>{if(!state.done&&!state.paused){n.condition.value=Number(input.value);changed();}};}
          }
        }
        for(const tool of ['belt','erase','wire'])button(tool,inspector,()=>{state.tool=tool;say(`Tool: ${tool}; direction ${state.dir}.`);});
        button('Rotate belt (R)',inspector,rotate);
        const row=make('label','Grid cell',inspector),xInput=make('input',null,row),yInput=make('input',null,row);xInput.type=yInput.type='number';xInput.value=1;yInput.value=2;xInput.setAttribute('aria-label','Grid column');yInput.setAttribute('aria-label','Grid row');
        button('Apply tool to cell',inspector,()=>applyCell(Number(xInput.value),Number(yInput.value)));
        connectionControls(state.solution.machines.filter(n=>n.type!=='belt'));
      }
    }
    function rotate(){state.dir={N:'E',E:'S',S:'W',W:'N'}[state.dir];say(`Belt direction: ${state.dir}.`);}
    function applyCell(x,y){
      if(state.done||state.paused||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=m.width||y>=m.height)return;
      const found=state.solution.machines.find(n=>n.x===x&&n.y===y);
      if(state.tool==='wire'){if(!found){say('Select a generator or machine for the wire.');return;}if(state.wire)connect(state.wire,found.id);else{state.wire=found.id;say(`Wire begins at ${found.id}; select the other endpoint.`);}return;}
      if(found?.fixed){say('This machine is fixed. Repair its surrounding conveyors.');return;}
      state.solution.machines=state.solution.machines.filter(n=>n!==found);
      if(found)state.solution.wires=state.solution.wires.filter(w=>!w.includes(found.id));
      if(['belt','if_else','while','for','splitter','router','merger'].includes(state.tool)){
        const fork=['splitter','router'].includes(state.tool),id=state.tool==='belt'?`belt_${x}_${y}`:fork?'junction':state.tool==='merger'?'merge':'controller';
        const labels=state.tool==='router'?['IF','ELSE']:['A','B'],left={N:'W',E:'N',S:'E',W:'S'},right={N:'E',E:'S',S:'W',W:'N'};
        state.solution.machines.push({id:state.solution.machines.some(n=>n.id===id)?id+'_'+(++state.events):id,x,y,type:state.tool,dir:state.dir,fixed:false,
          ...(fork?{outputs:{[labels[0]]:left[state.dir],[labels[1]]:right[state.dir]},...(state.tool==='router'?{condition:{kind:'even'}}:{})}:state.tool==='belt'||state.tool==='merger'?{}:{quota:state.quota})});
      }
      changed();refreshInspector();
    }
    const rect=(x,y,w,h,fill,stroke)=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);if(stroke){ctx.strokeStyle=stroke;ctx.strokeRect(x,y,w,h);}};
    const text=(s,x,y,size=17,color='#d9e6ee')=>{ctx.fillStyle=color;ctx.font=`${size}px ui-monospace, Consolas, monospace`;ctx.fillText(String(s),x,y);};
    function arrow(a,b,color='#4de1ba'){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);ctx.beginPath();ctx.moveTo(b[0],b[1]);ctx.lineTo(b[0]-12*Math.cos(angle-.4),b[1]-12*Math.sin(angle-.4));ctx.lineTo(b[0]-12*Math.cos(angle+.4),b[1]-12*Math.sin(angle+.4));ctx.closePath();ctx.fillStyle=color;ctx.fill();}
    function drawConveyor(n,x,y,cell){
      const path=model.conveyorPath(n,state.solution.machines);if(!path)return;
      const p=v=>[x+v[0]*cell,y+v[1]*cell],a=p(path.start),c=p(path.control),b=p(path.end);
      const trace=()=>{ctx.beginPath();ctx.moveTo(...a);if(path.curved)ctx.quadraticCurveTo(...c,...b);else ctx.lineTo(...b);};
      ctx.save();ctx.lineCap='butt';ctx.lineJoin='round';
      for(const [width,color] of [[44,'#abb8b7'],[36,'#172a32'],[26,'#657b85']]){trace();ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();}
      trace();ctx.lineWidth=23;ctx.strokeStyle='#a8b6bb';ctx.setLineDash([3,9]);ctx.stroke();ctx.setLineDash([]);
      const direction={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]}[n.dir];
      const tip=[b[0]-direction[0]*10,b[1]-direction[1]*10];
      arrow([tip[0]-direction[0]*17,tip[1]-direction[1]*17],tip,'#ffe087');ctx.restore();
    }
    function drawJunction(n,x,y,cell){
      const directions={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]},cx=x+cell/2,cy=y+cell/2;
      ctx.save();rect(x+9,y+9,cell-18,cell-18,'#153442');
      const outputs=n.type==='merger'?{OUT:n.dir}:n.outputs;
      for(const [label,dir] of Object.entries(outputs)){const d=directions[dir];if(!d)continue;arrow([cx,cy],[cx+d[0]*cell*.45,cy+d[1]*cell*.45],label==='B'||label==='ELSE'?'#ffa86b':'#6fe1dc');text(label,cx+d[0]*cell*.34-10,cy+d[1]*cell*.34-6,10,'#fff');}
      if(n.type==='merger')for(const p of state.solution.machines){const ports=['splitter','router'].includes(p.type)?Object.values(p.outputs):[p.dir];for(const dir of ports){const d=directions[dir];if(d&&p.x+d[0]===n.x&&p.y+d[1]===n.y)arrow([cx-d[0]*cell*.45,cy-d[1]*cell*.45],[cx-d[0]*7,cy-d[1]*7],'#d5c991');}}
      text(n.type==='splitter'?'SPLIT':n.type==='router'?'IF ?':'JOIN',x+12,y+cell*.6,13,'#fff0c1');ctx.restore();
    }
    const positions=new Map();
    function draw(){
      const r=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);if(canvas.width!==Math.round(r.width*dpr)||canvas.height!==Math.round(r.height*dpr)){canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);}
      ctx.setTransform(canvas.width/1000,0,0,canvas.height/740,0,0);rect(0,0,1000,740,m.family==='terminal'?'#030404':m.family==='factory'?'#34382c':m.family==='adventure'?'#242222':'#092431');
      positions.clear();const frame=state.frames[state.at];metrics.textContent=`Checks ${state.checks} · Lives ${state.lives} · ${state.paused?'PAUSED':state.done?'FINISHED':'BUILD / TEST'}`;
      text(m.family.toUpperCase()+' · '+m.mission_id,24,32,15,'#eac879');
      if(m.family==='terminal'){
        for(let i=0;i<m.nodes.length;i++){const x=45+i*475,n=frame?.nodes[i];rect(x,90,430,450,'#000','#abb8b2');text(m.nodes[i].id,x+15,120,24);text('ACC '+(n?.acc??0)+'   BAK '+(n?.bak??0),x+15,155);const code=state.solution.programs[i].split('\n');code.slice(0,17).forEach((line,j)=>{if(n?.pc===j)rect(x+8,175+j*19,410,21,'#234837');text(`${j+1} ${line}`,x+16,191+j*19,15);});text(n?.mode||'idle',x+15,565,16,'#85ce9e');if(i)arrow([480,325],[510,325]);}
        text('OUTPUT: '+(frame?.outputs||[]).join(', '),45,625,19);text('VARIABLES: '+JSON.stringify(frame?.nodes.map(n=>n.vars)||[]),45,666,15);
      }else if(m.family==='circuit'){
        for(let x=0;x<1000;x+=35){ctx.strokeStyle='#153b49';ctx.beginPath();ctx.moveTo(x,65);ctx.lineTo(x,690);ctx.stroke();}for(let y=65;y<700;y+=35){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1000,y);ctx.stroke();}
        for(const n of state.solution.nodes)positions.set(n.id,{x:n.x*900+50,y:n.y*450+80});
        for(const [a,b] of state.solution.wires){const p=positions.get(a),q=positions.get(b);if(p&&q)arrow([p.x+62,p.y],[q.x-62,q.y]);}
        for(const n of state.solution.nodes){const p=positions.get(n.id);rect(p.x-60,p.y-45,120,90,'#173847','#ddaf5d');text(n.id,p.x-52,p.y-19,12);text(n.type,p.x-52,p.y+3,18,'#ffda75');text(frame?.values?.[n.id]??n.value??'',p.x-52,p.y+29,18);rect(p.x-67,p.y-8,10,16,'#a5e9e2');rect(p.x+57,p.y-8,10,16,'#a5e9e2');}
        text('SIGNAL IN: '+(frame?.input??'—'),25,650,18);text('OUT: '+(frame?.outputs||[]).join(', '),25,682,18);
      }else if(m.family==='factory'){
        const cell=76,ox=80,oy=78;for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++)rect(ox+x*cell,oy+y*cell,cell-1,cell-1,'#3f4536','#525744');
        for(let x=0;x<m.width;x++)text(x,ox+x*cell+34,oy-8,12,'#bcc8b4');for(let y=0;y<m.height;y++)text(y,ox-18,oy+y*cell+42,12,'#bcc8b4');
        const [socketX,socketY]=m.controller.socket;rect(ox+socketX*cell+3,oy+socketY*cell+3,cell-7,cell-7,'#5a4b24','#ffe386');text('SOCKET',ox+socketX*cell+6,oy+socketY*cell+39,12,'#ffe386');
        if(m.routing)for(const [position,label,color] of [[m.routing.fork.position,'FORK','#c599e7'],...(m.routing.merge?[[m.routing.merge.position,'JOIN','#86cde6']]:[])]){const [x,y]=position;rect(ox+x*cell+3,oy+y*cell+3,cell-7,cell-7,'#26343b',color);text(label,ox+x*cell+10,oy+y*cell+40,12,color);}
        for(const [a,b] of state.solution.wires){const p=state.solution.machines.find(n=>n.id===a),q=state.solution.machines.find(n=>n.id===b);if(p&&q)arrow([ox+p.x*cell+38,oy+p.y*cell+38],[ox+q.x*cell+38,oy+q.y*cell+38],'#64c8e0');}
        for(const n of state.solution.machines){const x=ox+n.x*cell,y=oy+n.y*cell;
          if(n.type==='belt')drawConveyor(n,x,y,cell);
          else{rect(x+4,y+4,cell-9,cell-9,n.type==='generator'?'#43619a':'#665344','#cab889');const img=images['machine_'+n.type];if(img?.complete&&img.naturalWidth){ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(img,x+6,y+6,cell-12,cell-12);ctx.restore();}if(['splitter','router','merger'].includes(n.type))drawJunction(n,x,y,cell);else{text(n.type.slice(0,4),x+8,y+30,14,'#fff');text(n.dir,x+28,y+55,22,'#ffdf71');}}
          if(frame?.buffers[n.id]){const path=n.type==='belt'?model.conveyorPath(n,state.solution.machines):null;const center=path?.curved?[path.start[0]*.25+.25+path.end[0]*.25,path.start[1]*.25+.25+path.end[1]*.25]:[.5,.5];ctx.fillStyle={ore:'#d1a06a',plate:'#e8edf5',component:'#76e5a6'}[frame.buffers[n.id].type];ctx.beginPath();ctx.arc(x+center[0]*cell,y+center[1]*cell,9,0,7);ctx.fill();}
        }
        text(`TICK ${frame?.tick??0} · RELEASED ${frame?.released??0} · DELIVERED ${frame?.delivered??0} / ${m.target}`,55,680,18);
        if(m.routing)text(m.routing.targets.map(g=>`${g.id}: ${frame?.branch_delivered?.[g.id]||0}/${g.target}`).join('    ·    '),55,712,17,'#ffe08f');
        else if(frame?.controller)text(frame.controller.action,55,712,17,'#ffe08f');
      }else{
        const cell=Math.min(900/m.map[0].length,560/m.map.length),ox=(1000-cell*m.map[0].length)/2,oy=65;for(let y=0;y<m.map.length;y++)for(let x=0;x<m.map[y].length;x++){rect(ox+x*cell,oy+y*cell,cell-1,cell-1,m.map[y][x]==='#'?'#36322c':'#6b6250','#221e1a');const tile=images[m.map[y][x]==='#'?'wall_tile':'dungeon_tile'];if(tile?.complete&&tile.naturalWidth){ctx.globalAlpha=m.map[y][x]==='#'?.8:.55;ctx.imageSmoothingEnabled=false;ctx.drawImage(tile,ox+x*cell,oy+y*cell,cell-1,cell-1);ctx.globalAlpha=1;}}
        for(const [x,y] of m.gems)if(!frame?.gems.includes(x+','+y)){ctx.fillStyle='#5ee7ff';ctx.beginPath();ctx.moveTo(ox+x*cell+cell*.5,oy+y*cell+cell*.18);ctx.lineTo(ox+x*cell+cell*.73,oy+y*cell+cell*.5);ctx.lineTo(ox+x*cell+cell*.5,oy+y*cell+cell*.82);ctx.lineTo(ox+x*cell+cell*.27,oy+y*cell+cell*.5);ctx.closePath();ctx.fill();}
        const [ex,ey]=m.exit;rect(ox+ex*cell+cell*.15,oy+ey*cell+cell*.15,cell*.7,cell*.7,'#52864c','#d5e580');text('EXIT',ox+ex*cell+cell*.2,oy+ey*cell+cell*.56,Math.max(8,cell*.17));
        const targetX=frame?.x??m.start[0],targetY=frame?.y??m.start[1];state.visualX=(state.visualX??targetX)+(targetX-(state.visualX??targetX))*.35;state.visualY=(state.visualY??targetY)+(targetY-(state.visualY??targetY))*.35;const x=state.visualX,y=state.visualY,hero=images.hero_sprite;if(hero?.complete&&hero.naturalWidth)ctx.drawImage(hero,ox+x*cell+cell*.1,oy+y*cell+cell*.05,cell*.8,cell*.9);else{rect(ox+x*cell+cell*.27,oy+y*cell+cell*.15,cell*.46,cell*.7,'#80c5fa');}
        text('OUTPUT '+JSON.stringify(frame?.watch||[])+' · VARIABLES '+JSON.stringify(frame?.variables||{}),30,675,16);
        if(m.language==='c_subset')text('GLOBALS '+JSON.stringify(frame?.globals||{})+' · LOCALS '+JSON.stringify(frame?.locals||{}),30,708,16,'#aee2cc');
      }
      if(state.paused){rect(220,290,560,110,'#141f2c','#edcc7b');text('PAUSED — continue from the game menu',240,350,21);}
    }
    function point(event){const r=canvas.getBoundingClientRect();return {x:(event.clientX-r.left)*1000/r.width,y:(event.clientY-r.top)*740/r.height};}
    canvas.addEventListener('pointerdown',event=>{
      if(state.done||state.paused)return;begin();const p=point(event);
      if(m.family==='factory'){
        const x=Math.floor((p.x-80)/76),y=Math.floor((p.y-78)/76);
        if(state.tool==='wire'){applyCell(x,y);return;}
        state.factoryDrag={x,y,start:p,origin:state.solution.machines.find(n=>n.x===x&&n.y===y)};canvas.setPointerCapture(event.pointerId);return;
      }
      if(m.family!=='circuit')return;
      const n=state.solution.nodes.find(n=>{const q=positions.get(n.id);return Math.abs(p.x-q.x)<70&&Math.abs(p.y-q.y)<48;});if(!n)return;
      const q=positions.get(n.id);
      if(p.x>q.x+45){state.wire=n.id;say('Select the input pin of the destination component.');}
      else if(p.x<q.x-45&&state.wire)connect(state.wire,n.id);
      else{state.drag=n.id;canvas.setPointerCapture(event.pointerId);}
    });
    canvas.addEventListener('pointermove',event=>{if(!state.drag)return;const p=point(event),n=state.solution.nodes.find(n=>n.id===state.drag);n.x=Math.max(.03,Math.min(.97,(p.x-50)/900));n.y=Math.max(.03,Math.min(.97,(p.y-80)/450));draw();});
    canvas.addEventListener('pointerup',event=>{
      if(state.factoryDrag){
        const drag=state.factoryDrag;state.factoryDrag=null;const p=point(event),x=Math.floor((p.x-80)/76),y=Math.floor((p.y-78)/76),target=state.solution.machines.find(n=>n.x===x&&n.y===y);
        if(drag.origin&&!drag.origin.fixed&&(x!==drag.x||y!==drag.y)){
          if(x>=0&&y>=0&&x<m.width&&y<m.height&&!target?.fixed){state.solution.machines=state.solution.machines.filter(n=>n!==target);if(target)state.solution.wires=state.solution.wires.filter(w=>!w.includes(target.id));drag.origin.x=x;drag.origin.y=y;changed();refreshInspector();}
          else say('Move the sprite to a free cell inside the grid.');
        }else if(x===drag.x&&y===drag.y)applyCell(x,y);
      }
      if(state.drag){state.drag=null;changed();}
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointercancel',()=>{state.drag=null;state.factoryDrag=null;});
    window.addEventListener('keydown',e=>{if(e.target.closest?.('textarea,input,select'))return;if(e.key==='Escape'){state.paused=true;post('pause_request');draw();}else if(e.key.toLowerCase()==='r'&&m.family==='factory')rotate();});
    window.addEventListener('message',event=>{if(event.source!==window.parent)return;const msg=event.data;if(msg?.channel!=='logicade-host'||msg.version!==1)return;if(msg.type==='initialize')begin();else if(msg.type==='pause'){state.paused=true;post('game_paused');}else if(msg.type==='resume'){state.paused=false;post('game_resumed');}else if(msg.type==='hint'&&!state.done){state.hints++;say(m.hint);post('hint_used',{payload:{source:'host_oracle',mission_id:m.mission_id}});}draw();});
    let lastStep=0;function tick(now){const guiding=globalThis.LogiCadeFirstVisitGuide?.active;if(state.started){const dt=Math.min(.2,(now-state.last)/1000);if(!guiding&&!state.paused&&!state.done)state.elapsed+=Math.max(0,dt);state.last=now;}if(!guiding&&state.running&&!state.paused&&!state.done&&now-lastStep>100){lastStep=now;advance();}draw();requestAnimationFrame(tick);}
    if(m.family==='factory')factoryTray();refreshInspector();draw();requestAnimationFrame(tick);
  }
  globalThis.LogiCadeProgramWorkbench={start};
})();
