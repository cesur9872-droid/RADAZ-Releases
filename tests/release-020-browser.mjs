// Synthetic records only; isolated browser and archive, including real Win32 maximization.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,rmSync,readFileSync,createWriteStream} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import dicomParser from 'dicom-parser';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const native=process.env.RADAZ_NATIVE_WINDOWS==='1';
const free=()=>new Promise(resolve=>{const s=http.createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
const root=mkdtempSync(path.join(tmpdir(),'radaz-020-browser-'));
mkdirSync('outputs/release-020',{recursive:true});
const fixture=spawn(process.env.PYTHON||'python',['tests/media-browser-fixture.py','--root',root],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let server,browser,fixtureErrors='';fixture.stderr.on('data',d=>fixtureErrors+=String(d));
try{
 const archivePort=await new Promise((resolve,reject)=>{let buffer='';const timer=setTimeout(()=>reject(Error(fixtureErrors)),20000);fixture.stdout.on('data',d=>{buffer+=d;if(buffer.includes('\n')){clearTimeout(timer);resolve(JSON.parse(buffer.split('\n')[0]).port);}});});
 await fetch(`http://127.0.0.1:${archivePort}/_test/archive`,{method:'POST'});
 const port=await free(),worker=await free(),base=`http://127.0.0.1:${port}`;
 server=spawn(process.execPath,['scripts/start-release.mjs'],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,RADAZ_PORT:String(port),RADAZ_WORKER_PORT:String(worker),RADAZ_ARCHIVE_PORT:String(archivePort)}});
 const log=createWriteStream('outputs/release-020/server.log');server.stdout.pipe(log);server.stderr.pipe(log);
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await delay(200);}
 browser=await chromium.launch({headless:!native,channel:'msedge',args:native?['--window-position=-2400,0']:[]});
 const context=await browser.newContext({viewport:{width:1440,height:900}}),errors=[];context.setDefaultTimeout(15000);
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route('**/local-archive-api/license',route=>route.fulfill({json:{valid:true,required:true,kind:'owner',message:'Synthetic license',deviceId:'TEST'}}));
 const file=readFileSync('tests/fixtures/demo/abdomen-1.dcm'),ds=dicomParser.parseDicom(new Uint8Array(file));
 const tag=id=>ds.string('x'+id.toLowerCase())||'',val=(v,vr='LO')=>({vr,Value:[v]});
 await context.route('**/synthetic-pacs/**',route=>{
  const pathname=new URL(route.request().url()).pathname;
  if(pathname.endsWith('/studies'))return route.fulfill({json:[{'0020000D':val(tag('0020000D'),'UI'),'00100010':val({Alphabetic:'SYNTHETIC^PACS'},'PN'),'00080020':val(tag('00080020'),'DA'),'00080061':val('CT'),'00081030':val('Native popup test'),'00201206':val(1,'IS'),'00201208':val(1,'IS')}]});
  if(pathname.endsWith('/series'))return route.fulfill({json:[{'0020000E':val(tag('0020000E'),'UI'),'00200011':val(2,'IS'),'00080060':val('CT'),'0008103E':val('Synthetic abdomen'),'00201209':val(1,'IS')}]});
  if(pathname.endsWith('/instances'))return route.fulfill({json:[{'00080018':val(tag('00080018'),'UI')}]});
  return route.fulfill({contentType:'application/dicom',body:file});
 });
 const viewer=await context.newPage();
 const registered=viewer.waitForResponse(r=>r.url().endsWith('/window/register'));await viewer.goto(base);
 if(native)assert.equal((await (await registered).json()).registered,true);
 await viewer.waitForFunction(()=>document.querySelector('.statusbar')?.textContent.includes('Cornerstone3D hazırdır'));
 const brand=viewer.locator('.brand');
 assert.equal(await brand.locator('img').count(),0);
 assert.equal(await brand.locator('.radaz-logo-letter').innerText(),'R');
 for(const width of [1440,1024,768]){
  await viewer.setViewportSize({width,height:900});
  assert.equal(await brand.locator('strong').isVisible(),true);
  assert.equal(await brand.locator('small').isVisible(),true);
  assert.equal(await brand.locator('small').innerText(),'RADIOLOGY, CONNECTED');
 }
 await viewer.setViewportSize({width:1440,height:900});
 const windowState=async tab=>{const cdp=await context.newCDPSession(tab);try{return(await cdp.send('Browser.getWindowForTarget')).bounds.windowState;}finally{await cdp.detach();}};
 const verifyMaximized=async(popup,open)=>{
  await popup.evaluate(()=>window.opener=null);
  const previous=await windowState(popup);
  if(native){const cdp=await context.newCDPSession(viewer);const {windowId}=await cdp.send('Browser.getWindowForTarget');await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});await cdp.detach();}
  const [response]=await Promise.all([viewer.waitForResponse(r=>r.url().endsWith('/window/maximize')),open()]);
  assert.equal(response.status(),200);
  if(native){assert.equal((await response.json()).maximized,true);await viewer.waitForFunction(()=>document.hasFocus());}
  if(native){for(let i=0;i<30&&(await windowState(viewer))!=='maximized';i++)await delay(100);assert.equal(await windowState(viewer),'maximized');assert.equal(await windowState(popup),previous);}
 };
 let created=context.waitForEvent('page');await viewer.getByRole('button',{name:'Local arxiv',exact:true}).click();const archive=await created;
 await archive.getByRole('checkbox',{name:'Bu gün',exact:true}).uncheck();
 await verifyMaximized(archive,()=>archive.getByRole('cell').filter({hasText:'TEST PATIENT 1'}).dblclick());
 await viewer.waitForFunction(()=>document.querySelector('[data-panel="A"] .top-left')?.textContent.includes('TEST PATIENT 1'));
 assert.equal(context.pages().length,2);
 console.log('PASS: archive double-click reuses and maximizes Viewer, preserves its own window, including null opener');
 await viewer.bringToFront();
 for(const [key,label] of [['o','Ox (Arrow)'],['q','Qələm (Pencil)'],['k','3D kursor']]){
  await viewer.keyboard.press(key);await viewer.getByRole('button',{name:'Ölçmə alətləri',exact:true}).click();
  assert.match(await viewer.locator('.menu-selected').innerText(),new RegExp(label.replace(/[()]/g,'\\$&')));
  await viewer.keyboard.press('Escape');
 }
 await viewer.keyboard.press('n');await viewer.getByRole('button',{name:'Pozitiv, neqativ və window',exact:true}).click();
 assert.match(await viewer.getByRole('menuitem',{name:/Neqativ \/ pozitiv/}).innerText(),/✓/);await viewer.keyboard.press('Escape');
 await viewer.keyboard.press('n');await viewer.getByRole('button',{name:'Pozitiv, neqativ və window',exact:true}).click();
 assert.doesNotMatch(await viewer.getByRole('menuitem',{name:/Neqativ \/ pozitiv/}).innerText(),/✓/);await viewer.keyboard.press('Escape');
 await viewer.screenshot({path:'outputs/release-020/viewer-wordmark.png'});
 console.log('PASS: N/O/Q/K actions and readable HTML/CSS wordmark at 1440, 1024 and 768 pixels');
 created=context.waitForEvent('page');await viewer.getByRole('button',{name:'PACS müayinələri',exact:true}).click();const pacs=await created;
 pacs.on('close',()=>console.log('PACS popup closed'));pacs.on('crash',()=>console.log('PACS renderer crashed'));
 pacs.on('requestfailed',request=>console.log('PACS failed request',request.url(),request.failure()?.errorText));
 await pacs.getByRole('button',{name:'PACS konfiqurasiyasını aç',exact:true}).click();
 await pacs.getByLabel('PACS təsviri',{exact:true}).fill('Synthetic only');
 await pacs.getByLabel('PACS DICOMweb URL',{exact:true}).fill(base+'/synthetic-pacs');
 await pacs.getByRole('button',{name:'Yadda saxla və bağla',exact:true}).click();
 await pacs.getByRole('checkbox',{name:'Bu gün',exact:true}).uncheck();
 await pacs.getByRole('button',{name:'Axtar',exact:true}).click();
 await pacs.getByRole('cell',{name:'SYNTHETIC PACS',exact:true}).waitFor();
 await verifyMaximized(pacs,()=>pacs.getByRole('cell',{name:'SYNTHETIC PACS',exact:true}).dblclick());
 assert.equal(context.pages().length,3);
 console.log('PASS: PACS download/double-click maximizes Viewer without minimizing its popup');
 assert.deepEqual(errors,[]);
}catch(error){
 console.error(error);
 for(const [i,page] of(browser?.contexts()[0]?.pages()||[]).entries()){
  console.error('PAGE',i,await page.locator('body').innerText().catch(()=>''));
  await page.screenshot({path:`outputs/release-020/failure-${i}.png`}).catch(()=>{});
 }
 throw error;
}finally{
 await browser?.close();
 for(const child of [server,fixture])if(child?.pid)spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
 assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'radaz-020-browser-'));rmSync(root,{recursive:true,force:true});
}
