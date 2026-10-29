(() => {
  'use strict';
  function start(setup){
    const game=setup.game,puzzle=game.flowchart,canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),live=document.querySelector('#live-region');
    if(!puzzle||!globalThis.LogiCadeFlowchartModel){live.textContent='This package has no executable flowchart puzzle.';return;}
    globalThis.LogiCadeLessonGuide?.mount(document.body,game.lesson,true);
    canvas.setAttribute('aria-label','Drag flowchart blocks from the tray into numbered positions. Build the requested algorithm, then Check chart. Arrow keys and Enter also place selected blocks.');
    canvas.style.touchAction='none';
    const colors={start:'#62eaa3',end:'#61d8bc',input:'#58d7ff',output:'#ffa5e1',process:'#ffe26a',decision:'#bd9bff'};
    const state={placements:{},drag:null,selected:null,focus:0,started:false,finished:false,paused:false,
      lives:Number(game.starting_lives)||3,checks:0,tested:0,passed:0,errors:0,hints:0,elapsed:0,startTime:0,last:0,
      feedback:'Drag blocks into the chart. Follow the arrows and read the task.',bad:new Set(),counter:0,output:'',pending:0};
    let W=1200,H=900,layout={},slotBoxes=[],trayBoxes=[],buttons=[];
    const pieces=new Map(puzzle.pieces.map(piece=>[piece.id,piece]));
    const post=(type,fields={})=>window.parent.postMessage({channel:'logicade-game',version:1,type,
      event_id:`flowchart-${game.file_id}-${++state.counter}`,time_ms:Math.round(performance.now()-state.startTime),...fields},'*');
    const announce=message=>{state.feedback=message;live.textContent=message;};
    const sound=name=>{const src=game.assets?.[name];if(src){const audio=new Audio(src);audio.volume=.3;audio.play().catch(()=>{});}};
    const rect=(x,y,w,h,r,fill,stroke=null,width=1)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}};
    const text=(t,x,y,size=18,color='#eaf6ff',weight=600,align='left')=>{ctx.font=`${weight} ${size}px system-ui, sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(t),x,y);};
    function lines(t,x,y,width,size=16,color='#dcecff',limit=6){
      ctx.font=`600 ${size}px system-ui, sans-serif`;let line='',row=0;
      for(const word of String(t).split(/\s+/)){const next=line?line+' '+word:word;
        if(line&&ctx.measureText(next).width>width){text(line,x,y+row*(size+7),size,color);line=word;row++;if(row>=limit)return;}
        else line=next;}
      if(line&&row<limit)text(line,x,y+row*(size+7),size,color);
    }
    function geometry(){
      const portrait=canvas.clientWidth/canvas.clientHeight<.9;
      W=portrait?900:1200;H=portrait?1270:900;
      layout=portrait?{task:{x:24,y:100,w:852,h:215},board:{x:24,y:336,w:852,h:590},tray:{x:24,y:946,w:852,h:300},columns:4}:
        {task:{x:24,y:106,w:270,h:516},board:{x:318,y:106,w:858,h:516},tray:{x:24,y:644,w:1152,h:232},columns:6};
      const b=layout.board;
      slotBoxes=puzzle.slots.map(slot=>({...slot,x:b.x+42+slot.x*(b.w-84),y:b.y+28+slot.y*(b.h-56),w:158,h:48}));
      const count=layout.columns,gap=12,t=layout.tray,cw=(t.w-40-gap*(count-1))/count,ch=62;
      trayBoxes=puzzle.pieces.map((piece,index)=>({piece,x:t.x+20+(index%count)*(cw+gap),y:t.y+40+Math.floor(index/count)*65,w:cw,h:58}));
    }
    function node(piece,x,y,w,h,alpha=1){
      ctx.save();ctx.globalAlpha=alpha;ctx.beginPath();
      if(piece.kind==='start'||piece.kind==='end')ctx.roundRect(x-w/2,y-h/2,w,h,h/2);
      else if(piece.kind==='decision'){ctx.moveTo(x,y-h*.65);ctx.lineTo(x+w/2,y);ctx.lineTo(x,y+h*.65);ctx.lineTo(x-w/2,y);ctx.closePath();}
      else if(piece.kind==='input'||piece.kind==='output'){ctx.moveTo(x-w/2+16,y-h/2);ctx.lineTo(x+w/2,y-h/2);ctx.lineTo(x+w/2-16,y+h/2);ctx.lineTo(x-w/2,y+h/2);ctx.closePath();}
      else ctx.rect(x-w/2,y-h/2,w,h);
      ctx.fillStyle=colors[piece.kind]||'#ddd';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=9;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#effbff';ctx.lineWidth=1.5;ctx.stroke();
      ctx.font='700 13px system-ui, sans-serif';const words=piece.label.split(/\s+/),rows=[];let row='';
      for(const word of words){if(row&&ctx.measureText(row+' '+word).width>w-27){rows.push(row);row=word;}else row=row?row+' '+word:word;}
      if(row)rows.push(row);
      rows.slice(0,3).forEach((line,i)=>text(line,x,y+(i-(Math.min(rows.length,3)-1)/2)*14,12,'#10203d',800,'center'));
      ctx.restore();
    }
    function arrow(edge){
      const from=slotBoxes.find(slot=>slot.id===edge.from),to=slotBoxes.find(slot=>slot.id===edge.to),b=layout.board;
      if(!from||!to)return;
      const via=(edge.via||[]).map(([x,y])=>({x:b.x+42+x*(b.w-84),y:b.y+28+y*(b.h-56)}));
      let points;
      if(via.length)points=[{x:from.x+(via[0].x<from.x?-82:82),y:from.y},...via,{x:to.x+(via.at(-1).x<to.x?-82:82),y:to.y}];
      else if(Math.abs(from.x-to.x)<5)points=[{x:from.x,y:from.y+29},{x:to.x,y:to.y-29}];
      else {const mid=(from.y+to.y)/2;points=[{x:from.x,y:from.y+29},{x:from.x,y:mid},{x:to.x,y:mid},{x:to.x,y:to.y-29}];}
      ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);
      ctx.strokeStyle='#7ec9ef';ctx.lineWidth=2.5;ctx.stroke();
      const end=points.at(-1),before=points.at(-2),angle=Math.atan2(end.y-before.y,end.x-before.x);
      ctx.beginPath();ctx.moveTo(end.x,end.y);ctx.lineTo(end.x-10*Math.cos(angle-.45),end.y-10*Math.sin(angle-.45));ctx.lineTo(end.x-10*Math.cos(angle+.45),end.y-10*Math.sin(angle+.45));ctx.closePath();ctx.fillStyle='#9cddff';ctx.fill();
      if(edge.label){const p=!via.length&&Math.abs(from.x-to.x)>5?{x:(from.x+to.x)/2,y:(from.y+to.y)/2}:points[Math.min(1,points.length-1)];rect(p.x-20,p.y-10,40,20,4,'#112443');text(edge.label,p.x,p.y,11,'#cff6ff',800,'center');}
    }
    function button(label,x,y,w,h,action,color='#f9d34c'){
      rect(x,y,w,h,9,color,'#fff0ae',1.5);text(label,x+w/2,y+h/2,14,'#1b2140',800,'center');buttons.push({x,y,w,h,action});
    }
    function draw(){
      geometry();ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);buttons=[];
      const gradient=ctx.createLinearGradient(0,0,W,H);gradient.addColorStop(0,'#142e61');gradient.addColorStop(.55,'#24164d');gradient.addColorStop(1,'#07172f');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
      for(let i=0;i<36;i++){const x=((i*191+(game.seed||1))%W),y=(i*113)%H;ctx.fillStyle=i%3?'#7aafd1':'#ebefff';ctx.fillRect(x,y,2,2);}
      rect(24,20,W-48,66,10,'#0b1531','#80bcf2',2);
      text('FLOWCHART BUILDER',46,44,17,'#f9df65',900);text(`${Object.keys(state.placements).length}/${puzzle.slots.length} BLOCKS`,46,67,12,'#c7ddff');
      text(`CHECKS ${state.checks}`,W-315,52,14,'#bfe6ff',800);text(`♥ ${state.lives}`,W-185,52,17,'#ff9cbf',800);
      button('Ⅱ',W-100,34,54,40,()=>pause(true),'#ff9b65');
      const {task,board,tray}=layout;
      rect(task.x,task.y,task.w,task.h,13,'rgba(6,16,40,.86)','#607fb9',2);
      text('YOUR TASK',task.x+18,task.y+25,13,'#7ee7ff',900);
      lines(puzzle.title,task.x+18,task.y+55,task.w-36,20,'#ffe9a3',2);
      lines(puzzle.prompt,task.x+18,task.y+112,task.w-36,16,'#eff6ff',6);
      if(task.h>300){
        lines('Drag a block from the tray to a numbered position. Follow the arrows, including Yes / No branches and loop-back arrows.',task.x+18,task.y+285,task.w-36,14,'#b9d6ed',5);
        button('CHECK CHART',task.x+18,task.y+task.h-117,task.w-36,45,check);
        button('CLEAR BOARD',task.x+18,task.y+task.h-60,task.w-36,37,reset,'#8cc3f0');
      }else{
        button('CHECK CHART',task.x+task.w-220,task.y+18,200,42,check);
        button('CLEAR',task.x+task.w-125,task.y+76,105,32,reset,'#8cc3f0');
      }
      rect(board.x,board.y,board.w,board.h,12,'rgba(6,12,37,.87)','#78c8fb',2);
      ctx.save();ctx.beginPath();ctx.roundRect(board.x,board.y,board.w,board.h,12);ctx.clip();
      ctx.strokeStyle='rgba(129,174,229,.18)';ctx.lineWidth=1;
      for(let x=board.x;x<board.x+board.w;x+=38){ctx.beginPath();ctx.moveTo(x,board.y);ctx.lineTo(x,board.y+board.h);ctx.stroke();}
      for(let y=board.y;y<board.y+board.h;y+=38){ctx.beginPath();ctx.moveTo(board.x,y);ctx.lineTo(board.x+board.w,y);ctx.stroke();}
      puzzle.edges.forEach(arrow);
      for(const slot of slotBoxes){
        const piece=pieces.get(state.placements[slot.id]);
        const hover=state.drag&&inside(slot,state.drag.x,state.drag.y,true);
        if(!piece){ctx.setLineDash([5,5]);rect(slot.x-slot.w/2,slot.y-slot.h/2,slot.w,slot.h,8,hover?'#245a79':'#13233e',hover?'#fff188':'#698cb0',2);ctx.setLineDash([]);text('DROP BLOCK',slot.x,slot.y,11,'#96b9d8',700,'center');}
        else node(piece,slot.x,slot.y,slot.w,slot.h,state.drag?.piece===piece.id ? 0.25 : 1);
        if(state.bad.has(slot.id))rect(slot.x-slot.w/2-5,slot.y-slot.h/2-9,slot.w+10,slot.h+18,9,null,'#ff7795',3);
        text(slot.number,slot.x-slot.w/2-12,slot.y,11,'#93d3f8',800,'center');
        if(state.selected&&slot.id===slotBoxes[state.focus]?.id)rect(slot.x-slot.w/2-4,slot.y-slot.h/2-5,slot.w+8,slot.h+10,8,null,'#fff189',3);
      }
      ctx.restore();
      rect(tray.x,tray.y,tray.w,tray.h,12,'#111c3c','#8cc7f1',2);text('BLOCK TRAY · drag shapes onto the chart; drag placed shapes back here to remove them',tray.x+18,tray.y+20,13,'#bce7fa',800);
      const used=new Set(Object.values(state.placements));
      trayBoxes.forEach((box,index)=>{
        const taken=used.has(box.piece.id);node(box.piece,box.x+box.w/2,box.y+box.h/2,box.w-10,box.h-8,taken ? 0.13 : state.drag?.piece===box.piece.id ? 0.35 : 1);
        if(state.selected===box.piece.id)rect(box.x,box.y,box.w,box.h,8,null,'#fff4a8',3);
        if(!taken)text(index+1,box.x+4,box.y+8,10,'#bcdaf5',700);
      });
      if(state.drag)node(pieces.get(state.drag.piece),state.drag.x,state.drag.y,158,48,.92);
      if(state.feedback){rect(board.x,board.y+board.h+3,board.w,18,5,'rgba(5,15,32,.93)');text(state.feedback.slice(0,105),board.x+board.w/2,board.y+board.h+12,11,'#f3e3a5',700,'center');}
      if(state.paused){ctx.fillStyle='rgba(2,7,20,.72)';ctx.fillRect(0,0,W,H);rect(W/2-240,H/2-100,480,200,18,'#13223b','#ffe278',3);text('PAUSED',W/2,H/2-36,30,'#ffe278',900,'center');button('CONTINUE',W/2-110,H/2+15,220,52,()=>pause(false),'#82dcac');}
      if(state.finished){rect(board.x+40,board.y+140,board.w-80,130,15,'#183449','#ffe688',3);text(state.lives>0?'FLOWCHART COMPLETE':'TRY ANOTHER CHART',board.x+board.w/2,board.y+190,26,'#ffe688',900,'center');}
    }
    function inside(box,x,y,center=false){const left=center?box.x-box.w/2:box.x,top=center?box.y-box.h/2:box.y;return x>=left&&x<=left+box.w&&y>=top&&y<=top+box.h;}
    function point(event){const r=canvas.getBoundingClientRect();return {x:(event.clientX-r.left)*W/r.width,y:(event.clientY-r.top)*H/r.height};}
    function begin(){if(state.started)return;state.started=true;state.startTime=performance.now();state.last=state.startTime;post('game_started',{game_id:game.file_id,variation_id:game.variation_id});announce(puzzle.prompt);requestAnimationFrame(tick);}
    function place(pieceId,target){
      if(state.finished||state.paused||state.pending)return;
      begin();
      const origin=Object.keys(state.placements).find(id=>state.placements[id]===pieceId),old=state.placements[target.id];
      if(origin)delete state.placements[origin];
      if(old&&old!==pieceId&&origin)state.placements[origin]=old;
      state.placements[target.id]=pieceId;state.bad.clear();state.selected=null;sound('block_drop_sound');
      post('custom',{event_type:'flowchart_piece_placed',payload:{piece_id:pieceId,position:target.number,kind:pieces.get(pieceId).kind}});
      post('checkpoint_saved',{payload:{flowchart_placements:{...state.placements},scenario_id:puzzle.scenario_id}});
      announce(`Placed ${pieces.get(pieceId).label} in position ${target.number}.`);draw();
    }
    function reset(){if(state.finished||state.paused||state.pending)return;state.placements={};state.bad.clear();state.drag=null;state.selected=null;post('custom',{event_type:'flowchart_layout_reset',payload:{scenario_id:puzzle.scenario_id}});announce('Board cleared. Rebuild the requested procedure.');draw();}
    function check(){
      if(state.finished||state.paused||state.pending)return;
      begin();
      const result=globalThis.LogiCadeFlowchartModel.check(puzzle,state.placements);
      if(!result.complete){announce(`Place ${result.missing.length} more block${result.missing.length===1?'':'s'} before checking.`);draw();return;}
      state.checks++;state.tested+=result.totalCases;state.passed+=result.passedCases;state.errors+=result.totalCases-result.passedCases;
      for(const item of result.results)post('question_answered',{entity_id:`${puzzle.scenario_id}_${item.id}`,payload:{question_id:item.id,correct:item.passed,attempt_number:state.checks,answer_type:'flowchart_execution'}});
      post('custom',{event_type:'flowchart_checked',payload:{scenario_id:puzzle.scenario_id,passed_cases:result.passedCases,total_cases:result.totalCases,
        results:result.results.map(item=>({case_id:item.id,passed:item.passed,error:item.error,outputs:item.outputs}))}});
      state.bad=new Set(result.errors.map(item=>item.slot));
      if(result.passed){
        sound('success_sound');for(const slot of puzzle.slots)post('activity_completed',{entity_id:slot.id,payload:{kind:'flowchart_node',scenario_id:puzzle.scenario_id}});
        announce('All example inputs produce the required output. Your chart works!');state.pending=performance.now()+850;
      }else{
        state.lives--;sound('error_sound');
        if(!state.bad.size)for(const slot of puzzle.slots)if(state.placements[slot.id]!==puzzle.solution[slot.id])state.bad.add(slot.id);
        const detail=result.errors[0]?.message||result.results.find(item=>!item.passed)?.error||puzzle.feedback;
        announce(`${result.passedCases}/${result.totalCases} checks passed. ${detail}`);
        if(state.lives<=0)finish(false,'flowchart_checks_exhausted');
      }
      updateAccess();draw();
    }
    function finish(won,reason){if(state.finished)return;state.finished=true;state.paused=false;
      post('game_over',{won,score:won?100:Math.round(state.passed/Math.max(1,state.tested)*100),accuracy:state.passed/Math.max(1,state.tested),answered:state.tested,correct:state.passed,
        error_count:state.errors,hint_count:state.hints,duration_sec:state.elapsed,wall_duration_sec:(performance.now()-state.startTime)/1000,
        reason,formal_assessment:false,accuracy_basis:'flowchart_execution_cases'});announce(won?'Flowchart complete.':'The chart needs another attempt.');draw();}
    function pause(paused,request=false){if(state.finished)return;state.paused=paused;state.drag=null;state.last=performance.now();post(paused?'game_paused':'game_resumed');if(request&&paused)post('pause_request');draw();}
    canvas.addEventListener('pointerdown',event=>{
      begin();const p=point(event);const hit=[...buttons].reverse().find(box=>inside(box,p.x,p.y));
      if(hit){hit.action();event.preventDefault();return;}if(state.paused||state.finished||state.pending)return;
      const placed=slotBoxes.find(box=>inside(box,p.x,p.y,true)&&state.placements[box.id]);
      const tray=trayBoxes.find(box=>inside(box,p.x,p.y)&&!Object.values(state.placements).includes(box.piece.id));
      const piece=placed?state.placements[placed.id]:tray?.piece.id;
      if(piece){state.drag={piece,...p,origin:placed?.id};canvas.setPointerCapture(event.pointerId);event.preventDefault();draw();}
    });
    canvas.addEventListener('pointermove',event=>{if(!state.drag)return;Object.assign(state.drag,point(event));event.preventDefault();draw();});
    canvas.addEventListener('pointerup',event=>{
      if(!state.drag)return;const p=point(event),drag=state.drag;state.drag=null;
      const target=slotBoxes.find(box=>inside(box,p.x,p.y,true));
      if(target)place(drag.piece,target);
      else if(inside(layout.tray,p.x,p.y)&&drag.origin){delete state.placements[drag.origin];post('custom',{event_type:'flowchart_piece_removed',payload:{piece_id:drag.piece,slot_id:drag.origin}});announce('Block returned to the tray.');}
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);updateAccess();draw();
    });
    canvas.addEventListener('pointercancel',()=>{state.drag=null;draw();});
    window.addEventListener('keydown',event=>{
      if(event.target instanceof Element&&event.target.closest('button,input,select,textarea'))return;
      if(event.key==='Escape'){event.preventDefault();pause(!state.paused,true);return;}
      if(state.paused||state.finished||state.pending)return;
      if(event.key.toLowerCase()==='c'){event.preventDefault();check();return;}
      if(/^[1-9]$/.test(event.key)){const box=trayBoxes[Number(event.key)-1];if(box&&!Object.values(state.placements).includes(box.piece.id)){state.selected=box.piece.id;announce(`Selected ${box.piece.label}. Use arrows and Enter to place it.`);}}
      else if(event.key==='['||event.key===']'){const available=trayBoxes.filter(box=>!Object.values(state.placements).includes(box.piece.id));let i=available.findIndex(box=>box.piece.id===state.selected);i=(i+(event.key===']'?1:-1)+available.length)%available.length;state.selected=available[i]?.piece.id||null;}
      else if(event.key.startsWith('Arrow')){event.preventDefault();state.focus=(state.focus+(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)+slotBoxes.length)%slotBoxes.length;}
      else if((event.key==='Enter'||event.key===' ')&&state.selected){event.preventDefault();place(state.selected,slotBoxes[state.focus]);updateAccess();}
      else if(event.key==='Delete'){delete state.placements[slotBoxes[state.focus].id];updateAccess();}
      draw();
    });
    window.addEventListener('message',event=>{
      const m=event.data;if(m?.channel!=='logicade-host'||m.version!==1)return;
      if(m.type==='initialize')begin();else if(m.type==='pause')pause(true);else if(m.type==='resume')pause(false);
      else if(m.type==='hint'&&!state.finished){state.hints++;post('hint_used',{payload:{source:'host_oracle',scenario_id:puzzle.scenario_id}});announce(puzzle.feedback);draw();}
    });
    const accessible=document.createElement('section');accessible.className='sr-only';accessible.setAttribute('aria-label','Flowchart keyboard controls');document.querySelector('#game-shell').appendChild(accessible);
    function updateAccess(){accessible.replaceChildren();const instructions=document.createElement('p');instructions.textContent=puzzle.prompt;accessible.appendChild(instructions);
      for(const piece of puzzle.pieces){const b=document.createElement('button');b.textContent=`Select block: ${piece.label}`;b.disabled=Object.values(state.placements).includes(piece.id);b.onclick=()=>{state.selected=piece.id;announce(`Selected ${piece.label}.`);draw();};accessible.appendChild(b);}
      for(const slot of puzzle.slots){const b=document.createElement('button');b.textContent=`Place selected block in position ${slot.number}`;b.onclick=()=>{if(state.selected){place(state.selected,slotBoxes.find(box=>box.id===slot.id));updateAccess();}};accessible.appendChild(b);}
      const b=document.createElement('button');b.textContent='Check flowchart';b.onclick=check;accessible.appendChild(b);}
    function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.max(1,r.width*dpr);canvas.height=Math.max(1,r.height*dpr);draw();}
    function tick(now){if(state.finished)return;const dt=Math.min(.15,Math.max(0,(now-state.last)/1000));state.last=now;if(!state.paused)state.elapsed+=dt;if(state.pending&&now>=state.pending)finish(true,'flowchart_execution_passed');else draw();requestAnimationFrame(tick);}
    window.addEventListener('resize',resize);resize();updateAccess();
  }
  globalThis.LogiCadeFlowchart={start};
})();
