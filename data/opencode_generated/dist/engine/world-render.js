import { WIDTH, HEIGHT } from './world-simulation.js';
import { PALETTES } from './world-profiles.js';

export async function loadWorldImages(pack, assets) {
  const result = {};
  if (!pack) return result;
  const ids = {...assets, hero: 'characters.green_idle', walk: 'characters.green_walk_a', jump: 'characters.green_jump'};
  await Promise.all(Object.entries(ids).filter(([,id])=>typeof id==='string').map(async ([key,id])=>{
    const url=pack.urlFor(id);if(!url)return;
    const img=new Image();img.src=url;
    await new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;if(img.complete)resolve();});
    if(img.naturalWidth)result[key]=img;
  }));
  return result;
}

export function drawWorld(ctx,s,images={}) {
  const palette=PALETTES[s.profile.mood]||PALETTES.bright;
  const [ink,ground,mint,gold]=palette;
  const box=(x,y,w,h,color,r=0)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
  const text=(value,x,y,size=16,color='#edf8f5',align='left')=>{ctx.fillStyle=color;ctx.font=`${size>=24?700:500} ${size}px system-ui, sans-serif`;ctx.textAlign=align;ctx.fillText(String(value),x,y);};
  const circle=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
  const line=(x1,y1,x2,y2,color,width=3)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
  const sprite=(key,x,y,w,h,fallback=mint)=>{
    const img=images[key];
    if(img){const ratio=Math.min(w/img.width,h/img.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(img,x+(w-img.width*ratio)/2,y+(h-img.height*ratio),img.width*ratio,img.height*ratio);}
    else{box(x,y,w,h,fallback,6);circle(x+w*.36,y+h*.3,2,ink);circle(x+w*.65,y+h*.3,2,ink);}
  };
  const gem=(x,y,taken)=>{if(taken)return;const bounce=s.profile.reducedMotion?0:Math.sin(s.time*3+x)*3;circle(x,y+bounce,20,'#ffffff10');ctx.save();ctx.translate(x,y+bounce);ctx.rotate(Math.PI/4);box(-8,-8,16,16,gold,3);ctx.restore();};
  const beacon=(x,y)=>{circle(x,y,34,mint+'18');line(x,y-34,x,y+20,mint,4);box(x,y-34,26,17,s.collected>=s.target?gold:mint,3);circle(x,y+22,4,gold);};
  const hero=(p)=>{if(s.invulnerable>0&&Math.floor(s.time*10)%2===0)return;const key=s.genre==='shooter'?'player':s.genre==='platform'&&!p.grounded?'jump':s.keys?.size?'walk':'hero';sprite(key,p.x,p.y,p.w,p.h);};

  ctx.clearRect(0,0,WIDTH,HEIGHT);
  const bg=ctx.createLinearGradient(0,0,0,HEIGHT);bg.addColorStop(0,ink);bg.addColorStop(1,ground);ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);
  if(images.bg){ctx.globalAlpha=.15;ctx.drawImage(images.bg,0,0,WIDTH,HEIGHT);ctx.globalAlpha=1;}
  for(let i=0;i<45;i++){const x=(i*137+s.seed%101)%WIDTH,y=(i*71)%HEIGHT;circle(x,y,1,i%3===0?gold+'55':'#ffffff25');}
  box(22,18,916,40,'#08151bc9',12);
  text(s.profile.genreLabel||s.genre,40,44,14,mint);text(`CHAPTER ${String(s.level).padStart(2,'0')}`,915,44,13,'#dce8e7','right');

  if(s.genre==='platform'){
    for(let i=0;i<12;i++){const x=i*200-s.camera*.25;box(x,195+(i%3)*38,90,320,ink+'65',14);}
    ctx.save();ctx.translate(-s.camera,0);
    for(const p of s.platforms){box(p.x,p.y,p.w,p.h,ground,5);box(p.x,p.y,p.w,6,mint,3);for(let x=p.x+8;x<p.x+p.w;x+=28)box(x,p.y+16,12,6,ink+'70',2);}
    for(const h of s.hazards){for(let i=0;i<3;i++){ctx.fillStyle='#fb9a9a';ctx.beginPath();ctx.moveTo(h.x+i*13,h.y+h.h);ctx.lineTo(h.x+i*13+6,h.y);ctx.lineTo(h.x+i*13+12,h.y+h.h);ctx.fill();}}
    s.items.forEach(i=>gem(i.x,i.y,i.taken));beacon(s.goal.x,s.goal.y);hero(s.player);ctx.restore();
  } else if(['explore','stealth','tactics'].includes(s.genre)){
    for(let x=55;x<910;x+=48)for(let y=70;y<475;y+=48)box(x,y,45,45,((x+y)%96)?'#ffffff05':'#ffffff09',5);
    for(const w of s.walls){box(w.x-3,w.y+5,w.w+6,w.h,ink+'99',5);box(w.x,w.y,w.w,w.h,ground,5);box(w.x,w.y,w.w,5,mint+'99',2);}
    for(const e of s.enemies){if(e.health<=0)continue;if(s.genre==='stealth'){circle(e.x,e.y,68,'#f8909325');circle(e.x,e.y,38,'#f8909325');}sprite('enemy',e.x-17,e.y-17,34,34,'#f398a2');}
    s.items.forEach(i=>gem(i.x,i.y,i.taken));beacon(s.goal.x,s.goal.y);hero(s.player);
    if(s.pulse||s.scan){ctx.strokeStyle=mint+'77';ctx.lineWidth=3;ctx.beginPath();ctx.arc(s.player.x+14,s.player.y+16,s.pulse?180:110,0,Math.PI*2);ctx.stroke();}
  } else if(s.genre==='shooter'){
    for(let i=0;i<50;i++)box((i*137)%960,70+(i*83+s.time*30)%420,2,8,'#c0e8ff50');
    s.enemies.forEach(e=>sprite('enemy',e.x-25,e.y-24,50,48,'#f398a2'));
    s.shots.forEach(p=>box(p.x-3,p.y-10,6,20,p.friendly?mint:'#ff9494',3));hero(s.player);
    text('CLEAR THE ORBITAL DRONES',480,510,13,mint,'center');
  } else if(s.genre==='defense'){
    for(let y=0;y<s.rows;y++)for(let x=0;x<s.cols;x++){const road=s.road.some(p=>p.x===x&&p.y===y);box(s.ox+x*s.cell+2,s.oy+y*s.cell+2,s.cell-4,s.cell-4,road?gold+'35':'#ffffff0c',7);if(!road)text('+',s.ox+(x+.5)*s.cell,s.oy+(y+.62)*s.cell,20,'#ffffff25','center');}
    for(const t of s.towers){circle(t.x,t.y,24,mint+'22');sprite('goal',t.x-22,t.y-25,44,45);text(t.level,t.x,t.y+29,12,mint,'center');if(t.beam)line(t.x,t.y,t.beam.x,t.beam.y,gold,3);}
    for(const e of s.enemies)sprite('enemy',e.x-18,e.y-18,36,36,'#ff9393');
    text(`GOLD ${s.gold}  ·  BUILD 10  ·  UPGRADE 8`,480,86,14,gold,'center');
  } else if(s.genre==='garden'){
    for(const p of s.plots){box(p.x-67,p.y-48,134,108,'#0d1d21aa',16);box(p.x-58,p.y-35,116,62,'#956b4b',10);for(let i=0;i<4;i++)line(p.x-48,p.y-22+i*12,p.x+48,p.y-22+i*12,'#4f3a31',3);
      if(p.stage===1){circle(p.x,p.y,7,gold);text('WATER',p.x,p.y+48,12,mint,'center');}
      else if(p.stage===2){const h=15+p.growth*13;line(p.x,p.y+16,p.x,p.y-h,mint,5);circle(p.x-12,p.y-h+15,12,mint);circle(p.x+10,p.y-h+6,11,mint);if(p.growth>=3)circle(p.x,p.y-h,15,gold);text(p.growth>=3?'HARVEST':'GROWING',p.x,p.y+48,12,gold,'center');}
      else text(p.stage===3?'HARVESTED':'PLANT',p.x,p.y+47,12,p.stage===3?mint:'#d5dfd8','center');}
  } else if(s.genre==='route'){
    const ports=[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]];
    s.tiles.forEach((mask,i)=>{const x=s.ox+(i%s.cols)*s.cell,y=s.oy+Math.floor(i/s.cols)*s.cell,cx=x+s.cell/2,cy=y+s.cell/2;box(x+3,y+3,s.cell-6,s.cell-6,'#08151bbb',9);const color=s.connected.includes(i)?gold:mint;
      for(const [dx,dy,bit] of ports)if(mask&bit)line(cx,cy,cx+dx*s.cell/2,cy+dy*s.cell/2,color,12);circle(cx,cy,10,color);circle(cx,cy,4,ink);
    });
    text('IN',s.ox-28,s.oy+(s.sourceRow+.5)*s.cell+5,15,gold,'right');text('OUT',s.ox+s.cols*s.cell+20,s.oy+(s.exitRow+.5)*s.cell+5,15,gold);
    text(`${s.moves} rotations · turn any tile`,480,486,14,mint,'center');
  } else if(s.genre==='production'){
    box(90,200,780,105,'#091821bb',20);for(let i=0;i<20;i++){const x=100+(i*42+s.time*65)%750;line(x,215,x+22,290,'#ffffff14',4);}box(200,195,290,115,mint+'16',16);
    text('DISPATCH ZONE',345,180,13,mint,'center');
    const colors=[mint,gold,'#c6a6fc'];for(const item of s.belt){box(item.x-25,230,50,50,colors[item.kind],10);text(item.kind+1,item.x,264,25,ink,'center');}
    for(let i=0;i<3;i++){box(220+i*180,380,155,92,s.selected===i?colors[i]:'#0b192bd9',14);text(`${i+1} · ${s.stationNames[i]}`,297+i*180,434,18,s.selected===i?ink:colors[i],'center');}
  } else if(s.genre==='strategy'){
    ['food','trust','gold'].forEach((key,i)=>{box(225+i*185,91,160,98,'#08151bbb',16);text(key.toUpperCase(),305+i*185,124,12,mint,'center');text(s.resources[key],305+i*185,167,34,gold,'center');});
    s.cards.forEach((c,i)=>{const x=150+i*230;box(x,230,210,180,'#0d1d30e8',17);box(x+1,230,208,5,i===s.selected?gold:mint,3);text(`POLICY 0${i+1}`,x+20,265,12,mint);text(c.name,x+20,310,18);text(c.detail,x+20,348,13,gold);text('Choose this policy →',x+20,384,12,'#c3d6da');});
    text('Each turn costs 1 food, 1 trust and 1 gold, plus a seasonal cost.',480,465,14,mint,'center');
  } else if(s.genre==='rhythm'){
    const colors=[mint,gold,'#c6a6fc','#f8a3cc'];for(let i=0;i<4;i++){box(242+i*120,80,116,395,'#091521b9',12);if(s.lastLane===i&&s.hitFlash>0)box(242+i*120,80,116,395,colors[i]+'33',12);text(i+1,300+i*120,505,24,colors[i],'center');}
    line(240,420,720,420,'#ffffff',4);for(const n of s.notes)box(260+n.lane*120,n.y-12,80,24,colors[n.lane],8);
    text(`COMBO ${s.combo}`,810,270,18,gold,'center');
  } else if(s.genre==='pong'){
    box(70,72,825,420,'#08151ba8',16);for(let y=90;y<480;y+=27)box(478,y,4,14,'#ffffff20',2);
    box(112,s.paddle-55,14,110,mint,7);box(876,77,8,410,gold,4);circle(s.ball.x,s.ball.y,10,'#ffffff');circle(s.ball.x-s.ball.vx*.03,s.ball.y-s.ball.vy*.03,7,'#ffffff30');
    if(s.serving)text('PRESS SERVE',480,205,24,gold,'center');
  } else if(s.genre==='pixel'){
    const colors=[ink,mint,gold,'#c6a6fc'];text('REFERENCE',205,120,13,mint,'center');
    s.reference.forEach((v,i)=>box(130+(i%6)*25,145+Math.floor(i/6)*25,24,24,colors[v],2));
    s.pixels.forEach((v,i)=>box(s.ox+(i%6)*s.cell+1,s.oy+Math.floor(i/6)*s.cell+1,s.cell-2,s.cell-2,colors[v],3));
    text('Choose a color below. Paint each cell.',520,475,14,mint,'center');
  }
  box(22,HEIGHT-28,916,20,'#06131a75',7);
  text(s.genre==='strategy'?`TURN ${s.turn} / 6`:s.genre==='route'?'CONNECT THE CIRCUIT':s.genre==='pixel'?'RESTORE THE PATTERN':`MISSION ${s.collected} / ${s.target}`,38,HEIGHT-13,11,mint);
  text('LOGICADE · CP1 ADVENTURES',920,HEIGHT-13,10,'#bbd0d0','right');
}
