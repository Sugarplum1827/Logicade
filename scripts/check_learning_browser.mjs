import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {course,codeTask,createScout} from '../game-platform/src/education/Lessons.js';
import {reviewItems} from '../game-platform/src/education/Review.js';
const require=createRequire(path.join(process.env.LOGICADE_NODE_MODULES||process.cwd(),'package.json'));
const {chromium}=require('playwright'),base=process.env.LOGICADE_PREVIEW_URL||'http://127.0.0.1:8125',output=path.resolve('artifacts/canvas-browser/learning');
await mkdir(output,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
function route(s,from,to){const todo=[{...from,steps:[]}],seen=new Set();for(const p of todo){if(p.x===to.x&&p.y===to.y)return p.steps;for(const[name,dx,dy]of[['right',1,0],['down',0,1],['left',-1,0],['up',0,-1]]){const n={x:p.x+dx,y:p.y+dy},k=n.x+','+n.y;if(n.x<0||n.y<0||n.x>=6||n.y>=4||seen.has(k)||s.walls.some(w=>w.x===n.x&&w.y===n.y))continue;seen.add(k);todo.push({...n,steps:[...p.steps,name]});}}throw Error('No route');}
try{const ctx=await browser.newContext({viewport:{width:1280,height:720}});
 for(const lesson of course.weeks){const page=await ctx.newPage(),errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  await page.addInitScript(()=>{window.__drawnText={};const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,x,y,...rest){window.__drawnText[x+':'+y]=String(t);return original.call(this,t,x,y,...rest);};});
  await page.goto(`${base}/canvas-runtime/index.html?game=${lesson.genres[0]}&variation=1&difficulty=standard&week=${lesson.week}&mode=lesson`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('ready.'));await page.locator('#game').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('#status').textContent.includes('ready.'));
  if(lesson.week===1){await page.keyboard.press('l');await page.getByRole('dialog').waitFor();assert.match(await page.getByRole('dialog').innerText(),/not supplied/);assert.doesNotMatch(await page.getByRole('dialog').innerText(),/float energy/);await page.getByRole('button',{name:'Return to game'}).click();}
  else {await page.keyboard.down('d');await page.waitForTimeout(220);await page.keyboard.up('d');await page.keyboard.press('e');
   if([2,3].includes(lesson.week)){
    await page.waitForFunction(()=>Object.values(window.__drawnText).some(t=>t.startsWith('Scout planning')));
    const s=createScout(1),before={x:s.gate.x-1,y:s.gate.y},plan=[...route(s,s.start,s.key),...route(s,s.key,before),'use',...route(s,before,s.gate),...route(s,s.gate,s.goal)];
    for(const command of plan){await page.keyboard.press({left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',use:'e'}[command]);await page.waitForTimeout(25);}await page.keyboard.press('Enter');
    await page.waitForFunction(()=>Object.values(window.__drawnText).some(t=>t.includes('Your procedure worked.')));await page.screenshot({path:path.join(output,`week-${lesson.week}.png`)});await page.keyboard.press('Escape');
   }else if(lesson.week===4){for(let i=0;i<3;i++){await page.getByRole('button',{name:'Restore this archive beacon'}).click();if(i<2){await page.keyboard.down('d');await page.waitForTimeout(350);await page.keyboard.up('d');await page.keyboard.press('e');}}}
   else if(lesson.week<=8){const task=codeTask(lesson.week,1,'standard');await page.locator('#c-source').waitFor();await page.getByRole('button',{name:'Simulate program'}).click();assert.ok((await page.locator('.learning-panel [role=status]').innerText()).length>0);
    await page.locator('#c-source').fill(task.solution);await page.getByRole('button',{name:'Simulate program'}).click();assert.match(await page.locator('.learning-panel [role=status]').innerText(),/powers the beacon/);assert.match(await page.locator('#c-output').innerText(),/Program output/);await page.getByRole('button',{name:'Next trace statement'}).click();assert.match(await page.locator('#c-trace').innerText(),/Statement 2/);
    if(lesson.week===6){const colors=await page.locator('#game').evaluate(c=>{const data=c.getContext('2d').getImageData(0,200,100,250).data,set=new Set();for(let i=0;i<data.length;i+=80)set.add(data[i]+','+data[i+1]+','+data[i+2]);return set.size;});assert.ok(colors>10,'The teaching overlay must preserve the underlying game artwork.');}
    await page.screenshot({path:path.join(output,`week-${lesson.week}.png`)});await page.getByRole('button',{name:'Return to game'}).click();
    if(lesson.week===7){await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Saved run restored.'));}
   }else {for(const item of reviewItems){await page.getByRole('button',{name:item.options[item.answer],exact:true}).click();}assert.match(await page.getByRole('dialog').innerText(),/10\/10 correct/);await page.screenshot({path:path.join(output,'week-9.png')});await page.getByRole('button',{name:'Return to game'}).click();}
  }
  await page.waitForFunction(week=>Object.values(JSON.parse(localStorage.getItem('logicade_canvas_preview_progress_v1')).learning||{}).some(r=>r.week===week&&r.completed),lesson.week);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);results.push({week:lesson.week,mission:lesson.mission,passed:true});await page.close();
 }
 await writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({passed:results.length,output}));
}finally{await browser.close();}
