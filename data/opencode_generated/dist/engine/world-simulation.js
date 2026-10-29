// Deterministic, DOM-free arcade rules. Canvas is only a view of this state.
import { rng } from './core.js';

export const WIDTH = 960;
export const HEIGHT = 540;
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const down = (keys, ...names) => names.some(name => keys.has(name));
const points = (s, n) => { s.score += n; s.sound = 'coin'; };
export function completeWorld(s) { s.objectiveComplete = true; s.sound = 'goal'; s.message = 'Mission reached. Complete the CP1 lab to finish this chapter.'; }
function hurt(s) {
  if (s.invulnerable > 0 || s.objectiveComplete || s.lost) return;
  s.health--; s.invulnerable = 1.6; s.sound = 'hurt';
  if (s.health <= 0) { s.lost = true; s.message = 'Try the mission again, or open the lesson for practice.'; }
}
export function rotateMask(mask) { return ((mask << 1) & 15) | ((mask >> 3) & 1); }
// Ports: north=1, east=2, south=4, west=8.
export function connectedRoute(s) {
  const first = s.sourceRow * s.cols;
  if (!(s.tiles[first] & 8)) return [];
  const seen = new Set([first]), queue = [first];
  const dirs = [[0,-1,1,4],[1,0,2,8],[0,1,4,1],[-1,0,8,2]];
  while (queue.length) {
    const id = queue.shift(), x = id % s.cols, y = Math.floor(id / s.cols);
    for (const [dx,dy,port,other] of dirs) {
      const nx=x+dx, ny=y+dy;
      if(nx<0||nx>=s.cols||ny<0||ny>=s.rows) continue;
      const next=ny*s.cols+nx;
      if((s.tiles[id]&port)&&(s.tiles[next]&other)&&!seen.has(next)){ seen.add(next);queue.push(next); }
    }
  }
  return [...seen];
}

