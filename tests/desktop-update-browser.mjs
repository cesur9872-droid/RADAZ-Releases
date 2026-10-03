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
const message='RADAZ 0.2.10 yeniləməsi uğurla hazırlandı. Növbəti açılışda avtomatik tətbiq olunacaq.';
const state=(state,message,progress)=>writeFileSync(path.join(root,'update-state.json'),JSON.stringify({state,version:'0.2.10',message,progress}));
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
 let requested=0;
 await page.route('**/radaz-update',route=>{requested++;state('downloading','RADAZ yüklənir…',{done:25,total:100,unit:'bayt'});return route.fulfill({status:202,json:{state:'checking'}});});
 await page.getByRole('button',{name:'Yardım və lisenziya'}).click();
 await page.getByRole('menuitem',{name:'Yeniləmələri yoxla'}).click();
 await page.getByText('25%',{exact:false}).waitFor();
 assert.equal(requested,1);assert.equal(await page.getByRole('progressbar',{name:'Yenilənmə prosesi'}).getAttribute('value'),'25');
 state('installing','Komponentlər quraşdırılır…',{done:8,total:10,unit:'fayl'});
 await page.getByText('80%',{exact:true}).waitFor();
 state('ready',message); // Older staged updates may have no progress field.
 await page.getByText(message,{exact:true}).waitFor();
 await page.getByText('Yeniləmə hazırdır. Setup-ı yenidən quraşdırmaq lazım deyil.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('progressbar',{name:'Yenilənmə prosesi'}).getAttribute('value'),'1');
 assert.equal(await page.getByRole('link',{name:/yüklə və yenilə/}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Yenilə',exact:true}).isEnabled(),true);
 state('current','Ən yeni versiya quraşdırılıb.');
 await page.getByText('Ən yeni versiya quraşdırılıb.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Yenilə',exact:true}).click();
 await page.getByText('25%',{exact:false}).waitFor();
 assert.equal(requested,2,'Both Check updates and Update must wake the updater');
 state('error','Synthetic failed checksum');await page.getByRole('alert').filter({hasText:'Synthetic failed checksum'}).waitFor();
 assert.equal(await page.locator('.update-confirmation').count(),0,'Failure must never show success');
 state('ready',message,{done:1,total:1});await page.getByText(message,{exact:true}).waitFor();
 await page.locator('dialog footer').getByRole('button',{name:'Bağla',exact:true}).click();
 await page.locator('.update-toast').waitFor({timeout:20000});
 assert.match(await page.locator('.update-toast').textContent(),/qısayolunu yenidən açın/);
 await page.getByRole('button',{name:'Bildirişi bağla'}).click();
 assert.equal(await page.locator('.update-toast').count(),0);
 console.log('Update action, byte/file progress, completion, error, ready notification and origin guards passed');
}finally{
 await browser.close();spawnSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
 assert.ok(root.startsWith(path.join(tmpdir(),'radaz-update-ui-')));rmSync(root,{recursive:true,force:true});
}
