import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import JSZip from 'jszip';
import { storedRar } from './rar-fixture.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const free = () => new Promise(resolve => { const server=http.createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));}); });
const root=mkdtempSync(path.join(tmpdir(),'radaz-import-workflow-'));
mkdirSync('outputs/import-workflow',{recursive:true});
const fixture=spawn(process.env.PYTHON || 'python',['tests/media-browser-fixture.py','--root',root],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let server,browser,fixtureErrors='';fixture.stderr.on('data',d=>fixtureErrors+=String(d));
try {
  const archivePort=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error(fixtureErrors || 'Fixture timeout')),30000);let output='';
    fixture.stdout.on('data',data=>{output+=data;if(output.includes('\n')){clearTimeout(timer);resolve(JSON.parse(output.split('\n')[0]).port);}});
    fixture.once('exit',code=>{clearTimeout(timer);reject(Error('Fixture exit '+code+' '+fixtureErrors));});
  });
  const backend=`http://127.0.0.1:${archivePort}`;
  const control=async action=>assert.equal((await fetch(backend+'/_test/'+action,{method:'POST'})).status,200);
  await control('archive');
  const dicoms=await Promise.all([1,2,3].map(async i=>Buffer.from(await (await fetch(backend+`/file/2.25.202.${i}`)).arrayBuffer())));
  assert.equal((await fetch(backend+'/studies/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studies:[1,2,3].map(i=>`2.25.200.${i}`)})})).status,200);
  const port=await free(),worker=await free(),base=`http://127.0.0.1:${port}`;
  server=spawn(process.execPath,['scripts/start-release.mjs'],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,RADAZ_PORT:String(port),RADAZ_WORKER_PORT:String(worker),RADAZ_ARCHIVE_PORT:String(archivePort)}});
  const log=createWriteStream('outputs/import-workflow/server.log');server.stdout.pipe(log);server.stderr.pipe(log);
  for(let i=0;i<150;i++){try{if((await fetch(base)).status===200)break;}catch{}await delay(200);}
  browser=await chromium.launch({headless:true,channel:'msedge'});
  const context=await browser.newContext({viewport:{width:1440,height:900}}),errors=[],requests=[];
  context.on('page',p=>{p.setDefaultTimeout(45000);p.on('pageerror',e=>errors.push(e.message));});
  context.on('request',r=>requests.push(r.url()));
  await context.route('**/local-archive-api/license',route=>route.fulfill({json:{valid:true,required:true,kind:'owner',message:'Synthetic license',deviceId:'TEST'}}));
  const page=await context.newPage();await page.goto(base);await page.locator('.statusbar').filter({hasText:'Cornerstone3D hazırdır'}).waitFor();
  const split=async()=>{await page.bringToFront();await page.locator('.brand').click();await page.keyboard.press('2');await page.waitForFunction(()=>document.querySelectorAll('.viewport[data-panel]').length===2);};
  const drop=async(target,selector,name,bytes,folder=false)=>target.evaluate(({selector,name,bytes,folder})=>{
    const file=new File([new Uint8Array(bytes)],name),transfer=new DataTransfer();transfer.items.add(file);
    if(folder){
      const leaf={isFile:true,file:resolve=>resolve(file)};
      const directory={isFile:false,createReader(){let read=false;return {readEntries(resolve){resolve(read?[]:[leaf]);read=true;}};}};
      Object.defineProperty(transfer.items[0],'webkitGetAsEntry',{value:()=>directory});
    }
    document.querySelector(selector).dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
  },{selector,name,bytes:[...bytes],folder});
  const loaded=async patient=>{
    await page.waitForFunction(expected=>document.querySelector('[data-panel="A"] .top-left')?.textContent.includes(expected),patient);
    await page.locator('.statusbar').filter({hasText:'local arxivdə saxlanıldı'}).waitFor();
    assert.equal(await page.locator('.viewport[data-panel]').count(),1,'New import resets split layout');
  };
  await split();await drop(page,'[data-panel="A"]','IMAGE001',dicoms[0]);await loaded('TEST PATIENT 1');
  await split();await drop(page,'[data-panel="A"] canvas','study.RAR',storedRar([['folder/IMAGE002',dicoms[1]]]));await loaded('TEST PATIENT 2');
  const zip=new JSZip();zip.file('nested/IMAGE003',dicoms[2]);
  await split();await drop(page,'.topbar','study.zip',await zip.generateAsync({type:'nodebuffer'}));await loaded('TEST PATIENT 3');
  await split();await drop(page,'[data-panel="A"]','IMAGE001',dicoms[0],true);await loaded('TEST PATIENT 1');
  assert.equal((await (await fetch(backend+'/status')).json()).instanceCount,3);
  console.log('DICOM, RAR, ZIP and folder drops import across the Viewer, persist and reset to 1x1');
  const newArchive=context.waitForEvent('page');await page.getByRole('button',{name:'Local arxiv',exact:true}).click();const archive=await newArchive;
  const archiveSearch=archive.getByRole('textbox',{name:'Bütün müayinələrdə axtar'});await archiveSearch.fill('TEST PATIENT');
  const count=context.pages().length;
  for(let i=0;i<2;i++){await page.bringToFront();await page.getByRole('button',{name:'Local arxiv',exact:true}).click();await delay(500);}
  assert.equal(context.pages().length,count);assert.equal(await archiveSearch.inputValue(),'TEST PATIENT');
  assert.ok((await archiveSearch.boundingBox()).width>220);
  await archive.getByRole('button',{name:'Arxiv axtarışını təmizlə'}).click();assert.equal(await archiveSearch.inputValue(),'');
  await archive.getByRole('checkbox',{name:'Bu gün',exact:true}).uncheck();
  await drop(archive,'.records-upper','archive.rar',storedRar([['nested/IMAGE001',dicoms[0]]]));
  await archive.getByRole('status').filter({hasText:'müayinə saxlanıldı'}).waitFor();
  await split();await archive.getByRole('cell').filter({hasText:'TEST PATIENT 2'}).dblclick();
  await page.waitForFunction(()=>document.querySelector('[data-panel="A"] .top-left')?.textContent.includes('TEST PATIENT 2'));
  assert.equal(await page.locator('.viewport[data-panel]').count(),1);
  const newPacs=context.waitForEvent('page');await page.getByRole('button',{name:'PACS müayinələri',exact:true}).click();const pacs=await newPacs;
  const pacsSearch=pacs.getByRole('textbox',{name:'PACS pasiyent axtarışı'});await pacsSearch.fill('PATIENT');
  const pacsCount=context.pages().length;
  await page.bringToFront();await page.getByRole('button',{name:'PACS müayinələri',exact:true}).click();await delay(500);
  assert.equal(context.pages().length,pacsCount);assert.equal(await pacsSearch.inputValue(),'PATIENT');
  assert.ok((await pacsSearch.boundingBox()).width>=220);
  await pacs.getByRole('button',{name:'PACS axtarışını təmizlə'}).click();assert.equal(await pacsSearch.inputValue(),'');
  await archive.screenshot({path:'outputs/import-workflow/archive.png'});await pacs.screenshot({path:'outputs/import-workflow/pacs.png'});
  console.log('Archive/PACS reuse preserves filters; larger searches clear with X; archive drop and 1x1 opening pass');
  const value=(item,vr='LO')=>({vr,Value:[item]});
  await context.route(base+'/test-pacs/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith('/instances/2.25.202.3'))return route.fulfill({contentType:'application/dicom',body:dicoms[2]});
    const json=url.pathname.endsWith('/studies')?[{'0020000D':value('2.25.200.3','UI'),'00100010':value({Alphabetic:'TEST^PATIENT^3'},'PN'),'00100020':value('TEST-3'),'00080020':value('20261003','DA'),'00080061':value('CT'),'00201206':value(1,'IS'),'00201208':value(1,'IS')}]:
      url.pathname.endsWith('/series')?[{'0020000E':value('2.25.201.3','UI'),'00200011':value(1,'IS'),'00080060':value('CT'),'0008103E':value('Archive test 3'),'00201209':value(1,'IS')}]:[{'00080018':value('2.25.202.3','UI')}];
    return route.fulfill({json});
  });
  await pacs.evaluate(endpoint=>localStorage.setItem('radaz-pacs-config-v1',JSON.stringify({selected:'test',aeTitle:'RADAZ',listenerPort:'11112',locations:[{id:'test',host:'',port:'11112',aeTitle:'TEST',description:'Synthetic PACS',dicomwebUrl:endpoint}]})),base+'/test-pacs');
  await pacs.reload();await pacs.getByRole('checkbox',{name:'Bu gün',exact:true}).uncheck();
  await pacs.getByRole('button',{name:'Axtar',exact:true}).click();
  await pacs.getByRole('cell').filter({hasText:'TEST PATIENT 3'}).waitFor();
  await split();await pacs.getByRole('cell').filter({hasText:'TEST PATIENT 3'}).dblclick();
  await page.waitForFunction(()=>document.querySelector('[data-panel="A"] .top-left')?.textContent.includes('TEST PATIENT 3'));
  assert.equal(await page.locator('.viewport[data-panel]').count(),1);assert.equal(context.pages().length,pacsCount);
  console.log('PACS download persists and reuses the Viewer in 1x1 layout');
  await split();await page.getByRole('button',{name:'CD/DVD import',exact:true}).click();await control('insert');await control('resume');
  await page.locator('.series-card').filter({hasText:'CD progressive CT'}).waitFor();
  await page.locator('.series-card').filter({hasText:'CD progressive CT'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-panel="A"] .bottom-right')?.textContent.includes('/ 700'),{},{timeout:90000});
  assert.equal(await page.locator('.viewport[data-panel]').count(),1);
  for(let i=0;i<200;i++){if((await (await fetch(backend+'/status')).json()).instanceCount===704)break;await delay(100);}
  assert.equal((await (await fetch(backend+'/status')).json()).instanceCount,704);
  assert.ok(requests.some(url=>url.includes('/local-archive-api/file/2.25.101.')),'CD pixels read from durable archive');
  await control('eject');await delay(1300);
  assert.equal((await (await fetch(backend+'/status')).json()).instanceCount,704);
  assert.match(await page.locator('[data-panel="A"] .bottom-right').textContent(),/700/);
  await page.screenshot({path:'outputs/import-workflow/cd-archive.png'});
  await archive.close();const reopened=context.waitForEvent('page');await page.getByRole('button',{name:'Local arxiv',exact:true}).click();await (await reopened).getByRole('textbox',{name:'Bütün müayinələrdə axtar'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: persistent 701-image CD import reads archive pixels, survives eject, resets layout; closed records windows reopen');
} catch(error) {
  for(const [i,page] of (browser?.contexts()[0]?.pages() || []).entries()){
    console.error('PAGE',i,page.url(),await page.locator('body').innerText().catch(()=>''));
    await page.screenshot({path:`outputs/import-workflow/failure-${i}.png`}).catch(()=>{});
  }
  throw error;
} finally {
  await browser?.close();
  for(const child of [server,fixture])if(child?.pid)spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'radaz-import-workflow-'));rmSync(root,{recursive:true,force:true});
}
