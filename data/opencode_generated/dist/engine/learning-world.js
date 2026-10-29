// Project learner-authored state into the world. No arcade timer, movement keys,
// collectibles, or unrelated objective can advance these missions.
import { PALETTES } from './world-profiles.js';

export const WORLD_ACTIONS = {
  platform:['Build the crossing','Run the crossing','platform'],
  explore:['Build the expedition','Run the expedition','landmark'],
  defense:['Program the defenders','Run the defense','tower'],
  garden:['Program the garden','Apply garden state','plot'],
  stealth:['Plan the shadow route','Run the route','shadow gate'],
  tactics:['Program the squad','Execute the orders','unit'],
  shooter:['Program the starfighter','Run flight commands','drone'],
  route:['Connect the system','Run the system','junction'],
  production:['Program the production line','Run the line','station'],
  strategy:['Build the council rules','Apply the policy','district'],
  rhythm:['Build the command sequence','Play the sequence','beat'],
  pong:['Program the rally','Run the rally','relay'],
  pixel:['Program the restoration','Render the program','pixel group'],
};
export const MECHANIC_PLAY = {
  order:'Arrange the operations to build the route. Running it executes your sequence in order and stops at the first misplaced operation.',
  assemble:'Build the control statement from tokens. Your tokens construct the machine; run it to find the first broken part.',
  flow:'Connect source and destination nodes. Your connections are the world’s routes. Missing or incorrect links leave the network incomplete.',
  vars:'Place values into named variables. Each assignment changes the corresponding world object and its displayed state.',
  sort:'Route each item into its correct district or station. Your classifications determine where the world sends each item.',
  bug:'Select the faulty instruction to disable it. The selected component goes offline; run the system to test whether you isolated the fault.',
  scope:'Place declarations and references into their scope zones. The zones you choose become the objects’ locations in the world.',
  robot:'Build a movement program. Each command turns or moves the actor in the grid; a blocked command stops the route.',
  match:'Connect related objects. Each correct pair activates a link in the world’s system.',
  repair:'Fill the missing code to rebuild the machine. The inserted tokens become working components when the program runs.',
  trace:'Read the program and set its output signal. The signal you enter is displayed on the world beacon; run it to test the predicted output.',
  simulate:'Step through the authored program. The world updates with each variable state. Commit the final values to complete the run.',
};
const tokenText=(bank,id)=>bank?.find(t=>t.id===id)?.text??'';
const normalized=value=>String(value??'').trim().replace(/\s+/g,' ').toLowerCase();
const point=(id,label,value,extra={})=>({id,label:String(label??''),value:String(value??''),...extra});

