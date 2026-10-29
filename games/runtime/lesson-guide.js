(() => {
  'use strict';
  function mount(parent,lesson,dock=false){
    if(!lesson)return;
    const details=document.createElement('details');details.className=dock?'lesson-guide lesson-guide-dock':'lesson-guide';
    const add=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;details.appendChild(el);return el;};
    add('summary',lesson.week===9?`Week 9 examination practice · Week ${lesson.source_week}`:`Week ${lesson.source_week} lesson · ${lesson.stage_title}`);
    add('h2',lesson.title);for(const point of lesson.points||[])add('p',point);
    if(lesson.example)add('pre',lesson.example);
    add('p',lesson.assessment_kind==='examination_practice'?'Examination practice. Results remain separate from formal pretest/posttest scores.':'Apply this lesson in the current mission.');
    for(const source of lesson.sources||[]){if(!/^https:\/\//.test(source.url))continue;const a=add('a',source.title);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';}
    parent.appendChild(details);
  }
  globalThis.LogiCadeLessonGuide={mount};
})();

// Shared by existing ZIPs as well as newly compiled packages. The host owns the
// account's first-visit flag; the sandbox only draws pointers to the current game.
(() => {
  'use strict';
  const guide = {active:false, durationMs:0, stepsFor};
  globalThis.LogiCadeFirstVisitGuide = guide;
  const dom = (selector,title,text) => ({selector,title,text});
  const area = (box,title,text) => ({box,title,text});
  const run = () => ({action:'Run',title:'Test your solution',text:'Run executes your solution and checks this mission’s goals. Step lets you inspect execution one step at a time. Reset simulation keeps your design so you can revise it. Failed checks can cost a life. Finish this guide, then build your solution before running it.'});
  function stepsFor(game) {
    const m=game.programming;
    if(game.mode==='welcome_video')return [];
    if(game.flowchart) {
      // These coordinates match the renderer's responsive Canvas geometry.
      const shape = (part) => (canvas) => {
        const portrait=canvas.clientWidth/canvas.clientHeight<.9,W=portrait?900:1200,H=portrait?1270:900;
        const task=portrait?[24,100,852,215]:[24,106,270,516],board=portrait?[24,336,852,590]:[318,106,858,516],tray=portrait?[24,946,852,300]:[24,644,1152,232];
        let b=task;
        if(part==='piece')b=[tray[0]+20,tray[1]+40,(tray[2]-40-12*((portrait?4:6)-1))/(portrait?4:6),58];
        if(part==='slot'){const s=game.flowchart.slots[0];b=[board[0]+42+s.x*(board[2]-84)-79,board[1]+28+s.y*(board[3]-56)-24,158,48];}
        if(part==='check')b=portrait?[task[0]+task[2]-220,task[1]+18,200,42]:[task[0]+18,task[1]+task[3]-117,task[2]-36,45];
        return [...b,W,H];
      };
      return [area(shape('task'),'Read the requested chart',game.flowchart.prompt),
        area(shape('piece'),'Pick up a flowchart block','Drag a block from this tray. Its shape tells you its role: Start/End, input/output, a process, or a decision. Read the text on each block.'),
        area(shape('slot'),'Build along the arrows','Drop the matching block into a numbered position. Follow the connecting arrows; Yes/No paths branch and loop-back arrows repeat a step. You can move placed blocks again.'),
        area(shape('check'),'Check your chart','After placing the blocks, choose CHECK CHART to test the requested algorithm. Read the feedback and revise incorrect placements. A failed check can cost a life; CLEAR BOARD removes your placements.')];
    }
    if(m?.family==='terminal')return [
      dom('.network-objective','Your mission',m.objective),dom('.network-input','Incoming signals','These values enter the first connected C node. Your programs must process every input stream and produce the required outputs.'),
      dom('.network-node textarea','Program the connected nodes','Write C in each node’s editor. Open Node task to read its responsibility. Read from its connected input port, perform the assigned operation, then send the result to its output port.'),
      dom('.network-node .network-ports','Follow the connections','These labels identify this node’s input and output directions. Use the matching directions with readPort and writePort. Signals travel along the arrows; executing lines turn white and waiting lines turn gray.'),
      dom('.network-output','Compare target and actual output','TARGET is what this challenge requires. ACTUAL shows what your connected programs produce. The mission chooses numbers, characters or a signal image; all required streams must pass.'),run()];
    if(m) {
      const intro=dom('.workbench-sidebar > p','Your mission',m.objective);
      if(m.family==='adventure') {
        const tile=([x,y])=>{const cell=Math.min(900/m.map[0].length,560/m.map.length),ox=(1000-cell*m.map[0].length)/2;return [ox+x*cell,65+y*cell,cell,cell,1000,740];};
        return [intro,area(tile(m.start),'Your character','Your C program moves this character through the walkable paths. Walls block movement. Plan your route before you run.'),
          ...(m.gems.length?[area(tile(m.gems[0]),'Collect the crystals',`This is a collectible crystal. Collect the ${m.gems.length} crystal(s) required by this mission along your route; reaching the exit alone is not enough.`)]:[]),
          area(tile(m.exit),'Reach the exit','This is the destination. Reach it after collecting the required items and meeting the programming goals described in the mission.'),
          dom('.workbench-editors','Build your program',m.source_exercise?'Use the source blocks and program editor to meet this mission’s C structure and execution goals. Read the rules for the available movement helpers.':'Write your C solution here. Use Rules and command reference for supported helpers. The map, requested output and variable goals belong to this mission.'),run()];
      }
      if(m.family==='factory') {
        const machine=m.machines.find(n=>n.type==='source')||m.machines[0],target=m.machines.find(n=>n.type==='output');
        const tile=n=>[80+n.x*76,78+n.y*76,76,76,1000,740];
        return [intro,dom('.factory-sprite-card','Drag machines and conveyor sprites','Drag a sprite from this tray onto the grid. Conveyors carry items; controllers apply IF/ELSE, WHILE or FOR rules. Read each card’s description, set the batch size, and use R to rotate conveyors.'),
          area(tile(machine),'Start the production route','Items enter here. Connect and power the machines required by this mission, following each recipe in order. Use splitters, routers and mergers only when the mission provides them.'),
          ...(target?[area(tile(target),'Deliver to the destination','Route the processed items into this destination. Meet the exact production target; branched missions also have separate targets shown in their mission and counter.')]:[]),run()];
      }
      if(m.family==='circuit') {
        const n=m.nodes[0];
        if(m.circuit_kind==='scope_controller')return [intro,
          area([50+n.x*900-60,80+n.y*450-45,120,90,1000,740],'Sensor input','This sensor supplies one signal to each independent C program test. Connect its output pin to the controller input pin.'),
          dom('.workbench-editors','Program the connected C controllers',m.signal_network?'Use Program node to edit the scope controller and every branch. Keep the scope lesson in controller; each branch must perform its stated transformation. Follow executing node switches the editor and highlights the actual C line.':'Declare file-scope variables before main. Use braces for local blocks. Print the scope trace and forward the input signal.'),
          dom('.workbench-inspector','Connect branches, merger and feedback',m.signal_network?'Wire every required connection in the checklist. SPLIT broadcasts to all branches; SUM waits for every branch result. Connect LOOP back to split and also to output. The loop selects feedback until its required pass count, then the final output.':'Connect input → controller → output using pins or Connect pins.'),
          area([20,455,960,265,1000,740],'Inspect scopes and signal traces','GLOBAL and LOCAL show the live variable scopes. TARGET is the required output trace; ACTUAL is produced by your C controller. Each test starts a fresh program, so file-scope initialization happens at startup.'),run()];
        return [intro,area([50+n.x*900-60,80+n.y*450-45,120,90,1000,740],'Wire the signal components','Connect component output pins to input pins to build the requested operation. Each input accepts one wire. The arrows show how data travels.'),
          dom('.workbench-inspector','Configure and connect','Select a component and operation, then choose the source and destination pins to connect. Match the mission’s required outputs for every input case.'),run()];
      }
      return [intro,dom('.workbench-editors','Build the requested solution','Read the lesson and rules, then use these controls to construct the solution for the current mission.'),run()];
    }
    return [dom('.lesson-guide','Read the C lesson','Open this lesson panel for the facts and examples used by the current archive challenge.'),
      area([40,470,1120,60,1200,760],'Read the current question','This question describes the current learning task. Read it before choosing a response.'),
      area([48,565,536,60,1200,760],'Choose a response','Click an answer or use the matching number key. Correct answers advance the challenge; incorrect answers can cost a life. Complete the required tasks to finish.')];
  }
  let opened=false;
  window.addEventListener('message',event=>{
    const msg=event.data,game=window.LOGICADE_CANVAS_GAME?.game;
    if(event.source!==window.parent||msg?.channel!=='logicade-host'||msg.version!==1||msg.type!=='initialize'||msg.first_visit_guidance!==true||opened||!game)return;
    const week=Number(msg.week??game.week),level=Number(msg.level??game.level);
    if(week<1||week>9||level!==(week===1?2:1))return;
    const steps=stepsFor(game);if(!steps.length)return;
    opened=true;guide.active=true;const started=performance.now();
    const send=type=>window.parent.postMessage({channel:'logicade-game',version:1,type},'*');
    send('guidance_started');
    const savedFocus=document.activeElement,scrollPositions=new Map();
    const root=document.createElement('div');root.className='first-visit-guide';
    const highlight=document.createElement('div');highlight.className='first-visit-highlight';highlight.setAttribute('aria-hidden','true');root.appendChild(highlight);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('first-visit-arrow');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS(svg.namespaceURI,'path'),tip=document.createElementNS(svg.namespaceURI,'path');svg.append(path,tip);root.appendChild(svg);
    const card=document.createElement('section');card.className='first-visit-card';card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-labelledby','first-visit-title');
    const progress=document.createElement('small'),title=document.createElement('h2'),copy=document.createElement('p'),nav=document.createElement('nav');title.id='first-visit-title';copy.setAttribute('aria-live','polite');
    const back=document.createElement('button'),next=document.createElement('button');back.type=next.type='button';back.textContent='Back';nav.append(back,next);card.append(progress,title,copy,nav);root.appendChild(card);document.body.appendChild(root);
    let index=0,frame=0;
    function target(){const s=steps[index];return s.selector?document.querySelector(s.selector):s.action?[...document.querySelectorAll('.workbench-controls button,.network-footer button')].find(b=>b.textContent===s.action):document.querySelector('#game');}
    function rect(){const el=target();if(!el)return null;const r=el.getBoundingClientRect();if(!steps[index].box)return r;
      const b=typeof steps[index].box==='function'?steps[index].box(el):steps[index].box;return {left:r.left+b[0]/b[4]*r.width,top:r.top+b[1]/b[5]*r.height,width:b[2]/b[4]*r.width,height:b[3]/b[5]*r.height};}
    const clamp=(n,lo,hi)=>Math.max(lo,Math.min(n,Math.max(lo,hi)));
    function position(){const r=rect();if(!r||r.width<=0||r.height<=0){highlight.hidden=true;svg.style.display='none';card.style.left='12px';card.style.top='80px';return;}
      highlight.hidden=false;svg.style.display='';const vw=window.innerWidth,vh=window.innerHeight,x=clamp(r.left,4,vw-12),y=clamp(r.top,4,vh-12),w=Math.min(r.width,vw-x-4),h=Math.min(r.height,vh-y-4);
      Object.assign(highlight.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
      const cw=card.offsetWidth,ch=card.offsetHeight,gap=28;
      const cx=x>cw+gap?x-cw-gap:x+w+cw+gap<vw?x+w+gap:clamp(x+w/2-cw/2,12,vw-cw-12);
      const cy=x>cw+gap||x+w+cw+gap<vw?clamp(y+h/2-ch/2,72,vh-ch-12):y>ch+gap?y-ch-gap:clamp(y+h+gap,72,vh-ch-12);
      card.style.left=cx+'px';card.style.top=cy+'px';
      const sx=clamp(x+w/2,cx,cx+cw),sy=clamp(y+h/2,cy,cy+ch),tx=clamp(sx,x,x+w),ty=clamp(sy,y,y+h),angle=Math.atan2(ty-sy,tx-sx);
      path.setAttribute('d',`M ${sx} ${sy} Q ${(sx+tx)/2+18} ${(sy+ty)/2-18} ${tx} ${ty}`);
      tip.setAttribute('d',`M ${tx-12*Math.cos(angle-.55)} ${ty-12*Math.sin(angle-.55)} L ${tx} ${ty} L ${tx-12*Math.cos(angle+.55)} ${ty-12*Math.sin(angle+.55)}`);
    }
    function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(position);}
    function show(){progress.textContent=`FIRST VISIT · ${index+1} / ${steps.length}`;title.textContent=steps[index].title;copy.textContent=steps[index].text;back.disabled=index===0;next.textContent=index===steps.length-1?'Got it · Play':'Next';
      const el=target();if(el&&el.tagName!=='CANVAS'){for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement)if(p.scrollHeight>p.clientHeight||p.scrollWidth>p.clientWidth){if(!scrollPositions.has(p))scrollPositions.set(p,[p.scrollLeft,p.scrollTop]);}el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});}
      schedule();next.focus();}
    function finish(){guide.active=false;guide.durationMs+=performance.now()-started;cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);document.removeEventListener('scroll',schedule,true);window.removeEventListener('keydown',key,true);root.remove();for(const [el,[x,y]]of scrollPositions)el.scrollTo(x,y);savedFocus?.focus?.();send('guidance_completed');}
    function key(e){if(!guide.active)return;if(e.key==='Tab'){e.preventDefault();(document.activeElement===next&&!back.disabled?back:next).focus();}else if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();}else if(!card.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();}}
    back.onclick=()=>{if(index>0){index--;show();}};next.onclick=()=>{if(index===steps.length-1)finish();else{index++;show();}};
    window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);window.addEventListener('keydown',key,true);show();
  });
})();
