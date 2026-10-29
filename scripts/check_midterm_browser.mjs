import {createRequire} from 'node:module';
import path from 'node:path';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(path.join(process.env.LOGICADE_NODE_MODULES||process.cwd(),'package.json')),{chromium}=require('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const ctx=await browser.newContext({viewport:{width:1280,height:800}});await ctx.addInitScript(()=>localStorage.setItem('logicade_session_token','test-session-no-real-account'));
 await mkdir('.state',{recursive:true});const sentinel=path.resolve('.state',`midterm-privacy-check-${Date.now()}.txt`);await writeFile(sentinel,'test-only-private-sentinel',{flag:'wx'});
 try{for(const file of [sentinel,sentinel.replace('.state','.STATE')]){const response=await ctx.request.get('http://127.0.0.1:5174/@fs/'+file.replaceAll('\\','/'));assert.equal(response.status(),403,'Private state must not be served by Vite.');}}finally{await unlink(sentinel);}
 const page=await ctx.newPage(),errors=[],posted=[];let starts=0,submissions=0;page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/course/midterm',async route=>{if(route.request().method()==='GET'){starts++;return route.fulfill({json:{bank:{id:'test-bank',version:'1',title:'Test midterm fixture',items:[{id:'order',format:'choice',prompt:'Select the test sequence',choices:['A','B']},{id:'output',format:'numeric',prompt:'Predict the test output'}]},attempt_token:'test-attempt-session-'+starts}});}
  posted.push(route.request().postDataJSON());submissions++;return submissions===1?route.fulfill({status:503,json:{detail:'Test storage unavailable; retry your saved answers.'}}):route.fulfill({json:{assessment_id:'test-grade',score:2,maximum_score:2,passed:null,formal_assessment:true}});});
 await page.goto('http://127.0.0.1:5174/tests/browser/midterm.html',{waitUntil:'networkidle'});await page.getByRole('radio').nth(1).check();await page.getByLabel('Predict the test output').fill('7');await page.getByRole('button',{name:'Submit assessment',exact:true}).click();await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/storage unavailable/);
 const token=posted[0].attempt_token;await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByRole('radio').nth(1).isChecked(),true);assert.equal(await page.getByLabel('Predict the test output').inputValue(),'7');await page.getByRole('button',{name:'Submit assessment',exact:true}).click();await page.getByRole('status').waitFor();assert.match(await page.getByRole('status').innerText(),/2\/2/);
 assert.equal(posted[1].attempt_token,token);assert.deepEqual(Object.keys(posted[1]).sort(),['answers','attempt_token']);assert.deepEqual(errors,[]);
 await mkdir('artifacts/canvas-browser/midterm',{recursive:true});await page.screenshot({path:'artifacts/canvas-browser/midterm/trusted-assessment-ui.png'});await writeFile('artifacts/canvas-browser/midterm/results.json',JSON.stringify({fixtureOnly:true,restoredAnswers:true,idempotentRetryToken:true,serverResultDisplayed:true,errors},null,2));
 await page.getByRole('button',{name:'Return to game'}).click();await page.getByText('Assessment closed').waitFor();console.log('Formal assessment UI: response failure, draft restoration, identical retry token, server result and close passed (mock API; no study writes).');
}finally{await browser.close();}
