// Single Phaser scene; behaviour differs by cfg.render_family (runner | lane_defense | grid_route | meter_sim) and data features.
import Phaser from 'phaser';
import {GRID} from './core.js';
const T=GRID.tile,W=GRID.w*T,SH=GRID.h*T,H=SH+224,FONT='system-ui, sans-serif';
const px=p=>[p[0]*T+T/2,p[1]*T+T/2];
const OB={spike:'tiles.spikes',bush:'tiles.bush',slime:'enemies.slime_rest',bee:'enemies.bee_rest'};
const TXT=(s={})=>({fontFamily:FONT,fontSize:'18px',color:'#ffffff',...s});

export class LogicadeTemplateScene extends Phaser.Scene{
  constructor(){super('LogicadeTemplateScene');}
  init(d={}){Object.assign(this,{round:d.round,cfg:d.cfg||d.config,emit:d.emit,manifest:d.manifest,base:d.base,spec:d.spec,meta:d.meta,pauseForTutorial:!!d.pauseForTutorial,paused:false,locked:true,ended:false,elapsed:0,btns:[],marks:[],phase:0,secs:-1,startedAt:Date.now()});}
  preload(){if(!this.cfg||!this.manifest?.assets){this.loadFailed=true;console.error('[template] launch data is missing the Phaser config or asset manifest');return;}this.load.on('loaderror',file=>console.error('[template] asset failed to load:',file.key,file.src));const needed=new Set(this.cfg.asset_ids||this.manifest.assets.map(a=>a.id));for(const a of this.manifest.assets){if(!needed.has(a.id))continue;if(a.id.startsWith('audio.')||a.kind==='audio'||String(a.category||'').startsWith('audio/'))this.load.audio(a.id,this.base+a.path);else this.load.image(a.id,this.base+a.path);}}
  fit(o,w){o.setScale(w/o.width);return o;}
  play(k){try{this.sound.play(k);}catch{/* audio optional */}}
  pose(n){const id=this.cfg.assets.player_poses?.[n]||`characters.${this.cfg.assets.player}_${n}`;if(this.textures.exists(id))return id;const fallback=`characters.${this.cfg.assets.player}_idle`;return this.textures.exists(fallback)?fallback:id;}
  limit(){const c=this.cfg;return(c.render_family==='lane_defense'?c.pacing.approach_s:c.pacing.timer_s)*1000;}

  create(){
    if(this.loadFailed){this.add.text(24,48,'This game could not load its template data. Return to level select and try again.',TXT({wordWrap:{width:800},color:'#ffb4b4'}));return;}
    const c=this.cfg,A=c.assets,L=c.layout,lane=c.render_family==='lane_defense',n=this.round.qs.length;
    this.bg=A.bg_tiled?this.add.tileSprite(0,0,W,SH,A.bg).setOrigin(0).setTint(c.tint):this.add.image(0,0,A.bg).setOrigin(0).setDisplaySize(W,SH).setTint(c.tint);
    this.add.rectangle(0,SH,W,H-SH,0x101826).setOrigin(0);
    L.path.forEach(p=>{const[x,y]=px(p);if(!lane)this.fit(this.add.image(x,y+30,A.tile),T).setAlpha(.85);
      if(c.features.switches)this.marks.push(this.add.circle(x,y-8,9,0x555555).setStrokeStyle(2,0xffffff));});
    L.obstacles.forEach(o=>{const[x,y]=px([o.x,o.y]),texture=A.obstacles?.[o.type]||OB[o.type];this.fit(this.add.image(x,y,texture),o.type==='bush'?50:42).setAlpha(.9);});
    L.coins.forEach(p=>{const[x,y]=px(p);this.fit(this.add.image(x,y,A.coin),30);});
    const g=px(L.path[L.path.length-1]);if(!lane)this.fit(this.add.image(g[0],g[1],A.goal),T);
    const hp=lane?px(c.features.lanes>1?[7,4]:[12,6]):px(L.path[0]);
    this.hero=this.fit(this.add.image(hp[0],hp[1],this.pose('idle')),56);this.hs=this.hero.scaleX;
    if(c.features.follower){this.mate=this.fit(this.add.image(hp[0]-40,hp[1],'characters.beige_idle'),46);}
    if(c.features.phases){this.rival=this.fit(this.add.image(g[0]+10,g[1]-50,A.enemy_texture||`enemies.${A.enemy}_rest`),60);}
    this.hud=this.add.text(12,8,'',TXT({backgroundColor:'#0008',padding:{x:6,y:3}}));
    this.qtext=this.add.text(16,SH+10,'',TXT({fontSize:'20px',wordWrap:{width:W-32}}));
    this.fb=this.add.text(W/2,SH-28,'',TXT({backgroundColor:'#000a',padding:{x:8,y:4}})).setOrigin(.5);
    this.pauseTxt=this.add.text(W/2,SH/2,'PAUSED',TXT({fontSize:'48px',backgroundColor:'#000c',padding:{x:20,y:10}})).setOrigin(.5).setDepth(10).setVisible(false);
    this.input.keyboard.on('keydown',e=>{const k=parseInt(e.key,10);
      if(k>=1&&k<=this.btns.length)this.submit(k-1);else if(e.key==='h'||e.key==='H')this.useHint();});
    this.walk=this.time.addEvent({delay:140,loop:true,callback:()=>{if(this.moving){this.flip=!this.flip;this.hero.setTexture(this.pose(this.flip?'walk_a':'walk_b'));}}});
    this.banner(`${c.title}\n${c.template_label} · Click or press 1-${Math.min(6,this.round.q.options.length)} to answer`);
    this.emit('game_started',{question_count:n,template_id:c.template_id,variation_id:c.variation_id,seed:c.seed});
    this.showQuestion();
    this.installLogiCadeControls();
    if(this.pauseForTutorial){this.locked=true;this.setPaused(true);window.dispatchEvent(new Event('logicade:tutorial_ready'));}
  }

