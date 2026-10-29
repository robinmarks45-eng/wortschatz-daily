import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {chromium}=require('/Users/captainhma/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.argv[2]||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage();

try{
 await page.goto(base,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelectorAll('tr[data-id]').length===68);
 assert.equal(await page.locator('#daySelect option').count(),6,'all six lessons should load');

 await page.selectOption('#daySelect','day6');
 await page.locator('tr[data-id="d6-067"]').click();
 assert.equal((await page.locator('.detail-word').innerText()).trim(),'der Fuß');
 assert.match(await page.locator('.detail-meaning').innerText(),/ခြေကျင်းဝတ်အောက်ပိုင်း/);
 assert.match(await page.locator('.play-both').innerText(),/Word \+ Forms/,'noun detail should offer word plus plural playback');
 await page.locator('[data-action="close"]').first().click();

 await page.selectOption('#daySelect','day1');
 await page.locator('tr[data-id="medical-d1-03"]').click();
 assert.equal(await page.locator('[data-say="forms"]').count(),1,'usable phrase forms should have a Forms button');
 await page.locator('[data-action="close"]').first().click();

 const preserved=await page.evaluate(async()=>{
  const open=()=>new Promise((resolve,reject)=>{const request=indexedDB.open('wortschatz-daily-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  const get=(db)=>new Promise((resolve,reject)=>{const request=db.transaction('data','readonly').objectStore('data').get('state');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  const put=(db,value)=>new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(value,'state');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  const db=await open(),state=await get(db);
  state.catalogRevisions.day2=2;
  state.words['d2-028'].translation='stale cached value';
  state.notes['d2-028']='keep this note';
  state.progress['d2-028']={status:'known',reps:2,goalMode:'active'};
  await put(db,state);db.close();return true;
 });
 assert.equal(preserved,true);
 await page.reload({waitUntil:'networkidle'});
 await page.waitForTimeout(700);
 const migrated=await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('wortschatz-daily-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  const state=await new Promise((resolve,reject)=>{const request=db.transaction('data','readonly').objectStore('data').get('state');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  db.close();
  return {revision:state.catalogRevisions.day2,translation:state.words['d2-028'].translation,note:state.notes['d2-028'],status:state.progress['d2-028'].status,goalMode:state.progress['d2-028'].goalMode};
 });
 assert.deepEqual(migrated,{revision:3,translation:'လူကြီးမင်းရဲ့သားက အသက်ရှစ်နှစ်ရှိပြီ။',note:'keep this note',status:'known',goalMode:'active'});
 console.log('PASS: browser loaded 408 words, detail/TTS controls work, and Day 2 revision preserved private state');
}finally{
 await browser.close();
}
