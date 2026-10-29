// Persistent farming simulation. Player and programmed helper share the same
// paths, water, seeds, crops, inventory, recipes, clock and action rules.
export const COLS=24,ROWS=16,CELL=40;
export const CROPS={turnip:{seconds:22,value:12,seedPrice:3,color:'#eec4b1'},tomato:{seconds:36,value:20,seedPrice:5,color:'#ed837a'}};
export const RECIPES={sprinkler:{wood:4,stone:2},scarecrow:{wood:5,stone:1}};
export const STATIONS={well:{x:5,y:8},bench:{x:5,y:4},house:{x:3,y:3},market:{x:20,y:4},neighbor:{x:20,y:11}};
export function newFarm(){
  return{version:1,time:0,day:1,dayTime:0,coins:24,energy:100,water:6,maxWater:6,selectedSeed:'turnip',tool:'auto',
    inventory:{turnipSeeds:15,tomatoSeeds:5,turnip:0,tomato:0,wood:0,stone:0,sprinkler:0,scarecrow:0},
    plots:Array.from({length:15},(_,i)=>({row:Math.floor(i/5),col:i%5,x:8+i%5,y:6+Math.floor(i/5),crop:null,growth:0,wet:0,harvests:0})),
    resources:[{x:3,y:11,type:'wood',left:8},{x:4,y:13,type:'wood',left:8},{x:6,y:12,type:'wood',left:8},{x:18,y:12,type:'stone',left:8},{x:19,y:13,type:'stone',left:8}],
    devices:[],player:{x:6,y:5,path:[],task:null,speed:4},helper:{x:7,y:5,path:[],task:null,speed:5},
    orders:{delivered:0,friendship:0},ledger:[],message:'Welcome to the field. Walk, plant and gather—or program your helper to do the same work.',
    totals:{planted:0,watered:0,harvested:0,earned:0,crafted:0},programHistory:[],mission:0,completed:[],sound:null};
}
export const plotAt=(s,row,col)=>s.plots.find(p=>p.row===row&&p.col===col);
export function walkable(s,x,y){
  if(x<1||y<1||x>=COLS-1||y>=ROWS-1)return false;
  if(x>=15&&x<=18&&y>=6&&y<=9)return false;
  if(x>=2&&x<=4&&y>=2&&y<=3)return false;
  if(x>=19&&x<=21&&y>=2&&y<=3)return false;
  if(s.resources.some(r=>r.x===x&&r.y===y&&r.left>0))return false;
  if(Object.values(STATIONS).some(p=>p.x===x&&p.y===y))return false;
  return true;
}
export function pathTo(s,actor,target,adjacent=true){
  const start={x:Math.round(actor.x),y:Math.round(actor.y)},queue=[start],seen=new Map([[`${start.x},${start.y}`,null]]);
  const close=p=>adjacent?Math.abs(p.x-target.x)+Math.abs(p.y-target.y)<=1:p.x===target.x&&p.y===target.y;
  for(let i=0;i<queue.length;i++){
    const p=queue[i];if(close(p)){const route=[];let key=`${p.x},${p.y}`;while(seen.get(key)!=null){const [x,y]=key.split(',').map(Number);route.unshift({x,y});key=seen.get(key);}return route;}
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy},key=`${n.x},${n.y}`;if(!seen.has(key)&&walkable(s,n.x,n.y)){seen.set(key,`${p.x},${p.y}`);queue.push(n);}}
  }
  return null;
}
export function ready(p){return Boolean(p?.crop&&p.growth>=CROPS[p.crop].seconds);}
function note(s,actor,name,args,ok,message){
  const item={time:s.time,day:s.day,actor,name,args:[...args],ok,message};s.ledger.push(item);if(s.ledger.length>600)s.ledger.shift();s.message=message;s.sound=ok?'coin':'hurt';return{ok,result:ok?1:0,message};
}
const requirePlot=(s,args)=>{if(args.length<2||!Number.isInteger(args[0])||!Number.isInteger(args[1]))throw Error('Use an integer row and column.');const p=plotAt(s,args[0],args[1]);if(!p)throw Error('Plot out of bounds: rows are 0–2; columns are 0–4.');return p;};
export function actionTarget(s,actor,name,args){
  if(['plant','water','harvest','place'].includes(name))return requirePlot(s,name==='place'?args.slice(1):args);
  if(name==='refill')return STATIONS.well;
  if(name==='craft')return STATIONS.bench;
  if(name==='sell'||name==='buy')return STATIONS.market;
  if(name==='deliver')return STATIONS.neighbor;
  if(name==='rest')return {...STATIONS.house,y:4};
  if(name==='gather'){if(!['wood','stone'].includes(args[0]))throw Error('Gather wood or stone.');const options=s.resources.filter(r=>r.type===args[0]&&r.left>0).sort((a,b)=>Math.hypot(a.x-actor.x,a.y-actor.y)-Math.hypot(b.x-actor.x,b.y-actor.y));if(!options.length)throw Error(`No ${args[0]} remains today. Rest to start the next day.`);return options[0];}
  if(name==='move'){if(args.length!==2||!args.every(Number.isInteger)||!walkable(s,args[0],args[1]))throw Error('Choose a walkable tile inside the map.');return{x:args[0],y:args[1]};}
  if(name==='wait'){if(args.length!==1||!Number.isFinite(args[0])||args[0]<0||args[0]>60)throw Error('wait(seconds) accepts 0–60 seconds.');return{x:actor.x,y:actor.y};}
  throw Error(`Unknown field operation: ${name}`);
}
export function beginAction(s,who,name,args=[]){
  const actor=s[who];if(actor.task)return{ok:false,message:`${who} is already working.`};
  try{const target=actionTarget(s,actor,name,args),path=name==='wait'?[]:pathTo(s,actor,target,name!=='move');if(!path)throw Error('That destination is blocked.');actor.path=path;actor.task={name,args:[...args],target:{x:target.x,y:target.y},remaining:name==='wait'?args[0]:.38};return{ok:true};}
  catch(error){return note(s,who,name,args,false,error.message);}
}
function perform(s,who,task){
  const {name,args,target}=task;
  try{
    if(!['move','wait','rest','refill','sell','buy','deliver'].includes(name)&&s.energy<1)throw Error('Out of energy. Rest at home before working.');
    if(name==='plant'){
      const p=requirePlot(s,args),crop=args[2]??s.selectedSeed;if(!CROPS[crop])throw Error('Plant turnip or tomato.');if(p.crop)throw Error(`Plot (${p.row}, ${p.col}) is already planted.`);if(s.devices.some(d=>d.row===p.row&&d.col===p.col))throw Error('A device occupies that plot.');if(s.inventory[`${crop}Seeds`]<1)throw Error(`No ${crop} seeds. Buy seeds at the market.`);
      s.inventory[`${crop}Seeds`]--;p.crop=crop;p.growth=0;p.wet=0;s.energy--;s.totals.planted++;return note(s,who,name,args,true,`Planted ${crop} at (${p.row}, ${p.col}).`);
    }
    if(name==='water'){
      const p=requirePlot(s,args);if(!p.crop)throw Error('Plant the plot before watering.');if(s.water<1)throw Error('The can is empty. Call refill() or visit the well.');s.water--;s.energy--;p.wet=35;s.totals.watered++;return note(s,who,name,args,true,`Watered (${p.row}, ${p.col}); ${s.water} water left.`);
    }
    if(name==='harvest'){
      const p=requirePlot(s,args);if(!ready(p))throw Error('This crop is not ripe. Keep it watered and allow it to grow.');const crop=p.crop;s.inventory[crop]++;p.crop=null;p.growth=0;p.wet=0;p.harvests++;s.energy--;s.totals.harvested++;return note(s,who,name,args,true,`Harvested a ${crop}. It is now in your shared inventory.`);
    }
    if(name==='refill'){s.water=s.maxWater;return note(s,who,name,args,true,'Filled the watering can at the well.');}
    if(name==='gather'){const resource=s.resources.find(r=>r.x===target.x&&r.y===target.y&&r.type===args[0]&&r.left>0);if(!resource)throw Error('That resource has been exhausted.');resource.left--;s.inventory[resource.type]++;s.energy--;return note(s,who,name,args,true,`Gathered 1 ${resource.type}.`);}
    if(name==='craft'){
      const recipe=RECIPES[args[0]];if(!recipe)throw Error('Recipes available: sprinkler, scarecrow.');for(const [material,amount] of Object.entries(recipe))if(s.inventory[material]<amount)throw Error(`Need ${amount} ${material} to craft ${args[0]}.`);for(const [material,amount] of Object.entries(recipe))s.inventory[material]-=amount;s.inventory[args[0]]++;s.totals.crafted++;s.energy--;return note(s,who,name,args,true,`Crafted a ${args[0]}; ingredients were consumed.`);
    }
    if(name==='place'){
      const type=args[0],p=requirePlot(s,args.slice(1));if(!RECIPES[type]||s.inventory[type]<1)throw Error(`Craft a ${type} first.`);if(p.crop||s.devices.some(d=>d.row===p.row&&d.col===p.col))throw Error('Place devices on an empty plot.');s.inventory[type]--;s.devices.push({type,row:p.row,col:p.col,x:p.x,y:p.y,timer:0});s.energy--;return note(s,who,name,args,true,`Installed ${type} at (${p.row}, ${p.col}).`);
    }
    if(name==='sell'){
      const [crop,amount]=args;if(!CROPS[crop]||!Number.isInteger(amount)||amount<1)throw Error('sell("turnip", amount) or sell("tomato", amount) needs a positive integer.');if(s.inventory[crop]<amount)throw Error(`You do not have ${amount} ${crop}.`);const earned=amount*CROPS[crop].value;s.inventory[crop]-=amount;s.coins+=earned;s.totals.earned+=earned;return note(s,who,name,args,true,`Sold ${amount} ${crop} for ${earned} coins.`);
    }
    if(name==='buy'){
      const [crop,amount]=args;if(!CROPS[crop]||!Number.isInteger(amount)||amount<1||amount>99)throw Error('Choose turnip or tomato and 1–99 seeds.');const cost=CROPS[crop].seedPrice*amount;if(s.coins<cost)throw Error(`Need ${cost} coins for those seeds.`);s.coins-=cost;s.inventory[`${crop}Seeds`]+=amount;return note(s,who,name,args,true,`Bought ${amount} ${crop} seeds.`);
    }
    if(name==='deliver'){
      if(s.inventory.turnip<3)throw Error('Ada needs 3 turnips for the community kitchen.');s.inventory.turnip-=3;s.coins+=50;s.totals.earned+=50;s.orders.delivered++;s.orders.friendship++;return note(s,who,name,args,true,'Delivered 3 turnips to Ada. +50 coins and +1 friendship.');
    }
    if(name==='rest'){
      s.day++;s.dayTime=0;s.energy=100;for(const p of s.plots){if(p.wet>0&&p.crop)p.growth=CROPS[p.crop].seconds;p.wet=0;}for(const r of s.resources)r.left=Math.max(r.left,4);return note(s,who,name,args,true,`Day ${s.day}. Energy restored; watered crops grew overnight.`);
    }
    return note(s,who,name,args,true,name==='wait'?`Waited ${args[0]} seconds while the farm continued growing.`:'Reached the destination.');
  }catch(error){return note(s,who,name,args,false,error.message);}
}
export function stepFarm(s,seconds){
  const dt=Math.max(0,Math.min(.1,seconds)),before=s.time;s.time+=dt;s.dayTime+=dt;
  if(Math.floor(before/150)<Math.floor(s.time/150)){
    const exposed=s.plots.find(p=>p.crop&&!s.devices.some(d=>d.type==='scarecrow'&&Math.max(Math.abs(d.row-p.row),Math.abs(d.col-p.col))<=2));
    if(exposed){exposed.growth=Math.max(0,exposed.growth-8);s.message='Birds nibbled a crop: growth lost 8 seconds. A scarecrow protects plots within two tiles.';}
  }
  // An unattended field remains alive: planted crops need actual irrigation.
  for(const p of s.plots){if(p.crop&&p.wet>0)p.growth=Math.min(CROPS[p.crop].seconds,p.growth+dt);p.wet=Math.max(0,p.wet-dt);}
  for(const d of s.devices)if(d.type==='sprinkler'){
    d.timer-=dt;if(d.timer<=0){d.timer=8;for(const p of s.plots)if(p.crop&&Math.max(Math.abs(p.row-d.row),Math.abs(p.col-d.col))<=1)p.wet=Math.max(p.wet,12);}
  }
  const results=[];
  for(const who of ['player','helper']){
    const actor=s[who];if(!actor.task)continue;
    if(actor.path.length){const next=actor.path[0],dx=next.x-actor.x,dy=next.y-actor.y,length=Math.hypot(dx,dy),distance=actor.speed*dt;if(length<=distance){actor.x=next.x;actor.y=next.y;actor.path.shift();}else{actor.x+=dx/length*distance;actor.y+=dy/length*distance;}continue;}
    actor.task.remaining-=dt;if(actor.task.remaining<=0){const task=actor.task;actor.task=null;results.push({who,...perform(s,who,task)});}
  }
  return results;
}
export const FIELD_ACTIONS=['plant','water','harvest','refill','gather','craft','place','sell','buy','deliver','wait','move','rest'];
export const FIELD_SENSORS=['ripe','empty','wet','water_left','seeds','stock','coins','energy'];
export function readField(s,name,args){
  if(['ripe','empty','wet'].includes(name)){const p=requirePlot(s,args);return name==='ripe'?Number(ready(p)):name==='empty'?Number(!p.crop&&!s.devices.some(d=>d.row===p.row&&d.col===p.col)):Number(p.wet>0);}
  if(name==='water_left')return s.water;if(name==='coins')return s.coins;if(name==='energy')return s.energy;
  if(name==='stock'){if(!(args[0] in s.inventory))throw Error('Unknown inventory item.');return s.inventory[args[0]];}
  if(name==='seeds'){if(!CROPS[args[0]])throw Error('Choose turnip or tomato.');return s.inventory[`${args[0]}Seeds`];}
  throw Error('Unknown sensor.');
}
export function serializeFarm(s){
  const copy=JSON.parse(JSON.stringify(s));for(const who of ['player','helper']){copy[who].x=Math.round(copy[who].x);copy[who].y=Math.round(copy[who].y);copy[who].path=[];copy[who].task=null;}copy.ledger=copy.ledger.slice(-150);copy.sound=null;return copy;
}
export function restoreFarm(saved){
  const fresh=newFarm();if(!saved||saved.version!==1||!Array.isArray(saved.plots)||saved.plots.length!==15)return fresh;
  // Only restore known state fields and validate the numeric economy.
  for(const k of ['coins','energy','water','time','day','dayTime'])if(!Number.isFinite(saved[k])||saved[k]<0)return fresh;
  for(const key of Object.keys(fresh.inventory))if(!Number.isFinite(saved.inventory?.[key])||saved.inventory[key]<0)return fresh;
  for(const p of saved.plots)if(!fresh.plots.some(q=>q.row===p.row&&q.col===p.col)||p.crop&&!CROPS[p.crop])return fresh;
  for(const key of Object.keys(fresh))if(key in saved)fresh[key]=saved[key];
  for(const who of ['player','helper']){fresh[who]={...newFarm()[who],x:Math.min(22,Math.max(1,Math.round(saved[who]?.x)||6)),y:Math.min(14,Math.max(1,Math.round(saved[who]?.y)||5))};}
  return fresh;
}
