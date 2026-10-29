import {CELL,CROPS,ready} from './field-state.js';
export function drawFarm(ctx,s,hover){
  const box=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  const circle=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
  const label=(text,x,y,color='#355138',size=12)=>{ctx.fillStyle=color;ctx.font=`600 ${size}px system-ui`;ctx.textAlign='center';ctx.fillText(text,x,y);};
  box(0,0,960,640,'#91b777');
  for(let y=0;y<16;y++)for(let x=0;x<24;x++){box(x*40,y*40,40,40,(x*7+y*11)%5===0?'#9bbf80':'#93b979');if((x*3+y)%7===0){box(x*40+10,y*40+21,2,5,'#7ca663');box(x*40+16,y*40+23,2,4,'#7ca663');}}
  box(40,200,880,40,'#cfbf91');box(240,120,40,440,'#cfbf91');box(280,400,560,40,'#cfbf91');box(800,200,40,280,'#cfbf91');
  for(let x=0;x<960;x+=40){box(x+5,17,5,20,'#8b7952');box(x,22,40,5,'#c6b57f');box(x+5,607,5,20,'#8b7952');box(x,614,40,5,'#c6b57f');}
  box(597,237,166,166,'#648f7c');box(603,243,154,154,'#79b7bb');
  for(let y=0;y<4;y++)for(let x=0;x<3;x++){const xx=617+x*46+Math.sin(s.time+y)*3,yy=263+y*34;box(xx,yy,21,2,'#b4d9c7');}circle(735,370,9,'#94b75c');circle(623,277,8,'#91b75c');
  const house=(x,y,name,roof)=>{box(x,y+27,120,62,'#f2e4ba');box(x-6,y+20,132,15,roof);ctx.fillStyle=roof;ctx.beginPath();ctx.moveTo(x-8,y+20);ctx.lineTo(x+60,y-17);ctx.lineTo(x+128,y+20);ctx.fill();box(x+46,y+51,27,38,'#796a4a');box(x+12,y+43,23,23,'#91bcb9');box(x+84,y+43,23,23,'#91bcb9');label(name,x+60,y+108);};
  house(80,75,'HOME · REST','#a77255');house(760,75,'MARKET · SEEDS','#6d8f76');
  box(202,166,36,15,'#92724e');box(207,181,5,17,'#6d6043');box(228,181,5,17,'#6d6043');label('CRAFT',220,157,'#355138',10);
  circle(220,344,18,'#677a76');circle(220,340,12,'#75b7bd');box(200,316,40,6,'#a98a5a');box(202,310,4,29,'#87724f');box(234,310,4,29,'#87724f');label('WELL',220,380,'#355138',10);
  label('0',340,228);for(let c=1;c<5;c++)label(String(c),340+c*40,228);
  for(let r=0;r<3;r++)label(String(r),306,267+r*40);
  for(const p of s.plots){const x=p.x*40,y=p.y*40;box(x+1,y+1,38,38,p.wet>0?'#796248':'#ab8659');for(let n=0;n<3;n++)box(x+4,y+9+n*9,32,2,p.wet>0?'#6b553e':'#987346');if(p.crop){const growth=Math.min(1,p.growth/CROPS[p.crop].seconds);box(x+18,y+16-growth*6,4,17,'#44733c');circle(x+12,y+20,5+growth*3,'#5d8e47');circle(x+26,y+16,4+growth*3,'#6e9e4e');if(growth>.4)circle(x+20,y+26,4+growth*6,CROPS[p.crop].color);if(ready(p)){label('✦',x+32,y+10,'#fff3ac',15);}else{box(x+4,y+34,32,3,'#584d38');box(x+4,y+34,32*growth,3,'#c7d597');}}}
  for(const d of s.devices){const x=d.x*40+20,y=d.y*40+20;if(d.type==='sprinkler'){box(x-3,y-12,6,25,'#6b8d93');box(x-13,y-12,26,5,'#b9d6ce');if(d.timer>6){ctx.strokeStyle='#b4e0df88';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,45+(8-d.timer)*8,0,Math.PI*2);ctx.stroke();}}else{box(x-3,y-12,6,30,'#9a7850');box(x-15,y-7,30,6,'#8b9571');circle(x,y-17,9,'#e4c58b');box(x-13,y-25,26,5,'#a38253');}}
  for(const r of s.resources){const x=r.x*40+20,y=r.y*40+20;if(r.type==='wood'){box(x-5,y-8,10,24,'#89704d');if(r.left){circle(x,y-23,24,'#4c7b4b');circle(x-12,y-16,16,'#5a8951');circle(x+10,y-29,16,'#608e53');}}else{circle(x,y+6,r.left?16:7,'#8e9b94');if(r.left){circle(x-3,y,12,'#aab5a9');box(x+3,y-6,7,3,'#d1d7c7');}}label(`${r.type} ${r.left}`,x,y+32,'#496241',9);}
  const person=(actor,color,name)=>{const x=actor.x*40+20,y=actor.y*40+20,bob=actor.path.length?Math.sin(s.time*17)*2:0;ctx.fillStyle='#2b503a33';ctx.beginPath();ctx.ellipse(x,y+13,13,5,0,0,Math.PI*2);ctx.fill();box(x-8,y-2+bob,16,16,color);box(x-7,y+12+bob,5,6,'#45584b');box(x+2,y+12-bob,5,6,'#45584b');circle(x,y-10+bob,9,'#edcba1');box(x-11,y-18+bob,22,5,color);box(x+3,y-12+bob,2,2,'#384b3b');label(name,x,y-29,'#244331',10);};
  person({x:20,y:11,path:[]},'#a77886','ADA ♡ '+s.orders.friendship);
  if(s.helper.path.length){ctx.strokeStyle='#f1f7c299';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(s.helper.x*40+20,s.helper.y*40+20);for(const p of s.helper.path)ctx.lineTo(p.x*40+20,p.y*40+20);ctx.stroke();ctx.setLineDash([]);}
  person(s.player,'#d8ac50','YOU');person(s.helper,'#659fb2','HELPER');
  if(hover){ctx.strokeStyle='#fff9c6';ctx.lineWidth=3;ctx.strokeRect(hover.x*40+2,hover.y*40+2,36,36);const p=s.plots.find(p=>p.x===hover.x&&p.y===hover.y);if(p){const text=`(${p.row}, ${p.col}) ${p.crop?ready(p)?'Ready to harvest':`${p.crop} · ${Math.floor(p.growth/CROPS[p.crop].seconds*100)}% · ${p.wet>0?'wet':'dry'}`:'empty'}`;box(hover.x*40-40,hover.y*40-29,170,22,'#294b3eef');label(text,hover.x*40+45,hover.y*40-14,'#f3f5d9',10);}}
  label('LITTLE LOOP FARM',480,590,'#4e7046',13);label('Grow • gather • craft • trade • automate',480,610,'#5d7b50',10);
}
