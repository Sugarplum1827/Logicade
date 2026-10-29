// Real controls and simulated production, isolated from student accounts and database writes.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {codeTask} from '../game-platform/src/education/Lessons.js';
import {reviewItems} from '../game-platform/src/education/Review.js';
const require=createRequire(path.join(process.env.LOGICADE_NODE_MODULES||process.cwd(),'package.json')),{chromium}=require('playwright');
const base=process.env.LOGICADE_PREVIEW_URL||'http://127.0.0.1:8126';
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
await mkdir('artifacts/automation',{recursive:true});
const smoke=process.env.LOGICADE_FACTORY_SMOKE==='1';
try{for(const scenario of [{variation:1,difficulty:'standard',week:1,width:1440,height:900},{variation:7,difficulty:'advanced',week:3,width:1280,height:720},{variation:3,difficulty:'needs_support',week:6,width:1024,height:768},...[2,4,5,7,8,9].map(week=>({variation:1,difficulty:'standard',week,width:1280,height:720}))].filter(s=>!smoke||[1,3,6].includes(s.week))){
 const context=await browser.newContext({viewport:scenario}),page=await context.newPage(),errors=[],bad=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
 await page.goto(`${base}/canvas-runtime/index.html?game=platformer&variation=${scenario.variation}&difficulty=${scenario.difficulty}&week=${scenario.week}&mode=lesson`,{waitUntil:'networkidle'});await page.getByRole('region',{name:'Machine workbench'}).waitFor();
 const dir=`${base}/canvas-runtime/games/automation/variations/variation_${String(scenario.variation).padStart(2,'0')}/`,config=await(await context.request.get(dir+'config.json')).json(),profile=await(await context.request.get(dir+scenario.difficulty+'.json')).json();
 const click=async m=>{const r=await page.locator('#game').boundingBox();await page.mouse.click(r.x+(22+(m.x+.5)*58)*r.width/1280,r.y+(190+(m.y+.5)*58)*r.height/720);};
 if(scenario.week===2)profile.branching=true;
 if(scenario.week===4){await page.getByRole('button',{name:'Manual / course',exact:true}).click();for(const title of ['Origins','Language and execution','Uses and trade-offs'])await page.getByRole('button',{name:'Restore archive: '+title,exact:true}).click();}
 if([5,6,7,8].includes(scenario.week)){await page.getByRole('button',{name:'Execute C on power station'}).click();assert.match(await page.getByRole('alert').innerText(),/Line|output|scope/i);await page.getByRole('textbox',{name:'C machine-control program'}).fill(codeTask(scenario.week,scenario.variation,scenario.difficulty).solution);await page.getByRole('button',{name:'Execute C on power station'}).click();assert.match(await page.getByRole('alert').innerText(),/power station/);}
 await page.getByRole('button',{name:'Relay program',exact:true}).click();await page.getByLabel('Construction tool').selectOption('belt');let direction='E';
 for(const index of profile.missingBelts){const m=config.machines[index];while(direction!==m.dir){await page.getByRole('button',{name:/Rotate/}).click();direction={E:'S',S:'W',W:'N',N:'E'}[direction];}await click(m);}
 if(profile.disconnectPower){await page.getByLabel('Construction tool').selectOption('wire');const link=config.wires.at(-1);for(const id of link)await click(config.machines[Number(id.slice(1))]);}
 await page.getByLabel('Construction tool').selectOption('inspect');const controller=config.machines.find(m=>m.type==='controller');await click(controller);
 await page.getByRole('textbox',{name:'Machine program',exact:true}).fill('READ\nROUTE W\nYIELD');await page.getByRole('button',{name:'Apply to selected controller'}).click();await page.getByLabel('Simulation speed').selectOption('3');await page.getByRole('button',{name:'Run line',exact:true}).click();await page.waitForTimeout(1700);await page.getByRole('button',{name:'Pause line',exact:true}).click();assert.match(await page.locator('.wb-objective').innerText(),/Circuits 0\//);
 await page.getByRole('textbox',{name:'Machine program',exact:true}).fill(`READ\nROUTE ${controller.dir}\n${profile.branching?'WHEN copper ROUTE S\n':''}COUNT\nYIELD`);await page.getByRole('button',{name:'Apply to selected controller'}).click();await page.getByRole('button',{name:'Test input / output'}).click();assert.match(await page.getByRole('alert').innerText(),/PASS/);await page.getByRole('button',{name:'Single step',exact:true}).click();await page.getByRole('button',{name:'Run line',exact:true}).click();
 if(scenario.week===9){await page.getByRole('button',{name:'Manual / course',exact:true}).click();await page.getByRole('button',{name:'Open midterm practice / instructor assessment',exact:true}).click();for(const item of reviewItems)await page.getByRole('button',{name:item.options[item.answer],exact:true}).click();await page.getByRole('button',{name:'Return to game',exact:true}).click();}
 await page.waitForFunction(target=>document.querySelector('.wb-objective').textContent.includes(`Circuits ${target}/${target}`),profile.target,{timeout:25000});assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);await page.screenshot({path:`artifacts/automation/week-${scenario.week}.png`});results.push({...scenario,production:true,wrongProgramBlocked:true,errors});await context.close();
}await writeFile(smoke?'artifacts/automation/smoke-results.json':'artifacts/automation/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({passed:results.length,results},null,2));}finally{await browser.close();}
