import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, rmSync, createWriteStream} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
const {chromium} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const free = () => new Promise(resolve => { const s=http.createServer(); s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));}); });
const root = mkdtempSync(path.join(tmpdir(), 'radaz-media-browser-'));
mkdirSync('outputs/media', {recursive:true});
const fixture = spawn(process.env.PYTHON || 'python', ['tests/media-browser-fixture.py','--root',root], {windowsHide:true,stdio:['ignore','pipe','pipe']});
let fixtureErrors=''; fixture.stderr.on('data',d=>fixtureErrors+=String(d));
let server, browser, page;
try {
  const archivePort = await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Fixture timeout: '+fixtureErrors)),30000);
    let buffer='';fixture.stdout.on('data',d=>{buffer+=d; if(buffer.includes('\n')){clearTimeout(timeout);try{resolve(JSON.parse(buffer.split('\n')[0]).port);}catch(e){reject(e);}}});
    fixture.once('exit',code=>{clearTimeout(timeout);reject(Error('Fixture stopped '+code+': '+fixtureErrors));});
  });
  const control = async action => {const r=await fetch(`http://127.0.0.1:${archivePort}/_test/${action}`,{method:'POST'});assert.equal(r.status,200);};
  const port=await free(), worker=await free(), base=`http://127.0.0.1:${port}`;
  server=spawn(process.execPath,['scripts/start-release.mjs'],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,RADAZ_PORT:String(port),RADAZ_WORKER_PORT:String(worker),RADAZ_ARCHIVE_PORT:String(archivePort)}});
  const log=createWriteStream('outputs/media/browser-server.log');server.stdout.pipe(log);server.stderr.pipe(log);
  for(let i=0;i<100;i++){try{if((await fetch(base)).status===200)break;}catch{}await delay(200);}
  browser=await chromium.launch({headless:true,channel:'msedge'});
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  await context.route('**/local-archive-api/license',route=>route.fulfill({json:{valid:true,required:true,kind:'owner',message:'Synthetic license',deviceId:'TEST'}}));
  page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];let pickers=0,imports=0;
  context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));});page.on('pageerror',e=>errors.push(e.message));
  page.on('filechooser',()=>pickers++);
  context.on('request',r=>{if(r.url().endsWith('/local-archive-api/import'))imports++;});
  await page.goto(base);await page.getByRole('button',{name:'CD/DVD import',exact:true}).click();
  await page.getByText('CD/DVD gözlənilir…',{exact:true}).waitFor();
  await control('insert');
  console.log('Inserted synthetic CD');
  await page.locator('.series-card').filter({hasText:'CD progressive CT'}).waitFor();
  await page.locator('.series-card').filter({hasText:'CD progressive CT'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-panel="A"] .overlay.bottom-right')?.textContent.includes('/ 19'));
  assert.match(await page.locator('.media-import-progress').textContent(),/20 \/ \d+/);
  assert.equal(await page.locator('.series-card').filter({hasText:'CD progressive CT'}).locator('img').count(),1);
  const before = await page.locator('[data-panel="A"] .overlay.bottom-right').textContent();
  const panel=page.locator('[data-panel="A"]');await panel.hover();await page.mouse.wheel(0,120);await delay(300);
  const scrolled=await page.locator('[data-panel="A"] .overlay.bottom-right').textContent();assert.notEqual(scrolled,before);
  await page.screenshot({path:'outputs/media/progressive-first-images.png'});
  console.log('First 19 slices are usable before remaining files load');
  await control('resume');
  await page.waitForFunction(()=>document.querySelector('.media-import-progress')?.textContent.includes('701 / 701'),{},{timeout:90000});
  console.log('All CT and JPEG instances loaded');
  assert.equal(await page.locator('.media-import-progress').getByText(/oxunmadı/).count(),0);
  assert.match(await page.locator('[data-panel="A"] .overlay.bottom-right').textContent(),/İmage 2 \/ 700/);
  await page.locator('.series-card').filter({hasText:'JPEG compressed CD'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-panel="A"] .overlay.top-right')?.textContent.includes('JPEG compressed CD'));
  assert.equal(await page.locator('[data-panel="A"] .viewport-error').count(),0);
  await page.locator('.series-card').filter({hasText:'CD progressive CT'}).click();
  const mprPromise=context.waitForEvent('page'); await page.getByRole('button',{name:'MPR rekonstruksiya',exact:true}).click();const mpr=await mprPromise;
  await mpr.locator('[data-panel="MA"] .overlay.bottom-right').waitFor({timeout:90000});
  console.log('MPR opened from media session');
  const volumePromise=context.waitForEvent('page');await page.getByRole('button',{name:'3D həcm görüntüləmə',exact:true}).click();const volume=await volumePromise;
  await volume.locator('.cornerstone-volume-stage canvas').waitFor({timeout:90000});
  console.log('3D opened from media session');
  const reportPromise=context.waitForEvent('page');await page.getByRole('button',{name:'Radioloji hesabat',exact:true}).click();const report=await reportPromise;
  await report.locator('.report-study').first().waitFor({timeout:30000});
  await page.screenshot({path:'outputs/media/loaded-700.png'});
  const archive=await (await fetch(`http://127.0.0.1:${archivePort}/status`)).json();assert.equal(archive.instanceCount,0);assert.equal(imports,0);assert.equal(pickers,0);
  assert.equal(await page.evaluate(async()=>{const databases=await indexedDB.databases();if(!databases.some(d=>d.name==='radaz-local-archive'))return 0;return new Promise((resolve,reject)=>{const r=indexedDB.open('radaz-local-archive');r.onsuccess=()=>{const db=r.result;const count=db.transaction('instances').objectStore('instances').count();count.onsuccess=()=>{resolve(count.result);db.close();};count.onerror=reject;};});}),0);
  await control('eject');
  await page.waitForFunction(()=>document.querySelectorAll('.series-card').length===0);
  await mpr.waitForFunction(()=>document.querySelectorAll('[data-panel]').length===0);
  await volume.waitForFunction(()=>document.querySelectorAll('.cornerstone-volume-stage canvas').length===0);
  await report.waitForFunction(()=>document.querySelectorAll('.report-study').length===0);
  await page.screenshot({path:'outputs/media/ejected-clean.png'});
  // Reinsert, then eject during the deliberately blocked transfer.
  await control('insert');await page.locator('.series-card').filter({hasText:'CD progressive CT'}).waitFor();await page.locator('.series-card').filter({hasText:'CD progressive CT'}).click();await page.waitForFunction(()=>document.querySelector('[data-panel="A"] .overlay.bottom-right')?.textContent.includes('/ 19'));
  await control('eject');await page.waitForFunction(()=>document.querySelectorAll('.series-card').length===0);await delay(1000);
  assert.equal(await page.locator('.series-card').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: 700 CT slices progressive, raw/extensionless/JPEG import, scroll preserved, MPR/3D/report eject cleanup, mid-transfer eject, no archive writes or pickers.');
} catch(error) {
  for (const [i,p] of (browser?.contexts()[0]?.pages() || []).entries()) {
    console.error(`PAGE ${i} ${p.url()}:`,await p.locator('body').innerText().catch(()=>''));
    await p.screenshot({path:`outputs/media/failure-${i}.png`}).catch(()=>{});
  }
  if(page){ console.error('UI:',await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:'outputs/media/failure.png'}).catch(()=>{}); }
  throw error;
} finally {
  await browser?.close();
  for(const process of [server,fixture]) if(process?.pid)spawnSync('taskkill.exe',['/PID',String(process.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'radaz-media-browser-'));rmSync(root,{recursive:true,force:true});
}
