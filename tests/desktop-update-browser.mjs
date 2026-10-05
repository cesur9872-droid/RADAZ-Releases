import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import http from 'node:http';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const free=()=>new Promise(resolve=>{const s=http.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const root=mkdtempSync(path.join(tmpdir(),'radaz-update-ui-')),port=await free(),worker=await free(),archive=await free();
const message='RADAZ 99.0.1 yeniləməsi uğurla hazırlandı. Növbəti açılışda avtomatik tətbiq olunacaq.';
const state=(state,message,progress)=>writeFileSync(path.join(root,'update-state.json'),JSON.stringify({state,version:'99.0.1',message,progress}));
state('current','Ən yeni versiya quraşdırılıb.');
const server=spawn(process.execPath,['scripts/start-release.mjs'],{windowsHide:true,stdio:'ignore',env:{...process.env,RADAZ_PORT:String(port),RADAZ_WORKER_PORT:String(worker),RADAZ_ARCHIVE_PORT:String(archive),RADAZ_INSTALL_ROOT:root}});
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const base=`http://127.0.0.1:${port}`;
 for(let i=0;i<60;i++){try{if((await fetch(base)).status===200)break;}catch{}await delay(300);}
 assert.equal((await fetch(base+'/radaz-update')).status,403);
 assert.equal((await fetch(base+'/radaz-update',{method:'POST',headers:{Origin:'https://example.com'}})).status,403);
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.route('**/local-archive-api/**',r=>r.fulfill({json:r.request().url().endsWith('/license')?{valid:true,required:true,kind:'owner',message:'Synthetic license',deviceId:'TEST'}:[]}));
 await page.goto(base+'/archive');
 let checks=0,downloads=0;
 await page.route('**/radaz-update',route=>{
  const input=route.request().postDataJSON();
  if(input.action==='check'){checks++;state('available','RADAZ 99.0.1 — yeni versiya mövcuddur.');}
  else{assert.deepEqual(input,{action:'download',version:'99.0.1',confirmed:true});downloads++;state('downloading','RADAZ yüklənir…',{done:25,total:100,unit:'bayt'});}
  return route.fulfill({status:202,json:{state:'checking'}});
 });
 for(const payload of [{action:'download',version:'99.0.1'},{action:'download',confirmed:true,version:'../../bad'},{action:'install'}]){
  assert.equal((await fetch(base+'/radaz-update',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(payload)})).status,400);
 }
 await page.getByRole('button',{name:'Yardım və lisenziya'}).click();await page.getByRole('menuitem',{name:'Yeniləmələri yoxla'}).click();
 await page.locator('.desktop-update-progress[data-state="available"]').waitFor();
 assert.equal(checks,1);assert.equal(downloads,0,'Checking must never download');
 await page.locator('dialog footer').getByRole('button',{name:'Bağla',exact:true}).click();
 await page.locator('.update-toast b').filter({hasText:/yeni versiya/}).waitFor({timeout:20000});
 await page.getByRole('button',{name:'Yenilənməyə bax',exact:true}).click();await page.getByRole('button',{name:'Yenilə',exact:true}).waitFor();
 assert.equal(downloads,0,'Opening update notification must never download');
 await page.getByRole('button',{name:'Yenilə',exact:true}).click();await page.getByRole('group',{name:'Yeniləməni təsdiqlə'}).waitFor();
 assert.equal(downloads,0,'Update button requires a separate confirmation');
 await page.getByRole('button',{name:'Ləğv et',exact:true}).click();assert.equal(downloads,0);
 await page.getByRole('button',{name:'Yenilə',exact:true}).click();await page.getByRole('button',{name:'Təsdiq et və yenilə',exact:true}).click();
 await page.getByText('25%',{exact:false}).waitFor();assert.equal(downloads,1);
 assert.equal(await page.getByRole('progressbar',{name:'Yenilənmə prosesi'}).getAttribute('value'),'25');
 state('installing','Komponentlər quraşdırılır…',{done:8,total:10,unit:'fayl'});await page.getByText('80%',{exact:true}).waitFor();
 state('error','Synthetic failed checksum');await page.getByRole('alert').filter({hasText:'Synthetic failed checksum'}).waitFor();
 assert.equal(await page.locator('.update-confirmation').count(),0,'Failure must never show success');
 state('ready',message);await page.getByText(message,{exact:true}).waitFor();
 await page.getByText('Yeniləmə hazırdır. Setup-ı yenidən quraşdırmaq lazım deyil.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('progressbar',{name:'Yenilənmə prosesi'}).getAttribute('value'),'1');
 await page.locator('dialog footer').getByRole('button',{name:'Bağla',exact:true}).click();
 await page.locator('.update-toast').getByText(/qısayolunu yenidən açın/).waitFor({timeout:20000});
 await page.getByRole('button',{name:'Bildirişi bağla'}).click();assert.equal(await page.locator('.update-toast').count(),0);
 console.log('PASS: discovery-only check, available notification, no download on opening or cancel, explicit version confirmation, progress and completion, origin/approval guards');
}finally{
 await browser.close();spawnSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
 assert.ok(root.startsWith(path.join(tmpdir(),'radaz-update-ui-')));rmSync(root,{recursive:true,force:true});
}
