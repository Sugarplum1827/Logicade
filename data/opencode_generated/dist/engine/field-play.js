import {newFarm,restoreFarm,serializeFarm,beginAction,stepFarm,ready,STATIONS} from './field-state.js';
import {fieldProgram} from './field-program.js';
import {FIELD_MISSIONS,updateMissions} from './field-missions.js';
import {drawFarm} from './field-render.js';
const $=id=>document.getElementById(id),KEY='logicade.field.v1';
let farm=newFarm(),run=null,paused=false,hover=null,last=performance.now(),uiTime=0,saveTime=0,saveOK=true;
try{farm=restoreFarm(JSON.parse(localStorage.getItem(KEY)));}catch{saveOK=false;}
const canvas=$('farm'),ctx=canvas.getContext('2d');
FIELD_MISSIONS.forEach((m,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${i+1}. ${m.name}`;$('mission').append(o);});
farm.mission=Math.max(0,Math.min(9,Number(farm.mission)||0));
function mission(){const m=FIELD_MISSIONS[farm.mission];$('mission').value=farm.mission;$('mission-title').textContent=m.topic;$('brief').textContent=m.brief;$('guide').textContent=m.guide;}
mission();$('code').value=FIELD_MISSIONS[farm.mission].starter;try{$('code').value=localStorage.getItem(KEY+'.code')||$('code').value;}catch{}
$('tool').value=farm.tool;$('seed').value=farm.selectedSeed;
function save(){try{localStorage.setItem(KEY,JSON.stringify(serializeFarm(farm)));localStorage.setItem(KEY+'.code',$('code').value);saveOK=true;}catch{saveOK=false;}$('save-state').textContent=saveOK?'Saved on this device':'Saving unavailable';}
function manual(name,args=[]){if(paused){farm.message='Resume the farm to work.';return;}const result=beginAction(farm,'player',name,args);if(!result.ok)farm.message=result.message;}
function work(row,col){const p=farm.plots.find(p=>p.row===row&&p.col===col);let tool=farm.tool;if(tool==='auto')tool=!p.crop?'plant':ready(p)?'harvest':'water';manual(['sprinkler','scarecrow'].includes(tool)?'place':tool,['sprinkler','scarecrow'].includes(tool)?[tool,row,col]:[row,col]);}
$('work').onclick=()=>work(Number($('row').value),Number($('col').value));
$('tool').onchange=()=>{farm.tool=$('tool').value;};$('seed').onchange=()=>{farm.selectedSeed=$('seed').value;};
document.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>{const name=button.dataset.action;manual(name,button.dataset.item?[button.dataset.item]:name==='buy'?[farm.selectedSeed,5]:name==='sell'?[farm.selectedSeed,1]:[]);});
function tile(event){const rect=canvas.getBoundingClientRect();return{x:Math.floor((event.clientX-rect.left)/rect.width*24),y:Math.floor((event.clientY-rect.top)/rect.height*16)};}
canvas.onpointermove=e=>{hover=tile(e);};canvas.onpointerleave=()=>{hover=null;};
canvas.onclick=e=>{canvas.focus();const t=tile(e),plot=farm.plots.find(p=>p.x===t.x&&p.y===t.y),resource=farm.resources.find(r=>r.x===t.x&&r.y===t.y);if(plot){$('row').value=plot.row;$('col').value=plot.col;work(plot.row,plot.col);return;}if(resource){manual('gather',[resource.type]);return;}for(const [name,p]of Object.entries(STATIONS))if(Math.abs(t.x-p.x)+Math.abs(t.y-p.y)<=1){if(name==='well')manual('refill');else if(name==='house')manual('rest');else if(name==='neighbor')manual('deliver');else farm.message=name==='bench'?'Choose a recipe below the map.':'Use Buy seeds or Sell crop below the map.';return;}manual('move',[t.x,t.y]);};
canvas.onkeydown=e=>{const dir={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]}[e.key];if(dir){e.preventDefault();if(!farm.player.task)manual('move',[Math.round(farm.player.x)+dir[0],Math.round(farm.player.y)+dir[1]]);}};
$('mission').onchange=()=>{farm.mission=Number($('mission').value);mission();save();};
$('starter').onclick=()=>{if(run?.status==='running')return;$('code').value=FIELD_MISSIONS[farm.mission].starter;save();};
$('code').onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();const a=e.target.selectionStart,b=e.target.selectionEnd;e.target.setRangeText('    ',a,b,'end');}};
$('run').onclick=()=>{if(run?.status==='running'||paused)return;try{run=fieldProgram(farm,$('code').value);run.tick([]);}catch(error){run=null;$('run-state').textContent=error.message;farm.message=error.message;}save();};
$('stop').onclick=()=>{run?.stop();save();};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume farm':'Pause farm';};
function refresh(){
  $('hud').innerHTML=`<span><strong>${farm.day}</strong>Day</span><span><strong>${farm.coins}</strong>Coins</span><span><strong>${farm.water}/6</strong>Water</span><span><strong>${farm.energy}</strong>Energy</span><span><strong>${farm.orders.friendship}</strong>Friendship</span>`;
  $('inventory').replaceChildren(...Object.entries(farm.inventory).map(([key,value])=>{const span=document.createElement('span');span.textContent=`${key.replace('Seeds',' seeds')}: ${value}`;return span;}));
  $('message').textContent=farm.message;$('progress').textContent=`${farm.completed.length} / 10 COMPLETE`;
  [...$('mission').options].forEach((o,i)=>o.textContent=`${farm.completed.includes(i)?'✓ ':''}${i+1}. ${FIELD_MISSIONS[i].name}`);
  const running=run?.status==='running';$('run').disabled=running||paused;$('stop').disabled=!running;$('starter').disabled=running;$('code').readOnly=running;
  if(run){$('run-state').textContent=running?`${paused?'Farm paused':'Helper running'} · line ${run.line}${run.pending?' · '+run.pending.name:''}`:run.message;$('variables').textContent=JSON.stringify(run.vm.variables,null,2);}
  $('log').replaceChildren(...farm.ledger.slice(-10).reverse().map(item=>{const li=document.createElement('li');li.textContent=`${item.actor}: ${item.message}`;return li;}));
}
function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(!paused&&!document.hidden){const results=stepFarm(farm,dt);run?.tick(results);const earned=updateMissions(farm);if(earned.length)farm.message=`Mission complete: ${earned.map(i=>FIELD_MISSIONS[i].name).join(', ')}. Choose your next field note.`;saveTime+=dt;}drawFarm(ctx,farm,hover);uiTime+=dt;if(uiTime>.15){refresh();uiTime=0;}if(saveTime>3){save();saveTime=0;}requestAnimationFrame(frame);}
window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});refresh();requestAnimationFrame(frame);
