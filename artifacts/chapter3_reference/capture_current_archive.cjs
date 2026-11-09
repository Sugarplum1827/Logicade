const {chromium} = require('C:/Users/Shiela/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1050}});
 await page.goto('http://127.0.0.1:8219/',{waitUntil:'networkidle'});
 await page.locator('#stage').selectOption('4:1');
 await page.locator('#prepare').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Running'),{timeout:30000});
 await page.locator('iframe').evaluate(el=>{el.style.width='1280px';el.style.height='720px';});
 await page.waitForTimeout(2000);
 await page.locator('iframe').screenshot({path:path.resolve('artifacts/chapter3_reference/figures/current-five-object-archive.png')});
 console.log('Captured current archive from an isolated preview with no study records.');
 await page.locator('#release').click();
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