export function createWorld(profile, seed = 1, level = 1) {
  const random = rng(seed);
  const s = { genre: profile.genre, seed, level, time: 0, health: 3, score: 0, collected: 0, target: 3,
    objectiveComplete: false, lost: false, invulnerable: 0, cooldown: 0, sound: '', message: profile.mission,
    player: { x: 100, y: 400, w: 32, h: 42, vx: 0, vy: 0, grounded: false }, particles: [], camera: 0,
    random, profile, keys: new Set(), shots: [], enemies: [], items: [], walls: [] };
  if (s.genre === 'platform') {
    s.length = 2520; s.goal = {x:2380,y:390};
    s.platforms = [{x:0,y:470,w:s.length,h:70}];
    for(let i=0;i<7;i++)s.platforms.push({x:260+i*290,y:345-(i%2)*60,w:110,h:18,base:260+i*290,moving:i%2===1});
    s.hazards = Array.from({length:5},(_,i)=>({x:400+i*380+Math.floor(random()*50),y:452,w:38,h:18}));
    // Put mandatory pickups in clear gaps, never below an elevated platform.
    s.items = [735,1350,2220].map(x=>({x:x+Math.floor(random()*20),y:400,taken:false}));
  } else if (['explore','stealth','tactics'].includes(s.genre)) {
    s.player = {...s.player,x:95,y:255,w:28,h:32}; s.goal={x:870,y:420};
    const gap = 150 + Math.floor(random()*180);
    s.walls=[{x:305,y:70,w:28,h:gap-70},{x:305,y:gap+110,w:28,h:465-gap-110},
      {x:605,y:70,w:28,h:150},{x:605,y:330,w:28,h:135}].filter(w=>w.h>0);
    s.items=[{x:205,y:130},{x:485,y:400},{x:790,y:120}].map(p=>({...p,taken:false}));
    if(s.genre!=='explore')s.enemies=Array.from({length:3},(_,i)=>({x:235+i*250,y:250,base:235+i*250,phase:random()*6,health:s.genre==='tactics'?2:999,stun:0}));
  } else if (s.genre === 'shooter') {
    s.player={...s.player,x:460,y:430,w:34,h:40};s.target=8;s.spawnTimer=.5;
  } else if (s.genre === 'defense') {
    s.cols=12;s.rows=6;s.cell=64;s.ox=96;s.oy=104;s.gold=40;s.towers=[];s.wave=false;s.spawned=0;s.target=6+(level%3);s.spawnTimer=0;
    s.road=Array.from({length:12},(_,x)=>({x,y:3}));
  } else if (s.genre === 'garden') {
    s.plots=Array.from({length:6},(_,i)=>({x:245+(i%3)*170,y:180+Math.floor(i/3)*150,stage:0,growth:0}));
  } else if (s.genre === 'route') {
    s.cols=6;s.rows=4;s.cell=88;s.ox=216;s.oy=90;s.sourceRow=Math.floor(random()*4);s.exitRow=Math.floor(random()*4);
    s.solution=Array(24).fill(0);const path=[];let y=s.sourceRow;
    for(let x=0;x<6;x++){
      path.push(y*6+x);
      const nextY=x===4?s.exitRow:(x===1?Math.floor(random()*4):y);
      while(y!==nextY){ y+=Math.sign(nextY-y);path.push(y*6+x); }
    }
    const ports=(a,b)=> b===a+1?2:b===a-1?8:b===a+6?4:1;
    path.forEach((id,i)=>{s.solution[id]=(i?ports(id,path[i-1]):8)|(i+1<path.length?ports(id,path[i+1]):2)});
    s.tiles=s.solution.map(mask=>{let v=mask||([3,5,10,6][Math.floor(random()*4)]);for(let i=Math.floor(random()*4);i>0;i--)v=rotateMask(v);return v});
    s.connected=[];s.moves=0;
  } else if (s.genre === 'production') {
    s.target=8;s.selected=0;s.belt=[];s.spawnTimer=.5;s.streak=0;s.stationNames=profile.mood==='warm'?['Prep','Cook','Serve']:['A','B','C'];
  } else if (s.genre === 'strategy') {
    s.resources={food:6,trust:6,gold:6};s.turn=0;s.target=6;s.selected=0;
    s.cards=[{name:'Plant & provision',detail:'+4 food · −1 gold',delta:[4,0,-1]},
      {name:'Open the market',detail:'+4 gold · −1 trust',delta:[0,-1,4]},
      {name:'Hold a festival',detail:'+4 trust · −1 food',delta:[-1,4,0]}];
    s.events=Array.from({length:6},()=>Math.floor(random()*3));
  } else if (s.genre === 'rhythm') {
    s.target=8;s.notes=[];s.spawnTimer=1;s.beat=0;s.lastLane=-1;s.hitFlash=0;s.combo=0;
  } else if (s.genre === 'pong') {
    s.target=6;s.paddle=250;s.ball={x:480,y:260,vx:-260,vy:100+(level%4)*25};s.serving=true;
  } else if (s.genre === 'pixel') {
    s.cols=6;s.rows=6;s.cell=54;s.ox=355;s.oy=110;s.selected=1;s.pixels=Array(36).fill(0);
    const patterns=[['001100','012210','122221','122221','012210','001100'],['003300','033330','333333','003300','003300','003300'],['010010','111111','122221','012210','001100','000000']];
    s.reference=patterns[(level-1)%patterns.length].join('').split('').map(Number);
  }
  return s;
}

function movePlayer(s,dt,speed) {
  const k=s.keys,p=s.player;
  let dx=Number(down(k,'d','arrowright'))-Number(down(k,'a','arrowleft'));
  let dy=Number(down(k,'s','arrowdown'))-Number(down(k,'w','arrowup'));
  const length=Math.hypot(dx,dy)||1;dx=dx/length*speed*dt;dy=dy/length*speed*dt;
  p.x=clamp(p.x+dx,55,905-p.w);if(s.walls.some(w=>overlap(p,w)))p.x-=dx;
  p.y=clamp(p.y+dy,75,470-p.h);if(s.walls.some(w=>overlap(p,w)))p.y-=dy;
}

