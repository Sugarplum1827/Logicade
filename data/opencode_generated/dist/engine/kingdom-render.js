import {slots,TYPES} from './kingdom-state.js';
const COLORS={arrow:'#f7e5ae',frost:'#8ae2ec',cannon:'#ff9b5d'};
export function drawKingdom(ctx,s,hover,selected){
 const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
 const circle=(x,y,r,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
 const text=(v,x,y,color='#eef0d9',size=11,align='center')=>{ctx.fillStyle=color;ctx.font=`700 ${size}px system-ui`;ctx.textAlign=align;ctx.fillText(v,x,y);};
 const g=ctx.createLinearGradient(0,0,0,600);g.addColorStop(0,'#90ad77');g.addColorStop(.48,'#769761');g.addColorStop(1,'#526c50');rect(0,0,960,600,g);
 for(let y=0;y<600;y+=32)for(let x=0;x<960;x+=43){const h=(x*7+y*11)%17;circle(x+14,y+12,1+(h%2),'#ffffff13');rect(x+22,y+20,2,4,'#344d3217');}
 // Distant ridges and an original, hand-drawn kingdom backdrop.
 ctx.fillStyle='#66805c';ctx.beginPath();ctx.moveTo(0,112);for(let x=0;x<=960;x+=80)ctx.lineTo(x,56+((x*5)%67));ctx.lineTo(960,0);ctx.lineTo(0,0);ctx.fill();
 for(let lane=0;lane<3;lane++){const y=[130,300,470][lane];rect(0,y-37,960,74,lane===1?'#bcae84':'#b6aa80');rect(0,y-4,960,8,'#8b8267');for(let x=0;x<960;x+=40){circle(x+12,y+18,2,'#887c5c');circle(x+30,y-18,2,'#887c5c');}text(['NORTH ROAD','MIDDLE ROAD','SOUTH ROAD'][lane],946,y-43,'#eae7c4',9,'right');
   for(let c=0;c<3;c++){const p=slots()[lane][c];const open=c<2||s.expanded;if(!open){circle(p.x,p.y,26,'#263b334d');text('LOCK',p.x,p.y+3,'#c4c5a5',8);continue;}circle(p.x,p.y,25,'#425944');circle(p.x,p.y,20,s.towers.some(t=>t.lane===lane&&t.col===c)?'#d0b479':hover?.lane===lane&&hover?.col===c?'#d5daa2':'#9ea877');if(hover?.lane===lane&&hover?.col===c||selected?.lane===lane&&selected?.col===c){ctx.strokeStyle='#fff3b5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,29,0,Math.PI*2);ctx.stroke();}const tower=s.towers.find(t=>t.lane===lane&&t.col===c);if(tower){rect(p.x-5,p.y-9,10,21,'#765640');rect(p.x-12,p.y-13,24,9,'#d4c08a');rect(p.x-9,p.y-25,18,14,'#627e6a');rect(p.x-5,p.y-30,10,7,'#ddc692');text(`Lv${tower.level}`,p.x,p.y+36,'#fbf1d2',8);}else text('＋',p.x,p.y+5,open?'#ecedca':'#8e9782',20);}}
 // Castle and three defended gates.
 rect(24,78,64,445,'#503f35');rect(30,78,52,445,'#d5c6a3');rect(24,65,18,29,'#866b50');rect(70,65,18,29,'#866b50');rect(37,78,38,24,'#997c58');rect(44,93,25,30,'#849179');rect(34,502,43,21,'#665344');text('THE KEEP',56,550,'#faf0ce',10);
 for(let l=0;l<3;l++){const y=[130,300,470][l];rect(68,y-22,28,44,'#887355');rect(73,y-18,18,36,'#dbc796');}
 for(const w of s.walls){const y=[130,300,470][w.lane];rect(w.x-7,y-31,13,62,'#705242');rect(w.x-13,y-20,26,8,'#c4a978');rect(w.x-13,y+3,26,8,'#c4a978');rect(w.x-17,y-39,34,4,'#352d25');rect(w.x-17,y-39,34*Math.max(0,w.hp/w.maxHp),4,'#bad18a');}
 for(const t of s.towers){const {x,y,lane}=t;circle(x,y+8,14,'#415641');rect(x-9,y-14,18,30,'#876647');rect(x-14,y-21,28,13,'#e0c997');rect(x-11,y-31,22,14,'#71886f');rect(x-8,y-37,16,8,'#e1d09f');rect(x-2,y-47,4,12,'#514735');rect(x-5,y-46,17,3,'#d5cd9c');text(`Lv${t.level}`,x,y+29,'#f9edcb',8);ctx.strokeStyle='#f5e5b14c';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,t.range,0,Math.PI*2);ctx.stroke();}
 for(const e of s.enemies){const x=e.x,y=[130,300,470][e.lane],b=e.slow>0?Math.sin(s.time*7)*2:Math.sin(s.time*11+e.id)*3,info=TYPES[e.type];circle(x,y+12,info.size*.75,'#222b375c');if(e.type===4){ctx.fillStyle=info.color;ctx.beginPath();ctx.ellipse(x-4,y-9+b,13,5,Math.sin(s.time*12)*.4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+5,y-9-b,13,5,-Math.sin(s.time*12)*.4,0,Math.PI*2);ctx.fill();}circle(x,y-2,info.size,info.color);circle(x-4,y-5,2,'#f5e8c7');circle(x+4,y-5,2,'#f5e8c7');rect(x-info.size,y-info.size-9,info.size*2,4,'#342d2b');rect(x-info.size,y-info.size-9,info.size*2*Math.max(0,e.hp/info.hp),4,e.slow>0?'#91e3e6':'#df8871');if(e.armor)rect(x-7,y+9,14,3,'#aab9bd');}
 for(const p of s.projectiles){circle(p.x,p.y-7,6,COLORS[p.ammo]);circle(p.x-3,p.y-7,3,'#fff7d8');}
 if(s.phase==='planning'||s.phase==='cleared')text(s.phase==='planning'?'PREPARE THE DEFENSE':'WAVE HELD · REPLAN YOUR KINGDOM',480,576,'#f2edc9',12);
 if(s.phase==='won')text('THE EASTERN MARCH IS SAFE',480,578,'#fbefbc',20);
 if(s.phase==='lost')text('THE KEEP HAS FALLEN · RETRY THE WAVE',480,578,'#fff1d8',16);
 if(s.phase==='error')text('ATTACK HELD · REPAIR YOUR POLICY',480,578,'#fff1d8',14);
 if(selected){const tower=s.towers.find(t=>t.lane===selected.lane&&t.col===selected.col);if(tower)text(`SELECTED WATCHTOWER · LANE ${tower.lane+1} · RANGE ${tower.range}`,480,27,'#eff0d1',10);}
}
