// Pure logic (no Phaser): RNG, layout generation, validation, question normalisation, Round state machine.
export const TEMPLATE_VERSION='1.0.0';
export const GRID={w:14,h:9,tile:64};
export const KINDS=['linear','fork','loop','vertical','star','snake'];
export const FAMILIES=['runner','lane_defense','grid_route','meter_sim'];
export const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
export const rng=seed=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};};
const cl=(v,a,b)=>+Math.min(b,Math.max(a,v)).toFixed(2);

export function buildLayout(v,n,seed){
  const r=rng(seed),k=v.layout.kind,N=Math.max(1,n),path=[];let side=r()<.5?-1:1;
  for(let i=0;i<=N;i++){
    const t=i/N;let x=1+11*t,y=6;
    if(k==='fork'){if(i>0&&i<N){if(i%2===1&&r()<.5)side=-side;y=6+side*(i%2?2:1);}}
    else if(k==='loop'){const a=2*Math.PI*t;x=7+5*Math.sin(a);y=6-2*(1-Math.cos(a));}
    else if(k==='vertical'){x=i%2?10:3;y=7-5*t;}
    else if(k==='star'){const s=[[2,4],[7,1],[12,4],[7,7]];[x,y]=(i%2===0||i===N)?[7,4]:s[(i>>1)%4];}
    else if(k==='snake'){const row=Math.floor(i/5)%3,col=i%5;x=row%2?12-col*2.5:1+col*2.5;y=6-row*2;}
    path.push([cl(x,.5,12.5),cl(y,.5,7.5)]);
  }
  const types=['spike','bush','slime','bee'],obstacles=[];
  for(let tries=0;obstacles.length<v.pacing.obstacles&&tries<400;tries++){
    const x=cl(1+r()*11.5,.5,12.5),y=cl(1.5+r()*6,.5,7.5);
    if(path.every(p=>Math.hypot(p[0]-x,p[1]-y)>1.1)&&obstacles.every(o=>Math.hypot(o.x-x,o.y-y)>.9))obstacles.push({x,y,type:types[Math.floor(r()*4)]});
  }
  const coins=path.filter((_,i)=>i%2===1&&i<N).map(p=>[p[0],Math.max(.5,p[1]-1)]);
  return{path,obstacles,coins};
}

export const assetIds=v=>[...new Set([v.assets.bg,...v.assets.zones,v.assets.tile,v.assets.coin,v.assets.goal,
  ...(v.assets.player==='green'?['idle','walk_a','walk_b','jump','hit']:['idle','walk_a','walk_b']).map(s=>`characters.${v.assets.player}_${s}`),`enemies.${v.assets.enemy}_rest`,
  'enemies.slime_rest','enemies.bee_rest','tiles.spikes','tiles.bush','tiles.wood','characters.beige_idle'])];

export function validateVariation(v,manifestIds,mapIds,family){
  const e=[],inr=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
  if(!KINDS.includes(v.layout?.kind))e.push('layout.kind');
  if(!FAMILIES.includes(family))e.push('render_family');
  if(!mapIds.includes(v.map_id))e.push('map_id');
  if(!inr(v.pacing?.lives,1,6))e.push('pacing.lives');
  if(!inr(v.pacing?.timer_s,0,120))e.push('pacing.timer_s');
  if(!inr(v.pacing?.approach_s,6,40))e.push('pacing.approach_s');
  if(!inr(v.pacing?.obstacles,0,24))e.push('pacing.obstacles');
  if(![1,4].includes(v.features?.lanes))e.push('features.lanes');
  if(!inr(v.features?.checkpoint_every,0,10))e.push('features.checkpoint_every');
  for(const id of assetIds(v))if(!manifestIds.includes(id))e.push('asset:'+id);
  return e;
}

export function normalizeQuestions(desc){
  const raw=desc?.questions||desc?.quiz?.questions||desc?.assessment?.questions;
  if(!Array.isArray(raw)||!raw.length)throw new Error('description JSON has no questions');
  return raw.map((q,i)=>{
    const options=(q.options||q.choices||[]).map(o=>typeof o==='string'?o:String(o?.text??''));
    let a=q.answer_index??q.correct_index??(typeof q.answer==='number'?q.answer:-1);
    if(a<0){const t=q.answer??q.correct_answer;a=options.findIndex(o=>o===t);}
    if(options.length<2||options.length>6||!(a>=0&&a<options.length))throw new Error(`question ${i+1} is malformed`);
    return{id:String(q.id??`q${i+1}`),prompt:String(q.question??q.prompt??q.text??''),options,answer:a,explanation:q.explanation?String(q.explanation):''};
  });
}

export class Round{
  constructor(qs,pacing,seed=0){Object.assign(this,{qs,i:0,lives:pacing.lives,maxLives:pacing.lives,correct:0,errors:0,hints:0,score:0,done:false,answered:0,seed});this.hinted=new Set();}
  get q(){return this.qs[this.i];}
  _rec(ok){if(this.done)return null;const q=this.q;this.answered++;
    if(ok){this.correct++;this.score+=100;}else{this.errors++;this.lives--;}
    if(this.lives<=0||this.answered>=this.qs.length)this.done=true;
    return{ok,id:q.id,step:this.answered,explanation:q.explanation,correct_index:q.answer};}
  answer(k){return this._rec(k===this.q?.answer);}
  timeout(){return this._rec(false);}
  next(){if(!this.done)this.i++;}
  heal(){if(this.lives<this.maxLives)this.lives++;}
  hint(){const q=this.q;if(!q||this.done||this.hinted.has(this.i)||q.options.length<3)return null;
    const w=q.options.map((_,k)=>k).filter(k=>k!==q.answer),k=w[(this.seed+this.i)%w.length];this.hinted.add(this.i);this.hints++;return k;}
  result(){const n=this.qs.length,won=this.lives>0&&this.answered>=n;
    return{won,score:this.score,accuracy:n?+(this.correct/n).toFixed(4):0,errors:this.errors,hints:this.hints,
      reason:won?'all_questions_completed':this.lives<=0?'out_of_lives':'ended_early'};}
}

// Template/variation/seed come from description.phaser_template, then URL query, then a deterministic hash of game_id/week/level.
export function resolveTemplate(reg,init,query={}){
  const t={...(init.description?.phaser_template||{}),...query},gs=reg.games,key=`${init.game_id}:${init.week}:${init.level}:${init.run_id??0}`;
  const g=gs.find(x=>x.template_id===t.template_id)||gs[hash(`${init.game_id}:${init.run_id??0}`)%gs.length];
  const v=g.variations.find(x=>x.variation_id===t.variation_id||x.index===+t.variation)||g.variations[hash(key)%g.variations.length];
  const seed=t.seed!=null&&t.seed!==''&&Number.isFinite(+t.seed)?(+t.seed)>>>0:v.seed;
  return{game:g,variation:v,seed};
}