export function actWorld(s, action = 'action', value) {
  if(s.lost||s.objectiveComplete)return;
  if(action==='select'){s.selected=value;return;}
  if(s.genre==='platform') {
    if(s.player.grounded){s.player.vy=-560;s.player.grounded=false;s.sound='jump';}
  } else if(s.genre==='stealth') {
    if(s.cooldown<=0){s.invulnerable=1;s.cooldown=3;s.sound='jump';}
  } else if(s.genre==='tactics') {
    if(s.cooldown>0)return;s.cooldown=.4;s.pulse=.25;s.sound='impact';
    const p={x:s.player.x+14,y:s.player.y+16};
    const e=s.enemies.filter(e=>e.health>0).sort((a,b)=>distance(a,p)-distance(b,p))[0];
    if(e&&distance(e,p)<210){e.health--;e.stun=.8;if(e.health<=0)points(s,30);}
  } else if(s.genre==='shooter') {
    if(s.cooldown<=0){s.shots.push({x:s.player.x+17,y:s.player.y,vx:0,vy:-470,friendly:true});s.cooldown=.18;s.sound='impact';}
  } else if(s.genre==='defense') {
    if(s.towers.length&&!s.wave){s.wave=true;s.message='Wave approaching. Build or upgrade while the towers defend.';}
    else if(!s.towers.length)s.message='Place at least one tower on an empty tile first.';
  } else if(s.genre==='garden') {
    const plot=value==null?s.plots.find(p=>p.stage!==3):s.plots[value];
    if(!plot)return;
    if(plot.stage===0){plot.stage=1;s.message='Seed planted. Water it to begin growing.';}
    else if(plot.stage===1){plot.stage=2;s.message='Growing! Tend another plot while this one blooms.';}
    else if(plot.stage===2&&plot.growth>=3){plot.stage=3;s.collected++;points(s,50);if(s.collected>=3)completeWorld(s);}
  } else if(s.genre==='route') {
    s.connected=connectedRoute(s);const exit=s.exitRow*s.cols+s.cols-1;
    if(s.connected.includes(exit)&&(s.tiles[exit]&2)){points(s,150);completeWorld(s);}
    else{s.message='The glowing flow shows your connected route. Turn the disconnected joints and test again.';s.sound='impact';}
  } else if(s.genre==='production') {
    const item=s.belt.find(i=>i.x>=200&&!i.done);
    if(!item){s.message='Wait for an item to reach the lit dispatch zone.';return;}
    item.done=true;
    if(item.kind===s.selected){s.collected++;s.streak++;points(s,20+s.streak*5);if(s.collected>=s.target)completeWorld(s);}
    else {s.streak=0;hurt(s);s.message='Wrong station. Match the item number to the destination.';}
  } else if(s.genre==='strategy') {
    const card=s.cards[value??s.selected];
    ['food','trust','gold'].forEach((key,i)=>s.resources[key]+=card.delta[i]-1);
    const affected=['food','trust','gold'][s.events[s.turn]];s.resources[affected]--;
    s.turn++;s.collected=s.turn;s.message=`Council turn ${s.turn}: upkeep used one of each resource; the season also used one ${affected}.`;
    if(Object.values(s.resources).some(n=>n<=0)){s.lost=true;s.message='The council ran out of a resource. Balance all three on your next attempt.';}
    else{points(s,25);if(s.turn>=s.target)completeWorld(s);}
  } else if(s.genre==='rhythm') {
    const lane=value??s.lastLane;
    const note=s.notes.filter(n=>n.lane===lane&&!n.done).sort((a,b)=>Math.abs(a.y-420)-Math.abs(b.y-420))[0];
    s.lastLane=lane;s.hitFlash=.18;
    if(note&&Math.abs(note.y-420)<48){note.done=true;s.collected++;s.combo++;points(s,20+s.combo*2);if(s.collected>=s.target)completeWorld(s);}
    else{s.combo=0;s.message='Aim for the glowing line. Missed taps do not cost health.';}
  } else if(s.genre==='pong') {s.serving=false;}
  else if(s.genre==='pixel') {
    const good=s.pixels.every((v,i)=>v===s.reference[i]);
    if(good){points(s,180);completeWorld(s);}else s.message=`${s.pixels.filter((v,i)=>v===s.reference[i]).length}/36 pixels match. Compare with the reference.`;
  } else {s.scan=1;s.message='Follow the glowing discoveries. The beacon opens after all three are collected.';}
}

