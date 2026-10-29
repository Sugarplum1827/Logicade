import { renderChallenge } from './challenges.js';
import { projectLearning, executionPlan, drawLearningWorld, WORLD_ACTIONS, MECHANIC_PLAY } from './learning-world.js';
import { loadWorldImages } from './world-render.js';
import { loadAssetPack, createSoundManager } from './visuals.js';
import { createBridge } from './bridge.js';

const root=document.getElementById('world-app');
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const button=(label,fn,cls='world-button')=>{const n=el('button',cls,label);n.type='button';n.addEventListener('click',fn);return n;};
const get=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`Could not load ${url}`);return r.json();};

async function main(){
  const bridge=createBridge();let pending=null;bridge.on('initialize',message=>{pending=message;});
  const params=new URLSearchParams(location.search),catalog=await get('../data/worlds.json');
  const entry=catalog.worlds.find(w=>w.slug===params.get('game'))||catalog.worlds[0];
  const index=Math.min(10,Math.max(1,Math.trunc(Number(params.get('lab')))||1)),lab=entry.labs[index-1];
  const bank=await get(`../data/cp1/challenges/${entry.topic}.json`),challenge=bank.find(c=>c.id===lab.challenge_id);
  if(!challenge)throw Error('The authored CP1 mission is missing.');
  const pack=await loadAssetPack(root).catch(()=>null),images=await loadWorldImages(pack,entry.assets),sound=createSoundManager({pack});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seed=Number.isFinite(pending?.seed)?pending.seed>>>0:lab.seed,view,model,execution=null,phase='ready',paused=false,reviewed=false,attempts=0,hints=0,lastTime=0,timer=0,frame=0;
  const state={started:false,finished:false,correct:0,answered:0,total:1,score:0};
  const emit=(type,extra={})=>bridge.send(type,{concept_id:entry.curriculum_id,variation_id:lab.challenge_id,game_id:entry.slug,track:'cp1-gameplay',mode:challenge.mechanic,theme:entry.genre,seed,...extra});
  document.title=`${entry.name} · ${entry.topic_name} · Mission ${index}`;
  const header=el('header','world-game-header'),back=el('a','world-back','← All worlds');back.href='../index.html';
  const title=el('div');title.append(el('p','world-eyebrow',`${entry.unit} · Week ${entry.week}${entry.week>8?' · Finals extension':''}`),el('h1','',entry.name));
  const top=el('div','world-top-actions');
  const mute=button(sound.muted?'Sound off':'Sound on',()=>{sound.toggle();mute.textContent=sound.muted?'Sound off':'Sound on';},'world-button subtle');
  const pause=button('Pause',()=>setPaused(!paused),'world-button subtle');top.append(mute,pause,button('Restart mission',restart,'world-button subtle'));header.append(back,title,top);root.append(header);
  const stage=el('main','learning-stage');
  const brief=el('header','learning-brief');brief.append(el('p','world-eyebrow',`MISSION ${String(index).padStart(2,'0')} / 10 · ${entry.topic_name}`),el('h2','',WORLD_ACTIONS[entry.genre][0]),el('p','',challenge.prompt),el('p','world-instruction',MECHANIC_PLAY[challenge.mechanic]));
  const canvas=el('canvas','world-canvas learning-canvas');canvas.width=960;canvas.height=360;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Live world state created by your programming actions');
  const context=canvas.getContext('2d');if(!context)throw Error('Canvas is unavailable in this browser.');
  const visual=el('section','learning-visual');visual.append(canvas);
  const shell=el('div','learning-workspace');const board=el('section','learning-board');board.setAttribute('aria-label','Game controls: build and run your program');
  const logPanel=el('aside','learning-log');const logTitle=el('h3','','World execution');const status=el('p','learning-status');status.setAttribute('role','status');const log=el('ol','learning-events');log.setAttribute('aria-label','Executed program operations');
  const meaning=el('p','world-help','Every object above comes from the code, connections, placements or values you choose. Change the controls and the world updates. Run your program to test it.');
  logPanel.append(logTitle,status,log,meaning);shell.append(board,logPanel);
  const controls=el('div','learning-actions');const runButton=button(WORLD_ACTIONS[entry.genre][1],run);
  const hintButton=button('Hint',hint,'world-button subtle');const resetButton=button('Rebuild',rebuild,'world-button subtle');
  const reviewButton=button('Demonstrate solution',review,'world-button subtle');controls.append(runButton,hintButton,resetButton,reviewButton);
  const finishPanel=el('section','learning-result');finishPanel.hidden=true;finishPanel.setAttribute('role','status');
  const nav=el('nav','world-chapter-links learning-chapters');nav.setAttribute('aria-label','Missions in this world');
  entry.labs.forEach((l,i)=>{const a=el('a',i===index-1?'current':'',String(i+1).padStart(2,'0'));a.href=`?game=${entry.slug}&lab=${i+1}`;a.title=l.title;nav.append(a);});
  stage.append(brief,visual,shell,controls,finishPanel,nav);root.append(stage);
  function lock(value){board.inert=value;runButton.disabled=value||reviewed;hintButton.disabled=value;reviewButton.disabled=value;}
  function sync(){if(!view)return;model=projectLearning(challenge,view.read());canvas.setAttribute('aria-label',`${model.summary} ${model.objects.map(o=>`${o.label}: ${o.value||'empty'}`).join('; ')}`);}
  function renderBoard(){view?.destroy?.();view=renderChallenge(challenge.mechanic,challenge.payload,{seed});board.replaceChildren(el('p','world-eyebrow',WORLD_ACTIONS[entry.genre][0]),el('p','learning-instruction',challenge.instruction),view.root);sync();}
  function start(){if(state.started)return;state.started=true;phase='building';bridge.reset();emit('game_started',{total:1,mechanic:challenge.mechanic});status.textContent='Build your program with the controls. Your choices immediately change the world.';lock(false);}
  function rebuild(){if(paused)return;if(state.finished){restart();return;}view.reset();reviewed=false;execution=null;timer=0;phase='building';state.finished=false;state.correct=0;finishPanel.hidden=true;log.replaceChildren();lock(false);sync();status.textContent='World rebuilt. Choose new instructions, values or connections.';if(!state.started)start();}
  function restart(){view?.destroy?.();Object.assign(state,{started:false,finished:false,correct:0,answered:0,score:0});attempts=0;hints=0;paused=false;reviewed=false;execution=null;pause.textContent='Pause';timer=0;bridge.reset();finishPanel.hidden=true;log.replaceChildren();renderBoard();lock(false);start();}
  function setPaused(value){if(state.finished)return;paused=Boolean(value);pause.textContent=paused?'Resume':'Pause';lock(paused||phase==='running'||phase==='demonstrating');resetButton.disabled=paused;status.textContent=paused?'Execution paused. Your program is preserved.':phase==='running'?'Executing your program…':'Edit the controls to change the world.';}
  function hint(){if(paused||phase==='running'||state.finished)return;hints++;const message=view.hint?.()||entry.learning_target;status.textContent=message;sync();emit('hint_used',{question_id:challenge.id,hint:message,hints});}
  function review(){if(paused||phase==='running'||state.finished)return;view.reveal();reviewed=true;sync();execution={status:'demonstration',events:executionPlan(model),index:-1,success:true};phase='demonstrating';timer=0;lock(true);status.textContent='Watch the reference program execute. Rebuild and run your own solution to complete the mission.';}
  function run(){
    if(paused||reviewed||state.finished||phase==='running'||phase==='demonstrating')return;
    sync();const success=Boolean(view.check());sync();const events=executionPlan(model);
    if(!success&&events.every(e=>e.ok))events.push({label:'The program has not reached its required final state.',ok:false});
    execution={status:'running',events,index:-1,success};phase='running';timer=0;log.replaceChildren();lock(true);state.answered++;
    status.textContent='Executing the instructions you built…';emit('program_executed',{question_id:challenge.id,mechanic:challenge.mechanic,submitted:view.read()});
  }
  function completeExecution(){
    const demonstrated=phase==='demonstrating';execution.status=demonstrated?'demonstrated':execution.success?'complete':'blocked';
    if(demonstrated){phase='building';lock(false);runButton.disabled=true;status.textContent=`${challenge.explanation} Rebuild to create and run your own solution.`;return;}
    emit('question_answered',{question_id:challenge.id,correct:execution.success,total:1,mechanic:challenge.mechanic});
    if(!execution.success){attempts++;phase='building';lock(false);status.textContent='The world stopped at the highlighted operation. Change your program and run it again.';sound.play('hurt');return;}
    state.finished=true;state.correct=1;state.score=Math.max(0,150+model.steps.length*10-attempts*5-hints*10);phase='finished';lock(true);
    try{const progress=JSON.parse(localStorage.getItem('logicade.cp1-worlds.v2')||'{}');progress[lab.challenge_id]={mastered:true,score:Math.max(state.score,progress[lab.challenge_id]?.score||0)};localStorage.setItem('logicade.cp1-worlds.v2',JSON.stringify(progress));}catch{/* Progress storage is optional. */}
    status.textContent='Your program achieved the mission.';finishPanel.hidden=false;
    const next=el('a','world-button',index<10?'Next mission →':'Choose another world →');next.href=index<10?`?game=${entry.slug}&lab=${index+1}`:'../index.html';
    finishPanel.replaceChildren(el('p','world-eyebrow','PROGRAM EXECUTED'),el('h2','',`${entry.name}: mission complete`),el('p','',challenge.explanation),el('p','',`${state.score} points · ${entry.topic_name}`),next);
    emit('activity_completed',{activity_id:lab.challenge_id,total:1,score:state.score,learning_is_gameplay:true});emit('game_over',{won:true,...state,hints,learning_is_gameplay:true});sound.play('goal');
  }
  for(const event of ['click','input','change'])board.addEventListener(event,()=>{
    if(paused||phase==='running'||phase==='demonstrating'||state.finished)return;
    sync();execution=null;log.replaceChildren();status.textContent=model.summary;
  });
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented)setPaused(!paused);});
  window.addEventListener('blur',()=>{if(phase==='running'||phase==='demonstrating')setPaused(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(phase==='running'||phase==='demonstrating'))setPaused(true);});
  bridge.on('pause',()=>setPaused(true));bridge.on('resume',()=>setPaused(false));bridge.on('hint',hint);
  bridge.on('initialize',message=>{if(Number.isFinite(message.seed)){seed=message.seed>>>0;restart();}});
  function loop(time){
    const dt=lastTime?Math.min(.1,(time-lastTime)/1000):0;lastTime=time;
    if(!paused){if(phase==='building')sync();if(phase==='running'||phase==='demonstrating'){
      timer+=dt;if(timer>=(reduced ? 0.08 : 0.45)){timer=0;execution.index++;
        if(execution.index>=execution.events.length){execution.index=execution.events.length-1;completeExecution();}
        else{const event=execution.events[execution.index];log.append(el('li',event.ok?'executed':'blocked',`${event.ok?'Executed':'Stopped'}: ${event.label}`));sound.play(event.ok?'coin':'hurt');}
      }
    }}
    drawLearningWorld(context,entry,model,execution,images,time/1000);frame=requestAnimationFrame(loop);
  }
  restart();frame=requestAnimationFrame(loop);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);view?.destroy?.();},{once:true});
  window.__logicade={entry,challenge,state,get view(){return view;},get model(){sync();return model;},get phase(){return phase;},get execution(){return execution;},get paused(){return paused;},get seed(){return seed;},start,restart,run,check:run,hint,setPaused,bridge};
  root.dataset.gameReady='true';window.dispatchEvent(new CustomEvent('logicade:ready',{detail:{concept:entry.name,total:1}}));
}
main().catch(error=>{console.error(error);root.replaceChildren(el('h1','','This mission could not load.'),el('p','',error.message));});