export function projectLearning(challenge,snapshot={}) {
  const p=challenge.payload,kind=challenge.mechanic;
  const model={kind,objects:[],links:[],steps:[],grid:null,code:p.code||p.lines||[],summary:''};
  if(kind==='order'||kind==='assemble'){
    const bank=kind==='order'?p.items:p.bank,ids=(kind==='order'?snapshot.placed:snapshot.tokens)||[];
    model.objects=p.answer.map((_,i)=>point(i,`${i+1}`,tokenText(bank,ids[i]),{filled:ids[i]!=null}));
    model.steps=model.objects.map((o,i)=>({label:o.value||'Missing operation',ok:o.filled&&o.value===tokenText(bank,p.answer[i]),object:i}));
    model.summary=kind==='order'?'Your route executes from left to right.':'Your assembled statement is the control program.';
  } else if(kind==='flow'){
    model.objects=p.nodes.map(n=>point(n.id,n.kind,n.label,{x:n.x,y:n.y,filled:true}));
    model.links=(snapshot.edges||[]).map(([from,to])=>({from,to}));
    model.steps=model.links.map(e=>({label:`${p.nodes.find(n=>n.id===e.from)?.label} → ${p.nodes.find(n=>n.id===e.to)?.label}`,ok:p.edges.some(([a,b])=>a===e.from&&b===e.to),object:e.to}));
    const missing=p.edges.filter(([a,b])=>!model.links.some(e=>e.from===a&&e.to===b));
    if(missing.length)model.steps.push({label:`${missing.length} required connection(s) are missing.`,ok:false});
    model.summary=`${model.links.length} routes built from your connections.`;
  } else if(kind==='vars'){
    model.objects=p.variables.map(v=>point(v.name,v.name,tokenText(p.bank,snapshot.values?.[v.name]),{filled:!!snapshot.values?.[v.name],numeric:Number(tokenText(p.bank,snapshot.values?.[v.name]))}));
    model.steps=model.objects.map(o=>({label:`${o.label} ← ${o.value||'unassigned'}`,ok:o.filled&&o.value===tokenText(p.bank,p.answer[o.id]),object:o.id}));
    model.summary='World resources now hold the values you assigned.';
  } else if(kind==='sort'||kind==='scope'){
    const zones=kind==='sort'?p.bins:p.scopes,field=kind==='sort'?'bin':'scope';
    model.zones=zones.map(z=>({id:z.id,label:z.label}));
    model.objects=p.items.map(item=>point(item.id,item.text,zones.find(z=>z.id===snapshot.placements?.[item.id])?.label||'Unplaced',{zone:snapshot.placements?.[item.id],filled:!!snapshot.placements?.[item.id]}));
    model.steps=model.objects.map(o=>({label:`${o.label} → ${o.value}`,ok:o.zone===p.items.find(i=>i.id===o.id)[field],object:o.id}));
    model.summary='Your placements determine each object’s destination.';
  } else if(kind==='bug'){
    model.objects=p.lines.map((line,i)=>point(i,`Line ${i+1}`,line,{filled:true,disabled:snapshot.selected===i}));
    model.steps=[{label:snapshot.selected==null?'Choose a faulty component.':`Disable line ${snapshot.selected+1}: ${p.lines[snapshot.selected]}`,ok:snapshot.selected===p.answer,object:snapshot.selected}];
    model.summary=snapshot.selected==null?'All components are active. Select the faulty instruction.':`Component ${snapshot.selected+1} is disabled by your selection.`;
  } else if(kind==='robot'){
    model.grid={cols:p.cols,rows:p.rows,walls:p.walls,start:p.start,goal:p.goal};
    const trail=snapshot.simulation?.path||[p.start];
    model.objects=trail.map((position,i)=>point(i,i===0?'Start':snapshot.program?.[i-1],`${position.x}, ${position.y}`,{...position,filled:true}));
    model.steps=model.objects.slice(1).map(o=>({label:`${o.label}: (${o.x}, ${o.y})`,ok:!o.blocked,object:o.id}));
    const end=trail.at(-1);if(end.x!==p.goal.x||end.y!==p.goal.y)model.steps.push({label:'The program stopped before reaching the goal.',ok:false,object:trail.length-1});
    model.summary=`${snapshot.program?.length||0} commands. Position and facing come from your program.`;
  } else if(kind==='match'){
    model.objects=p.left.map(item=>{const pair=snapshot.pairs?.find(([id])=>id===item.id);return point(item.id,item.text,p.right.find(r=>r.id===pair?.[1])?.text||'Not connected',{filled:!!pair});});
    model.steps=model.objects.map(o=>({label:`${o.label} → ${o.value}`,ok:o.filled,object:o.id}));
    model.summary='Matched objects activate connected parts of the world.';
  } else if(kind==='repair'){
    model.objects=p.blanks.map(b=>point(b.id,b.label||b.id,tokenText(p.bank,snapshot.values?.[b.id]),{filled:!!snapshot.values?.[b.id]}));
    model.code=p.lines.map(line=>line.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g,(_,id)=>tokenText(p.bank,snapshot.values?.[id])||'____'));
    model.steps=model.objects.map(o=>({label:`${o.label} ← ${o.value||'missing component'}`,ok:o.filled&&o.value===tokenText(p.bank,p.blanks.find(b=>b.id===o.id).answer),object:o.id}));
    model.summary='The machine contains the exact replacement tokens you installed.';
  } else if(kind==='trace'){
    model.objects=[point('output','Your output signal',snapshot.value||'No signal',{filled:!!String(snapshot.value||'').trim()})];
    const accepts=[p.answer,...p.accept||[]].map(normalized);
    const value=String(snapshot.value??'').trim().replace(/^["']|["']$/g,'');
    const numeric=p.numeric&&value!==''&&Number.isFinite(Number(value))&&Math.abs(Number(value)-Number(String(p.answer).trim().replace(/^["']|["']$/g,'')))<1e-6;
    model.steps=[{label:`Output signal: ${snapshot.value||'unset'}`,ok:p.numeric?Boolean(numeric):accepts.includes(normalized(snapshot.value)),object:'output'}];
    model.summary='This beacon displays your prediction of the authored program’s output.';
  } else if(kind==='simulate'){
    model.objects=p.variables.map(name=>point(name,name,snapshot.machine?.[name]??'—',{filled:snapshot.machine?.[name]!=null,numeric:Number(snapshot.machine?.[name]),submitted:snapshot.inputs?.[name]}));
    model.steps=p.ask.map(name=>({label:`Commit ${name} = ${snapshot.inputs?.[name]??'unset'}`,ok:normalized(snapshot.inputs?.[name])===normalized(p.answer[name]),object:name}));
    model.summary=`Execution step ${snapshot.step||0}/${p.steps.length}. The world displays the current authored variable state.`;
    model.activeLine=p.steps[Math.min(snapshot.step||0,p.steps.length-1)]?.line;
  }
  return model;
}

export function executionPlan(model){
  const events=[];
  for(const step of model.steps){events.push({...step});if(!step.ok)break;}
  return events.length?events:[{label:'Build the program before running the world.',ok:false}];
}

export function drawLearningWorld(ctx,entry,model,execution,images={},time=0){
  const [ink,ground,mint,gold]=PALETTES[entry.mood]||PALETTES.bright;
  const W=960,H=360;
  const box=(x,y,w,h,color,r=8)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
  const text=(t,x,y,size=14,color='#eef6ec',align='left')=>{ctx.fillStyle=color;ctx.font=`${size>18?'700':'500'} ${size}px system-ui`;ctx.textAlign=align;ctx.fillText(String(t),x,y);};
  const line=(a,b,color,width=3)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
  const wrap=(s,x,y,width,size=12,max=3)=>{const words=String(s).split(/\s+/);let row='',n=0;for(const word of words){if((row+word).length>width/size*1.8&&row){text(row,x,y+n*16,size);row='';if(++n>=max)return;}row+=(row?' ':'')+word;}if(row&&n<max)text(row,x,y+n*16,size);};
  ctx.clearRect(0,0,W,H);const gradient=ctx.createLinearGradient(0,0,0,H);gradient.addColorStop(0,ink);gradient.addColorStop(1,ground);ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
  if(images.bg){ctx.globalAlpha=.14;ctx.drawImage(images.bg,0,0,W,H);ctx.globalAlpha=1;}
  box(20,16,920,38,'#061820c9');text(WORLD_ACTIONS[entry.genre][0].toUpperCase(),36,41,12,mint);text('YOUR PROGRAM → YOUR WORLD',924,41,11,mint,'right');
  const active=execution?.events?.[execution.index],shown=new Map((execution?.events||[]).slice(0,(execution?.index??-1)+1).map(e=>[e.object,e.ok]));
  const positions=new Map();
  if(model.grid){
    const cell=Math.min(52,240/model.grid.rows),ox=(960-model.grid.cols*cell)/2,oy=67;
    for(let y=0;y<model.grid.rows;y++)for(let x=0;x<model.grid.cols;x++){const wall=model.grid.walls.some(p=>p.x===x&&p.y===y);box(ox+x*cell+2,oy+y*cell+2,cell-4,cell-4,wall?ground:'#071b2baa',5);}
    const goal=model.grid.goal;box(ox+goal.x*cell+8,oy+goal.y*cell+8,cell-16,cell-16,gold,5);
    model.objects.forEach((o,i)=>{const pos={x:ox+(o.x+.5)*cell,y:oy+(o.y+.5)*cell};positions.set(o.id,pos);if(i)line(positions.get(i-1),pos,mint+'77',4);});
    const robot=model.objects[execution?.status==='running'?Math.min((execution.index||0)+1,model.objects.length-1):model.objects.length-1];
    if(robot){const pos=positions.get(robot.id);box(pos.x-12,pos.y-12,24,24,mint,5);text(['↑','→','↓','←'][robot.dir],pos.x,pos.y+6,18,ink,'center');}
  } else if(model.kind==='flow'){
    model.objects.forEach(o=>positions.set(o.id,{x:80+o.x*8,y:75+o.y*2.05}));
    model.links.forEach(l=>{const a=positions.get(l.from),b=positions.get(l.to);if(!a||!b)return;line(a,b,gold,4);const angle=Math.atan2(b.y-a.y,b.x-a.x);line(b,{x:b.x-Math.cos(angle-.4)*13,y:b.y-Math.sin(angle-.4)*13},gold,3);line(b,{x:b.x-Math.cos(angle+.4)*13,y:b.y-Math.sin(angle+.4)*13},gold,3);});
    model.objects.forEach(o=>{const pos=positions.get(o.id);box(pos.x-62,pos.y-23,124,46,shown.get(o.id)===false?'#8a4149':'#102d3deb');wrap(o.value,pos.x-54,pos.y-4,105,10,2);});
  } else if(model.zones){
    const zones=[...model.zones,{id:undefined,label:'Unplaced'}],width=880/zones.length;
    zones.forEach((zone,i)=>{const x=40+i*width;box(x,72,width-12,225,'#061820a9');text(zone.label,x+12,94,12,mint);
      model.objects.filter(o=>o.zone===zone.id).forEach((o,j)=>{const y=110+j*32;box(x+10,y,width-32,28,shown.get(o.id)===false?'#8a4149':'#37535b');wrap(o.label,x+17,y+18,width-50,10,1);positions.set(o.id,{x:x+width/2,y:y+14});});});
  } else {
    const count=Math.max(1,model.objects.length),cols=Math.min(count,6),width=880/cols,rows=Math.ceil(count/cols),height=Math.min(112,220/rows);
    model.objects.forEach((o,i)=>{const x=40+(i%cols)*width,y=78+Math.floor(i/cols)*height;positions.set(o.id,{x:x+width/2-7,y:y+height/2});
      const color=shown.get(o.id)===false?'#8a4149':shown.get(o.id)===true?'#3f7667':o.disabled?'#533445':o.filled?'#2d515d':'#142b38';
      if(entry.genre==='platform'){box(x,y+height-18,width-15,12,o.filled?mint:'#47616a',3);}
      box(x,y,width-15,height-22,color,10);
      text(o.label,x+10,y+18,10,mint);wrap(o.value||'Empty',x+10,y+39,width-35,11,rows>1?2:3);
      if(['vars','simulate'].includes(model.kind)&&Number.isFinite(o.numeric)){
        const amount=Math.min(1,Math.abs(o.numeric)/20);box(x,y+height-15,width-15,5,'#122b36',2);box(x,y+height-15,(width-15)*amount,5,gold,2);
        if(entry.genre==='garden'){line({x:x+width-30,y:y+height-25},{x:x+width-30,y:y+height-25-amount*35},mint,5);}
      }
      if(model.kind==='simulate'&&o.submitted!=null)text(`commit: ${o.submitted}`,x+10,y+height-28,10,gold);
    });
    if(['order','assemble','repair'].includes(model.kind))for(let i=1;i<model.objects.length;i++){const a=positions.get(i-1),b=positions.get(i);if(a&&b&&a.y===b.y)line({x:a.x+width/2-15,y:a.y},{x:b.x-width/2+6,y:b.y},mint+'88',2);}
  }
  // The actor travels only along the executed program, never from elapsed play time.
  if(active&&positions.has(active.object)&&model.kind!=='robot'){
    const pos=positions.get(active.object);ctx.strokeStyle=active.ok?gold:'#ff9a9a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(pos.x,pos.y,20,0,Math.PI*2);ctx.stroke();
    if(active.ok&&['platform','explore','stealth','tactics'].includes(entry.genre)){
      const actor=images.hero||images.player;if(actor){ctx.imageSmoothingEnabled=false;ctx.drawImage(actor,pos.x-14,Math.max(60,pos.y-60),28,34);}
    }
    if(active.ok&&['defense','shooter'].includes(entry.genre)){line({x:pos.x,y:pos.y-30},{x:pos.x,y:63},gold,4);box(pos.x-8,60,16,8,mint,3);}
  }
  box(20,318,920,28,'#061820dd');text(active?`${active.ok?'EXECUTE':'STOP'} · ${String(active.label).slice(0,105)}`:model.summary.slice(0,120),35,337,11,active?.ok===false?'#ffb2ac':mint);
}