export function clickWorld(s,x,y) {
  if(s.lost||s.objectiveComplete)return;
  if(s.genre==='defense'){
    const col=Math.floor((x-s.ox)/s.cell),row=Math.floor((y-s.oy)/s.cell);
    if(col<0||col>=s.cols||row<0||row>=s.rows||s.road.some(p=>p.x===col&&p.y===row))return;
    const tower=s.towers.find(t=>t.col===col&&t.row===row);
    if(tower){if(s.gold>=8&&tower.level<3){s.gold-=8;tower.level++;s.sound='coin';}}
    else if(s.gold>=10){s.gold-=10;s.towers.push({col,row,x:s.ox+(col+.5)*s.cell,y:s.oy+(row+.5)*s.cell,level:1,cooldown:0});s.sound='impact';}
    else s.message='Not enough gold. Defeating enemies earns more.';
  } else if(s.genre==='garden'){
    const i=s.plots.findIndex(p=>Math.abs(p.x-x)<65&&Math.abs(p.y-y)<60);if(i>=0)actWorld(s,'action',i);
  } else if(s.genre==='route'){
    const cx=Math.floor((x-s.ox)/s.cell),cy=Math.floor((y-s.oy)/s.cell);
    if(cx>=0&&cx<s.cols&&cy>=0&&cy<s.rows){const i=cy*s.cols+cx;s.tiles[i]=rotateMask(s.tiles[i]);s.moves++;s.connected=[];s.sound='impact';}
  } else if(s.genre==='rhythm'){
    const lane=Math.floor((x-240)/120);if(lane>=0&&lane<4)actWorld(s,'action',lane);
  } else if(s.genre==='strategy'){
    const i=Math.floor((x-150)/230);if(y>225&&y<410&&i>=0&&i<3)actWorld(s,'action',i);
  } else if(s.genre==='production'){
    const lane=Math.floor((x-220)/180);if(y>370&&lane>=0&&lane<3){s.selected=lane;actWorld(s);}
  } else if(s.genre==='pong'){s.paddle=clamp(y,120,435);s.serving=false;}
  else if(s.genre==='pixel'){
    const cx=Math.floor((x-s.ox)/s.cell),cy=Math.floor((y-s.oy)/s.cell);
    if(cx>=0&&cx<6&&cy>=0&&cy<6)s.pixels[cy*6+cx]=s.selected;
  }
}