  installLogiCadeControls(){
    this._pauseHandler=()=>{if(!this.ended&&!this.paused){this.setPaused(true);window.dispatchEvent(new Event('logicade:game_paused'));}};
    this._resumeHandler=()=>{if(!this.ended){this.setPaused(false);this.locked=false;}};
    this._hintHandler=()=>this.useHint();
    window.addEventListener('logicade:pause_game',this._pauseHandler);
    window.addEventListener('logicade:resume_game',this._resumeHandler);
    window.addEventListener('logicade:show_hint',this._hintHandler);
    this.events.once('shutdown',()=>{
      window.removeEventListener('logicade:pause_game',this._pauseHandler);
      window.removeEventListener('logicade:resume_game',this._resumeHandler);
      window.removeEventListener('logicade:show_hint',this._hintHandler);
    });
  }

  showQuestion(){
    const q=this.round.q,n=q.options.length,rows=Math.ceil(n/2),bh=Math.min(56,Math.floor(120/rows)),bw=(W-42)/2;
    this.btns.forEach(b=>{b.r.destroy();b.t.destroy();});this.btns=[];
    this.qtext.setText(`${this.round.i+1}/${this.round.qs.length}  ${q.prompt}`);
    q.options.forEach((o,k)=>{const x=16+(k%2)*(bw+10),y=SH+84+Math.floor(k/2)*(bh+8);
      const r=this.add.rectangle(x,y,bw,bh,0x24344f).setOrigin(0).setStrokeStyle(2,0x5b7bb0).setInteractive({useHandCursor:true});
      const t=this.add.text(x+12,y+bh/2,`${k+1}. ${o}`,TXT({wordWrap:{width:bw-24}})).setOrigin(0,.5);
      r.on('pointerdown',()=>this.submit(k));this.btns.push({r,t});});
    this.fb.setText('');this.elapsed=0;this.qStart=Date.now();this.locked=false;this.spawnFoe();this.refresh();
  }
  spawnFoe(){
    if(this.cfg.render_family!=='lane_defense')return;
    this.foe?.destroy();
    const s=this.cfg.features.lanes>1?[[.5,4],[13,4],[7,.5],[7,7.5]][this.round.i%4]:[.5,6];
    this.from=px(s);this.foe=this.fit(this.add.image(this.from[0],this.from[1],this.cfg.assets.enemy_texture||`enemies.${this.cfg.assets.enemy}_rest`),56);
  }
  refresh(){
    const lim=this.limit(),left=lim?Math.max(0,Math.ceil((lim-this.elapsed)/1000)):null;
    this.hud.setText(`Lives ${this.round.lives}   Score ${this.round.score}`+(left!=null?`   Time ${left}s`:''));
  }
  update(t,dt){
    if(this.paused||this.locked||this.ended)return;
    this.elapsed+=dt;const lim=this.limit();if(!lim)return;
    const k=Math.min(1,this.elapsed/lim);
    if(this.foe){this.foe.x=this.from[0]+(this.hero.x-this.from[0])*k;this.foe.y=this.from[1]+(this.hero.y-this.from[1])*k;}
    const s=Math.ceil((lim-this.elapsed)/1000);if(s!==this.secs){this.secs=s;this.refresh();}
    if(k>=1)this.submit(-1);
  }

  submit(k){
    if(this.locked||this.paused||this.ended||this.round.done)return;
    this.locked=true;const ms=Date.now()-this.qStart,r=k<0?this.round.timeout():this.round.answer(k);if(!r)return;
    this.emit('question_answered',{question_id:r.id,correct:r.ok,timed_out:k<0,response_ms:ms,attempt:1});
    this.react(r);this.refresh();
    this.fb.setText((r.ok?'Correct! ':k<0?'Time is up. ':'Not quite. ')+(r.explanation||''));
    this.time.delayedCall(r.ok?900:1500,()=>this.next());
  }
  next(){if(this.round.done){this.finish();return;}this.round.next();this.showQuestion();}

