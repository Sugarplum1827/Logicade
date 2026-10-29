(() => {
  'use strict';

  const setup = window.LOGICADE_CANVAS_GAME;
  const game = setup?.game;
  if(game?.programming){
    globalThis.LogiCadeProgramWorkbench.start(setup);
    return;
  }
  if(game?.flowchart){
    globalThis.LogiCadeFlowchart.start(setup);
    return;
  }
  const description = setup?.description || {};
  if(game?.mode!=='welcome_video')globalThis.LogiCadeLessonGuide?.mount(document.body,game?.lesson,true);
  const canvas = document.getElementById('game');
  const ctx = canvas?.getContext('2d');
  const live = document.getElementById('live-region');
  if (!canvas || !ctx || !game || !Array.isArray(game.tasks) || game.tasks.length === 0) {
    document.body.innerHTML = '<p style="padding:2rem;color:#fff;font:18px system-ui">This game package is missing its playable Canvas definition.</p>';
    return;
  }

  const W = 1200, H = 760, MODE = game.mode;
  const palette = {
    welcome_video:{ bg:'#000000', floor:'#000000', accent:'#ffffff', bright:'#ffffff', dark:'#000000', secondary:'#ffffff' },
    factory: { bg:'#18251f', floor:'#314236', accent:'#ffb12c', bright:'#e3f1b8', dark:'#101916', secondary:'#4dc69a' },
    terminal:{ bg:'#050b18', floor:'#0b1929', accent:'#42f59b', bright:'#c9ffe0', dark:'#020810', secondary:'#42d6ff' },
    circuit: { bg:'#06131c', floor:'#0a202a', accent:'#ffb347', bright:'#ddfff8', dark:'#041016', secondary:'#1df0c0' },
    pending: { bg:'#111725', floor:'#192337', accent:'#d8c793', bright:'#f1eee4', dark:'#0a101b', secondary:'#94a6bb' },
    dungeon: { bg:'#171b2d', floor:'#262c3e', accent:'#e7b34f', bright:'#fff0c4', dark:'#111421', secondary:'#58d5ce' },
  }[MODE] || { bg:'#101827', floor:'#182538', accent:'#ffc83d', bright:'#fff5cf', dark:'#0b1220', secondary:'#62ddeb' };
  const assetPaths = game.assets || {};
  const images = {};
  const sounds = {};
  for (const [key, source] of Object.entries(assetPaths)) {
    if (typeof source === 'string' && /\.(png|webp|jpe?g)(\?|$)/i.test(source)) {
      const image = new Image(); image.decoding = 'async'; image.src = source; images[key] = image;
    } else if (typeof source === 'string' && /\.(ogg|mp3|wav)(\?|$)/i.test(source)) {
      sounds[key] = source;
    }
  }

  const welcomeVideo = MODE === 'welcome_video' ? document.createElement('video') : null;
  if (welcomeVideo) {
    welcomeVideo.id = 'welcome-video-media';
    welcomeVideo.hidden = true;
    welcomeVideo.src = game.layout?.video_asset || assetPaths.welcome_video || '';
    welcomeVideo.preload = 'auto';
    welcomeVideo.playsInline = true;
    welcomeVideo.controls = false;
    welcomeVideo.disablePictureInPicture = true;
    welcomeVideo.setAttribute('aria-hidden', 'true');
    document.body.appendChild(welcomeVideo);
  }

  const state = {
    index:0, correct:0, answered:0, errors:0, hints:0, lives:game.starting_lives || 3,
    paused:false, finished:false, started:false, feedback:'', feedbackUntil:0,
    startedAt:0, lastFrame:0, elapsed:0, timeLeft:Number(game.time_limit_seconds || 0),
    eventCounter:0, hitTargets:[], animation:0,
    welcomeMuted:false,
  };
  const controls = [];
  const tileKeys = MODE === 'dungeon' ? ['dungeon_tile'] : MODE === 'factory' ? ['factory_tile'] : ['terminal_tile'];

  const post = (type, fields = {}) => {
    const message = { channel:'logicade-game', version:1, type, ...fields };
    if (type !== 'game_over') {
      message.event_id = `canvas-${game.file_id}-${++state.eventCounter}`;
      message.time_ms = Math.max(0, Math.round(performance.now() - state.startedAt));
    }
    window.parent.postMessage(message, '*');
  };
  const announce = (text) => { if (live) live.textContent = String(text || ''); };
  const play = (kind) => {
    const src = sounds[kind];
    if (!src) return;
    try { const audio = new Audio(src); audio.volume = 0.35; void audio.play().catch(() => {}); } catch { /* audio remains optional */ }
  };
  const roundRect = (x,y,w,h,r,fill,stroke=null,line=1) => {
    ctx.beginPath(); ctx.roundRect(x,y,w,h,r);
    if (fill) { ctx.fillStyle=fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth=line; ctx.strokeStyle=stroke; ctx.stroke(); }
  };
  const text = (value,x,y,size=18,color=palette.bright,weight=600,align='left',font='system-ui, Segoe UI, sans-serif',maxWidth=Infinity) => {
    ctx.font=`${weight} ${size}px ${font}`; ctx.fillStyle=color; ctx.textAlign=align; ctx.textBaseline='middle';
    if(Number.isFinite(maxWidth))ctx.fillText(String(value??''),x,y,maxWidth);else ctx.fillText(String(value??''),x,y);
  };
  const wrap = (value,x,y,maxWidth,lineHeight,size=21,color=palette.bright,weight=600,font='system-ui, Segoe UI, sans-serif',maxLines=3) => {
    ctx.font=`${weight} ${size}px ${font}`; ctx.fillStyle=color; ctx.textAlign='left'; ctx.textBaseline='top';
    const words=String(value||'').split(/\s+/), lines=[]; let line='';
    for (const word of words) { const next=line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width>maxWidth) { lines.push(line); line=word; } else line=next; }
    if (line) lines.push(line);
    const visible=lines.slice(0,maxLines);
    if (lines.length>maxLines) { let last=visible[maxLines-1]; while (last && ctx.measureText(`${last}…`).width>maxWidth) last=last.slice(0,-1); visible[maxLines-1]=`${last}…`; }
    visible.forEach((row,i)=>ctx.fillText(row,x,y+i*lineHeight));
    return visible.length;
  };
  const imageTile = (x,y,w,h,key,alpha=0.32) => {
    const img=images[key]; if (!img?.complete || !img.naturalWidth) return;
    ctx.save(); ctx.globalAlpha=alpha;
    const pattern=ctx.createPattern(img,'repeat'); if(pattern){ctx.fillStyle=pattern;ctx.fillRect(x,y,w,h);} ctx.restore();
  };
  const drawSprite = (x,y,w,h,key) => {
    const img=images[key];if(!img?.complete||!img.naturalWidth)return false;
    ctx.drawImage(img,x,y,w,h);return true;
  };
  const line = (x1,y1,x2,y2,color,width=3,dash=[]) => {
    ctx.save();ctx.beginPath();ctx.setLineDash(dash);ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();ctx.restore();
  };
  const circle = (x,y,r,fill,stroke=null,width=1) => {ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();}};

  function resize() {
    const rect=canvas.getBoundingClientRect(), dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
    canvas.width=Math.max(1,Math.round(rect.width*dpr)); canvas.height=Math.max(1,Math.round(rect.height*dpr));
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0); draw(performance.now());
  }
  function drawBackdrop(now) {
    ctx.fillStyle=palette.bg;ctx.fillRect(0,0,W,H);
    const top={x:24,y:82,w:1152,h:346};
    roundRect(top.x,top.y,top.w,top.h,18,palette.floor,'#42536a',2);
    imageTile(top.x+2,top.y+2,top.w-4,top.h-4,tileKeys[0],MODE==='factory'?0.22:0.13);
    ctx.save();ctx.beginPath();ctx.roundRect(top.x,top.y,top.w,top.h,18);ctx.clip();
    if (MODE==='factory') drawFactory(top,now);
    else if (MODE==='terminal') drawTerminal(top,now);
    else if (MODE==='circuit') drawCircuit(top,now);
    else if (MODE==='pending') drawPending(top,now);
    else drawDungeon(top,now);
    ctx.restore();
  }
  function drawPending(box) {
    roundRect(box.x+76,box.y+74,box.w-152,box.h-148,16,'#111c2a','#53647a',2);
    text('C HISTORY · CHARACTERISTICS · CLASSIFICATION',box.x+box.w/2,box.y+125,17,palette.secondary,800,'center','ui-monospace, monospace');
    text('C LANGUAGE ARCHIVE',box.x+box.w/2,box.y+187,32,palette.accent,900,'center','ui-monospace, monospace');
    text('Read the lesson and verify the historical and language facts.',box.x+box.w/2,box.y+246,15,palette.bright,600,'center','system-ui, sans-serif',900);
  }
  function drawWelcomeVideo() {
    ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
    if(!welcomeVideo||welcomeVideo.readyState<2)return;
    const vw=welcomeVideo.videoWidth||W,vh=welcomeVideo.videoHeight||H,scale=Math.max(W/vw,H/vh);
    const width=vw*scale,height=vh*scale;
    ctx.drawImage(welcomeVideo,(W-width)/2,(H-height)/2,width,height);
  }
  function drawFactory(box,now) {
    const y=box.y+105+((game.layout?.route_variant||0)%3)*19;
    // A moving, articulated conveyor with four stations is the factory game's core route.
    roundRect(box.x+56,y-22,box.w-112,48,13,'#111b20','#6e8179',2);
    for(let i=0;i<26;i++){
      const x=box.x+72+i*42+((now/90)%42);
      if(x>box.x+box.w-70)continue;
      line(x,y-8,x+13,y,palette.secondary,4);line(x+13,y,x,y+8,palette.secondary,4);
    }
    const stations=game.layout?.stations||[[1,4],[4,3],[7,3],[10,3],[12,4]];
    const points=[0,1,2,3].map(i=>({x:box.x+145+i*298,y:y+((i%2)?80:-77)}));
    points.forEach((p,i)=>{
      const done=i<state.index, active=i===state.index;
      line(p.x,y,p.x,p.y,done?palette.secondary:'#66716f',4,[7,6]);
      roundRect(p.x-62,p.y-39,124,78,12,done?'#164b3f':active?'#633d14':'#26352f',active?palette.accent:'#718078',3);
      // Kenney industrial panel texture is shared with the entire game set.
      if (i===0 || active) imageTile(p.x-55,p.y-32,110,64,'factory_tile',0.16);
      circle(p.x,p.y-8,14,done?'#51d1a2':active?palette.accent:'#9eafa4');
      text(done?'✓':`M${i+1}`,p.x,p.y-8,15,'#10211c',800,'center','ui-monospace, monospace');
      text(i<stations.length-1?`STATION ${i+1}`:'OUTPUT',p.x,p.y+20,11,palette.bright,700,'center','ui-monospace, monospace');
    });
    const bx=points[Math.min(state.index,3)].x, bob=Math.sin(now/220)*4;
    roundRect(bx-18,y-34+bob,36,28,5,'#f4ad31','#fff0bd',2);
    text('CP1',bx,y-20+bob,10,'#352310',800,'center','ui-monospace, monospace');
    text('CONVEYOR ROUTE',box.x+34,box.y+30,13,palette.secondary,800,'left','ui-monospace, monospace');
  }
  function drawTerminal(box,now) {
    const x=box.x+48,y=box.y+46,w=box.w-96,h=box.h-92;
    roundRect(x,y,w,h,12,'#020a12','#1e4751',2);
    ctx.fillStyle='#0f2630';ctx.fillRect(x,y,w,38);
    for(let i=0;i<3;i++)circle(x+20+i*18,y+19,5,['#ff6a67','#ffca58','#52d79e'][i]);
    text('CP1 SYSTEM TERMINAL  /  REGISTER TRACE',x+76,y+19,14,palette.secondary,700,'left','ui-monospace, monospace');
    const regs=game.layout?.registers||[4,8,2,16];
    for(let i=0;i<4;i++){
      const active=i===state.index, ry=y+65+i*58;
      roundRect(x+28,ry,w-56,43,7,active?'#123a2e':'#0b2026',active?palette.secondary:'#203a41',1.5);
      text(`R${i}`,x+50,ry+21,15,'#75c5ad',700,'left','ui-monospace, monospace');
      text(`0x${Number(regs[i]).toString(16).padStart(2,'0').toUpperCase()}`,x+128,ry+21,17,palette.bright,700,'left','ui-monospace, monospace');
      const bits=(Number(regs[i])||0).toString(2).padStart(8,'0');
      [...bits].forEach((bit,j)=>roundRect(x+240+j*48,ry+8,35,27,4,bit==='1'&&i<=state.index?'#187b57':'#16323a','#32615a',1));
      [...bits].forEach((bit,j)=>text(bit,x+257+j*48,ry+21,14,bit==='1'?palette.secondary:'#80949c',700,'center','ui-monospace, monospace'));
      text(i===state.index?'ACTIVE':'WAITING',x+w-148,ry+21,11,active?palette.accent:'#82959b',700,'left','ui-monospace, monospace');
    }
    const scan=(now/4)%(h-48);ctx.fillStyle='rgba(60,245,160,.07)';ctx.fillRect(x+2,y+40+scan,w-4,3);
    text('OUTPUT > '+(state.index>=4?'PROGRAM COMPLETE':'AWAITING VALID INSTRUCTION'),x+32,y+h-18,13,palette.secondary,700,'left','ui-monospace, monospace');
  }
  function drawCircuit(box,now) {
    ctx.save();ctx.strokeStyle='rgba(68,169,184,.18)';ctx.lineWidth=1;
    for(let x=box.x+24;x<box.x+box.w;x+=32){ctx.beginPath();ctx.moveTo(x,box.y);ctx.lineTo(x,box.y+box.h);ctx.stroke();}
    for(let y=box.y+18;y<box.y+box.h;y+=32){ctx.beginPath();ctx.moveTo(box.x,y);ctx.lineTo(box.x+box.w,y);ctx.stroke();}ctx.restore();
    const nodes=[box.x+140,box.x+440,box.x+740,box.x+1040], yy=[box.y+145,box.y+235,box.y+145,box.y+235];
    for(let i=0;i<3;i++){
      const active=i===state.index||state.index===3, done=i<state.index;
      line(nodes[i]+35,yy[i],nodes[i+1]-38,yy[i+1],done?palette.secondary:'#266773',9);
      const bend=(nodes[i]+nodes[i+1])/2;
      circle(bend,(yy[i]+yy[i+1])/2,10,done?palette.secondary:'#358891');
    }
    const gateLabels=game.layout?.gate_order||['INPUT','AND','XOR','OUTPUT'];
    nodes.forEach((x,i)=>{
      const active=i===state.index, done=i<state.index;
      roundRect(x-64,yy[i]-43,128,86,13,done?'#125845':active?'#4b3514':'#142937',active?palette.accent:done?palette.secondary:'#50717c',3);
      if(i===0||i===3){circle(x,yy[i],19,'#09202a',active?palette.accent:'#48adbd',3);text(gateLabels[i],x,yy[i]+34,11,palette.bright,700,'center','ui-monospace, monospace');}
      else{ text(gateLabels[i],x,yy[i],20,active?palette.accent:palette.bright,800,'center','ui-monospace, monospace'); }
      if(done)text('✓',x,yy[i]-53,18,palette.secondary,800,'center');
    });
    const pulse=(now/16)%1000/1000, px=nodes[0]+(nodes[3]-nodes[0])*pulse;
    circle(px,box.y+190+Math.sin(pulse*Math.PI*2)*22,8,'#f5e36b','#fffbd5',2);
    text('LOGIC GATE SIGNAL PATH',box.x+34,box.y+28,13,palette.secondary,800,'left','ui-monospace, monospace');
  }
  function drawDungeon(box,now) {
    const grid=game.layout?.grid||[], cols=grid[0]?.length||14, rows=grid.length||9;
    const cell=Math.min(52,Math.floor((box.w-140)/cols),Math.floor((box.h-76)/rows));
    const gx=box.x+(box.w-cols*cell)/2,gy=box.y+(box.h-rows*cell)/2;
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const tile=grid[row]?.[col]||'.', x=gx+col*cell,y=gy+row*cell;
      roundRect(x+1,y+1,cell-2,cell-2,4,tile==='#'?'#384256':'#202b39',tile==='#'?'#64718a':'#3e4b5c',1);
      if(tile==='#')imageTile(x+2,y+2,cell-4,cell-4,'dungeon_tile',0.12);
      if(tile==='!')text('✦',x+cell/2,y+cell/2,22,palette.accent,700,'center');
      if(tile==='G'){circle(x+cell/2,y+cell/2,cell*.28,'#e4b64f','#fff1b0',2);text('EXIT',x+cell/2,y+cell*.82,9,'#201b10',800,'center','ui-monospace, monospace');}
      if(tile==='S')text('START',x+cell/2,y+cell*.75,8,'#b5c7d0',800,'center','ui-monospace, monospace');
    }
    let sx=1,ex=cols-2;for(let i=0;i<rows;i++){const s=grid[i]?.indexOf('S');if(s>=0)sx=s;const e=grid[i]?.indexOf('G');if(e>=0)ex=e;}
    const routeY=4, progress=Math.min(1,state.index/Math.max(1,game.tasks.length));
    const hx=gx+(sx+(ex-sx)*progress)*cell+cell/2, hy=gy+routeY*cell+cell/2+Math.sin(now/160)*2;
    if(!drawSprite(hx-cell*.42,hy-cell*.56,cell*.84,cell*1.12,'hero_sprite')){
      circle(hx,hy,cell*.27,'#4dc7df','#e0fbff',3);text('◆',hx,hy,cell*.22,'#0f2437',800,'center');
    }
    text('CODE LABYRINTH  ·  SOLVE TO OPEN THE NEXT SEAL',box.x+34,box.y+25,12,palette.secondary,800,'left','ui-monospace, monospace');
  }

  function draw(now=performance.now()) {
    if(!ctx)return;
    controls.length=0;
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
    if(MODE==='welcome_video'){drawWelcomeVideo();return;}
    drawBackdrop(now);
    // Top status row
    text((description.title||game.title||'CP1 Challenge').toUpperCase(),32,34,16,palette.accent,800,'left','ui-monospace, monospace',470);
    text(`STAGE ${Math.min(state.index+1,game.tasks.length)} / ${game.tasks.length}`,640,34,14,palette.bright,700,'center','ui-monospace, monospace');
    const clockLabel=state.timeLeft>0?`TIME ${Math.ceil(state.timeLeft)}s`:`TIME ${Math.floor(state.elapsed/60).toString().padStart(2,'0')}:${Math.floor(state.elapsed%60).toString().padStart(2,'0')}`;
    text(clockLabel,900,34,14,state.timeLeft>0&&state.timeLeft<10?'#ff817b':palette.secondary,700,'center','ui-monospace, monospace');
    text(`♥ ${state.lives}`,1144,34,16,'#ff827b',800,'right','ui-monospace, monospace');
    const px=32,py=57,pw=1136,ph=8;
    roundRect(px,py,pw,ph,4,'#1d2c3c');roundRect(px,py,pw*(state.index/game.tasks.length),ph,4,palette.secondary);

    roundRect(24,448,1152,288,16,'#0b1421','#52647a',2);
    const task=game.tasks[Math.min(state.index,game.tasks.length-1)];
    text(`PROGRAMMING STATION ${Math.min(state.index+1,game.tasks.length)}`,48,475,12,palette.secondary,800,'left','ui-monospace, monospace');
    text(String(game.topic||description.topic||'CP1'),1152,475,12,'#b4c5d8',600,'right','ui-monospace, monospace',500);
    const lines=wrap(task.prompt,48,497,1088,27,22,palette.bright,700,'system-ui, Segoe UI, sans-serif',2);
    const options=task.choices||[];
    const top=lines>1?565:545;
    options.slice(0,4).forEach((answer,i)=>{
      const col=i%2,row=Math.floor(i/2),x=48+col*560,y=top+row*72,w=536,h=60;
      roundRect(x,y,w,h,9,'#17283d',state.finished?'#33445c':'#657d9e',2);
      roundRect(x+8,y+8,40,44,7,'#263e5a','#6883a5',1);
      text(String(i+1),x+28,y+30,16,palette.accent,800,'center','ui-monospace, monospace');
      wrap(answer,x+62,y+14,w-78,20,16,palette.bright,600,'system-ui, Segoe UI, sans-serif',2);
      controls.push({x,y,w,h,activate:()=>answerQuestion(i)});
    });
    if(state.feedback&&now<state.feedbackUntil) {
      roundRect(285,87,630,66,10,state.feedback.startsWith('Correct')?'#124d3c':'#5a2e25','#e3d7ab',1);
      wrap(state.feedback,305,101,590,20,14,palette.bright,700,'system-ui, Segoe UI, sans-serif',2);
    }
    if(state.paused&&!state.finished) {
      ctx.fillStyle='rgba(2,8,14,.74)';ctx.fillRect(0,0,W,H);
      roundRect(350,255,500,230,18,'#111c2b','#ffc13c',3);
      text('PAUSED',600,309,30,palette.accent,800,'center','ui-monospace, monospace');
      text('Press Escape or click to continue.',600,356,18,palette.bright,600,'center');
      roundRect(470,390,260,58,9,'#236b3b','#a5eea7',2);text('CONTINUE',600,419,17,'#fff',800,'center');
      controls.push({x:470,y:390,w:260,h:58,activate:resume});
    }
    if(state.finished) {
      ctx.fillStyle='rgba(2,8,14,.72)';ctx.fillRect(0,0,W,H);
      roundRect(315,250,570,260,18,'#111c2b',state.correct===game.tasks.length?'#f4c653':'#ef746f',3);
      text(state.correct===game.tasks.length?'CHALLENGE COMPLETE':'RUN ENDED',600,307,28,palette.accent,800,'center','ui-monospace, monospace');
      text(`${state.correct} / ${game.tasks.length} stations correct`,600,360,20,palette.bright,700,'center');
      text('Returning to LogiCade…',600,425,15,'#b6c6d8',600,'center');
    }
  }

  function answerQuestion(index) {
    if(state.paused||state.finished)return;
    const task=game.tasks[state.index];if(!task||index<0||index>=task.choices.length)return;
    const correct=index===Number(task.answer_index);
    state.answered++;if(!correct){state.errors++;state.lives--;}
    else state.correct++;
    post('question_answered',{entity_id:String(task.id||`station-${state.index+1}`),payload:{
      question_id:String(task.id||`station-${state.index+1}`),selected_index:index,correct,attempt_number:state.answered,
      topic:description.topic||game.topic||null,
    }});
    if(correct){
      play('success_sound');
      state.feedback='Correct — the signal advances.';state.feedbackUntil=performance.now()+1100;
      post('activity_completed',{entity_id:String(task.id||`station-${state.index+1}`),payload:{station:state.index+1,correct:true}});
      state.index++;
      post('checkpoint_saved',{payload:{stations_completed:state.index,stations_total:game.tasks.length}});
      announce(`Correct. Station ${state.index} completed.`);
      if(state.index>=game.tasks.length){finish(true,'all_stations_complete');return;}
    } else {
      play('error_sound');state.feedback=state.lives>0?'Not quite — check the trace and try again.':'No lives remain.';state.feedbackUntil=performance.now()+1400;
      announce(state.feedback);
      if(state.lives<=0){finish(false,'lives_exhausted');return;}
    }
    draw(performance.now());
  }
  function finish(won,reason) {
    if(state.finished)return;
    state.finished=true;state.paused=false;
    const duration=Math.max(0,(performance.now()-state.startedAt)/1000);
    const videoComplete=MODE==='welcome_video'&&won;
    post('game_over',{won,score:videoComplete?0:Math.round((state.correct/game.tasks.length)*100),accuracy:videoComplete?0:(state.answered?state.correct/state.answered:0),
      answered:videoComplete?0:state.answered,correct:videoComplete?0:state.correct,error_count:state.errors,hint_count:state.hints,
      duration_sec:duration,reason,formal_assessment:false,accuracy_basis:videoComplete?'orientation_completion':'in_game_questions'});
    announce(won?'Challenge complete.':'The run ended.');draw(performance.now());
  }
  function resume(){if(state.finished)return;state.paused=false;state.lastFrame=performance.now();post('game_resumed');draw(state.lastFrame);}
  function pause(){if(state.finished||state.paused)return;state.paused=true;post('game_paused');draw(performance.now());}
  function useHint(hint) {
    if(state.finished||MODE==='welcome_video')return;
    state.hints++;post('hint_used',{entity_id:String(game.tasks[state.index]?.id||''),payload:{station:state.index+1,source:'host_oracle'}});
    state.feedback=String(hint||description.hint||game.hint||'Look for the programming rule that changes the value or route.');
    state.feedbackUntil=performance.now()+6500;announce(state.feedback);draw(performance.now());
  }

  function beginSession() {
    if(state.started)return;
    state.started=true;state.startedAt=performance.now();state.lastFrame=state.startedAt;
    post('game_started',{game_id:game.file_id,variation_id:game.variation_id,seed:game.seed});
    announce(MODE==='welcome_video'?'Welcome video. Click the screen to enable sound if needed.':`Game started. ${game.tasks[0].prompt}`);
    if(MODE==='welcome_video')startWelcomePlayback();
    requestAnimationFrame(tick);
  }
  function startWelcomePlayback() {
    if(!welcomeVideo||state.finished)return;
    const attempt=welcomeVideo.play();
    if(attempt&&typeof attempt.catch==='function')attempt.catch(()=>{
      // Browsers can reject sound autoplay inside a cross-document game frame.
      // Play silently until the learner's first click grants audio permission.
      welcomeVideo.muted=true;state.welcomeMuted=true;
      const silent=welcomeVideo.play();if(silent&&typeof silent.catch==='function')silent.catch(()=>{});
      announce('The prologue is ready. Click the screen to enable its audio.');
    });
  }
  if(welcomeVideo)welcomeVideo.addEventListener('ended',()=>finish(true,'welcome_video_completed'));

  window.addEventListener('message',(event)=>{
    const message=event.data;
    if(!message||message.channel!=='logicade-host'||message.version!==1)return;
    if(message.type==='initialize'&&!state.started){beginSession();}
    else if(message.type==='pause'&&MODE!=='welcome_video') {state.paused=true;draw(performance.now());}
    else if(message.type==='resume') resume();
    else if(message.type==='hint')useHint(message.hint);
  });
  function tick(now){
    if(!state.started||state.finished)return;
    const delta=Math.min(.1,Math.max(0,(now-state.lastFrame)/1000));state.lastFrame=now;
    if(!state.paused){
      state.elapsed+=delta;state.animation+=delta*60;
      if(MODE!=='welcome_video'&&state.timeLeft>0){state.timeLeft-=delta;if(state.timeLeft<=0){state.timeLeft=0;finish(false,'time_limit');return;}}
      draw(now);
    }
    requestAnimationFrame(tick);
  }
  canvas.addEventListener('pointerdown',(event)=>{
    if(!state.started)beginSession();
    if(MODE==='welcome_video'){
      if(state.welcomeMuted){welcomeVideo.muted=false;state.welcomeMuted=false;announce('Prologue audio enabled.');}
      else startWelcomePlayback();
      event.preventDefault();return;
    }
    const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*W/rect.width,y=(event.clientY-rect.top)*H/rect.height;
    const target=[...controls].reverse().find(item=>x>=item.x&&x<=item.x+item.w&&y>=item.y&&y<=item.y+item.h);
    if(target){event.preventDefault();target.activate();}
    else if(state.paused)resume();
  });
  window.addEventListener('keydown',(event)=>{
    if(event.key==='Escape'){if(MODE==='welcome_video')return;event.preventDefault();if(state.paused)resume();else {pause();post('pause_request');}return;}
    if(state.paused||state.finished)return;
    if(/^[1-4]$/.test(event.key)){event.preventDefault();answerQuestion(Number(event.key)-1);}
  });
  window.addEventListener('resize',resize);
  resize();
})();