export function stepWorld(s, dt, keys = s.keys) {
  if(s.objectiveComplete||s.lost)return;
  dt=clamp(dt,0,.04);s.keys=keys;s.time+=dt;s.invulnerable=Math.max(0,s.invulnerable-dt);s.cooldown=Math.max(0,s.cooldown-dt);
  if(s.scan)s.scan=Math.max(0,s.scan-dt);if(s.pulse)s.pulse=Math.max(0,s.pulse-dt);
  if(s.genre==='platform'){
    const p=s.player,oldBottom=p.y+p.h;
    p.vx=(Number(down(keys,'d','arrowright'))-Number(down(keys,'a','arrowleft')))*250;
    p.x=clamp(p.x+p.vx*dt,0,s.length-p.w);p.vy+=1300*dt;p.y+=p.vy*dt;p.grounded=false;
    for(const floor of s.platforms){
      if(floor.moving)floor.x=floor.base+Math.sin(s.time*1.2)*55;
      if(p.vy>=0&&p.x+p.w>floor.x&&p.x<floor.x+floor.w&&oldBottom<=floor.y+2&&p.y+p.h>=floor.y){p.y=floor.y-p.h;p.vy=0;p.grounded=true;}
    }
    if(s.hazards.some(h=>overlap(p,h))){hurt(s);p.vy=-320;}
    for(const item of s.items)if(!item.taken&&distance({x:p.x+16,y:p.y+20},item)<38){item.taken=true;s.collected++;points(s,50);}
    s.camera=clamp(p.x-260,0,s.length-WIDTH);
    if(s.collected>=s.target&&p.x>s.goal.x-30)completeWorld(s);
  } else if(['explore','stealth','tactics'].includes(s.genre)){
    movePlayer(s,dt,s.genre==='stealth'&&s.invulnerable>0?260:185);
    const p={x:s.player.x+14,y:s.player.y+16};
    for(const item of s.items)if(!item.taken&&distance(p,item)<32){item.taken=true;s.collected++;points(s,50);}
    for(const e of s.enemies){if(e.health<=0)continue;e.stun=Math.max(0,e.stun-dt);if(e.stun>0)continue;
      e.y=260+Math.sin(s.time*.9+e.phase)*145;e.x=e.base+Math.cos(s.time*.7+e.phase)*40;
      if(distance(p,e)<(s.genre==='stealth'?68:29))hurt(s);
    }
    if(down(keys,' ')&&s.genre==='tactics')actWorld(s);
    if(s.collected>=s.target&&distance(p,s.goal)<42)completeWorld(s);
  } else if(s.genre==='shooter'){
    movePlayer(s,dt,280);if(down(keys,' '))actWorld(s);s.spawnTimer-=dt;
    if(s.spawnTimer<=0){s.enemies.push({x:100+s.random()*760,y:70,health:1,phase:s.random()*6,fire:1});s.spawnTimer=1.1;}
    for(const e of s.enemies){if(e.health<=0)continue;e.y+=42*dt;e.x+=Math.sin(s.time*2+e.phase)*45*dt;e.fire-=dt;
      if(e.fire<=0){s.shots.push({x:e.x,y:e.y,vx:0,vy:150,friendly:false});e.fire=2;}
      if(e.y>485){e.health=0;hurt(s);}else if(distance(e,{x:s.player.x+17,y:s.player.y+20})<30){e.health=0;hurt(s);}
    }
    for(const shot of s.shots){shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;
      if(shot.friendly){const hit=s.enemies.find(e=>e.health>0&&distance(e,shot)<28);if(hit){hit.health=0;shot.y=-100;s.collected++;points(s,30);}}
      else if(distance(shot,{x:s.player.x+17,y:s.player.y+20})<23){shot.y=900;hurt(s);}
    }
    s.shots=s.shots.filter(p=>p.y>-20&&p.y<560);s.enemies=s.enemies.filter(e=>e.health>0);
    if(s.collected>=s.target)completeWorld(s);
  } else if(s.genre==='defense'){
    if(!s.wave)return;s.spawnTimer-=dt;
    if(s.spawnTimer<=0&&s.spawned<s.target){s.enemies.push({x:s.ox,y:s.oy+3.5*s.cell,health:3,slow:0});s.spawned++;s.spawnTimer=1.7;}
    for(const e of s.enemies){if(e.health<=0)continue;e.x+=38*dt;if(e.x>s.ox+12*s.cell){e.health=0;hurt(s);}}
    for(const t of s.towers){t.cooldown-=dt;t.beam=null;const e=s.enemies.find(e=>e.health>0&&distance(e,t)<125+t.level*12);
      if(e&&t.cooldown<=0){e.health-=t.level;t.cooldown=.7;t.beam={x:e.x,y:e.y};if(e.health<=0){s.collected++;s.gold+=3;points(s,25);}}
    }
    s.enemies=s.enemies.filter(e=>e.health>0);
    if(s.spawned>=s.target&&!s.enemies.length&&!s.lost)completeWorld(s);
  } else if(s.genre==='garden'){
    for(const p of s.plots)if(p.stage===2)p.growth=Math.min(3,p.growth+dt);
  } else if(s.genre==='production'){
    s.spawnTimer-=dt;if(s.spawnTimer<=0){s.belt.push({x:100,kind:Math.floor(s.random()*3),done:false});s.spawnTimer=2.7;}
    for(const item of s.belt){item.x+=65*dt;if(item.x>850&&!item.done){item.done=true;hurt(s);s.message='An item passed the station. Select its number, then Dispatch.';}}
    s.belt=s.belt.filter(i=>!i.done);
  } else if(s.genre==='rhythm'){
    s.spawnTimer-=dt;s.hitFlash=Math.max(0,s.hitFlash-dt);
    if(s.spawnTimer<=0){s.notes.push({lane:Math.floor(s.random()*4),y:80,done:false});s.spawnTimer=.8;s.beat++;s.sound='beat';}
    for(const n of s.notes){n.y+=145*dt;if(n.y>490&&!n.done){n.done=true;s.combo=0;s.message='Keep going. Catch the next note at the glowing line.';}}
    s.notes=s.notes.filter(n=>!n.done);
  } else if(s.genre==='pong'){
    s.paddle=clamp(s.paddle+(Number(down(keys,'s','arrowdown'))-Number(down(keys,'w','arrowup')))*310*dt,120,435);
    if(s.serving)return;const b=s.ball;b.x+=b.vx*dt;b.y+=b.vy*dt;
    if(b.y<80){b.y=80;b.vy=Math.abs(b.vy);}if(b.y>480){b.y=480;b.vy=-Math.abs(b.vy);}
    if(b.x>875){b.x=875;b.vx=-Math.abs(b.vx);}
    if(b.vx<0&&b.x<130&&b.x>100&&Math.abs(b.y-s.paddle)<65){b.x=130;b.vx=Math.abs(b.vx)+10;b.vy=(b.y-s.paddle)*4;s.collected++;points(s,30);}
    if(b.x<55){hurt(s);s.ball={x:480,y:260,vx:-260,vy:110};s.serving=true;}
    if(s.collected>=s.target)completeWorld(s);
  }
}