  react(r){
    const c=this.cfg,f=c.render_family,L=c.layout,i=r.step,n=this.round.qs.length,last=L.path.length-1;
    if(f==='lane_defense'){
      if(r.ok){this.play(c.assets.audio?.impact||'audio.impact');this.tweens.add({targets:this.foe,y:'-=70',alpha:0,angle:200,duration:350});}else this.hurt();
    }else if(f==='meter_sim'){
      const[x,y]=px(L.path[Math.min(i,last)]),s=this.fit(this.add.image(x,y,r.ok?'tiles.wood':'tiles.spikes'),48),sc=s.scaleX;
      s.setScale(0);this.tweens.add({targets:s,scale:sc,duration:250,ease:'Back.easeOut'});
      if(r.ok)this.play(c.assets.audio?.coin||'audio.coin');else this.hurt();
    }else this.hop(i,r.ok);
    if(c.features.switches)this.marks[Math.min(i,last)]?.setFillStyle(r.ok?0xffd54a:0xb04040);
    if(c.features.zones)this.bg.setTexture(c.assets.zones[Math.min(2,Math.floor(3*i/n))]);
    if(c.features.phases){
      const ph=Math.floor(3*i/n);if(ph>this.phase&&i<n){this.phase=ph;this.banner(`Phase ${ph+1}: the rival speeds up!`);}
      this.rival.setAlpha(Math.max(.3,1-.7*i/n));this.tweens.add({targets:this.rival,angle:r.ok?-20:20,yoyo:true,duration:150});
    }
    const ce=c.features.checkpoint_every;
    if(r.ok&&ce&&i%ce===0&&this.round.lives<this.round.maxLives){this.round.heal();this.banner('Checkpoint saved: +1 life');}
  }
  hop(i,ok){
    const p=this.cfg.layout.path,[x,y]=px(p[Math.min(i,p.length-1)]);this.moving=!ok;
    if(ok){this.play(this.cfg.assets.audio?.jump||'audio.jump');this.hero.setTexture(this.pose('jump'));}else this.hurt();
    this.tweens.add({targets:this.hero,x,y,duration:420,ease:'Sine.easeInOut',onComplete:()=>{
      this.moving=false;this.hero.setTexture(this.pose(ok?'idle':'hit'));
      if(ok){this.hero.setScale(this.hs,this.hs*.8);this.tweens.add({targets:this.hero,scaleY:this.hs,duration:140});}}});
    if(this.mate)this.tweens.add({targets:this.mate,x:x-40,y,duration:520,delay:120});
  }
  hurt(){this.play(this.cfg.assets.audio?.hurt||'audio.hurt');this.hero.setTexture(this.pose('hit'));this.hero.setTint(0xff7777);this.cameras.main.shake(180,.008);
    this.time.delayedCall(400,()=>this.hero.clearTint());}
  banner(text){const b=this.add.text(W/2,90,text,TXT({align:'center',backgroundColor:'#000b',padding:{x:10,y:6}})).setOrigin(.5).setDepth(9);
    this.tweens.add({targets:b,alpha:0,y:60,delay:2200,duration:600,onComplete:()=>b.destroy()});}

  setPaused(p){this.paused=p;this.pauseTxt.setVisible(p);this.time.paused=p;if(p)this.tweens.pauseAll();else this.tweens.resumeAll();}
  useHint(){
    if(this.locked||this.ended||this.paused)return;const k=this.round.hint();if(k==null)return;
    const b=this.btns[k];b.r.setFillStyle(0x151b26).disableInteractive();b.t.setAlpha(.3);this.emit('hint_used',{question_id:this.round.q.id});
  }
  finish(){
    this.ended=true;const r=this.round.result();this.btns.forEach(b=>b.r.disableInteractive());
    this.play(r.won?(this.cfg.assets.audio?.goal||'audio.goal'):(this.cfg.assets.audio?.impact||'audio.impact'));
    this.add.text(W/2,SH/2,r.won?'Route complete!':'Out of lives - try again',TXT({fontSize:'40px',backgroundColor:'#000c',padding:{x:20,y:10}})).setOrigin(.5).setDepth(10);
    this.emit('activity_completed',{won:r.won,accuracy:r.accuracy});
    this.emit('game_over',{won:r.won,score:r.accuracy,accuracy:r.accuracy,error_count:r.errors,hint_count:r.hints,reason:r.reason,time:Math.max(0,(Date.now()-this.startedAt)/1000)});
  }
}
