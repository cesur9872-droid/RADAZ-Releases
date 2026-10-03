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
const message='RADAZ 0.2.9 hazırdır. Növbəti açılışda avtomatik tətbiq olunacaq.';
writeFileSync(path.join(root,'update-state.json'),JSON.stringify({state:'ready',version:'0.2.9',message}));
const server=spawn(process.execPath,['scripts/start-release.mjs'],{windowsHide:true,stdio:'ignore',env:{...process.env,RADAZ_PORT:String(port),RADAZ_WORKER_PORT:String(worker),RADAZ_ARCHIVE_PORT:String(archive),RADAZ_INSTALL_ROOT:root}});
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const base=`http://127.0.0.1:${port}`;
 for(let i=0;i<60;i++){try{if((await fetch(base)).status===200)break;}catch{}await delay(300);}
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.route('**/local-archive-api/**',r=>r.fulfill({json:r.request().url().endsWith('/license')?{valid:true,required:true,kind:'owner',message:'Synthetic license',deviceId:'TEST'}:[]}));
 await page.goto(base+'/archive');
 await page.getByRole('button',{name:'Yardım və lisenziya'}).click();
 await page.getByRole('menuitem',{name:'Yeniləmələri yoxla'}).click();
 await page.getByText(message,{exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:/yüklə və yenilə/}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Vəziyyəti yenilə'}).count(),1);
 await page.locator('dialog footer').getByRole('button',{name:'Bağla',exact:true}).click();
 await page.locator('.update-toast').waitFor({timeout:20000});
 assert.match(await page.locator('.update-toast').textContent(),/qısayolunu yenidən açın/);
 await page.getByRole('button',{name:'Bildirişi bağla'}).click();
 assert.equal(await page.locator('.update-toast').count(),0);
 console.log('Managed update panel and ready notification show automatic installation with no manual download link');
}finally{
 await browser.close();spawnSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
 assert.ok(root.startsWith(path.join(tmpdir(),'radaz-update-ui-')));rmSync(root,{recursive:true,force:true});
}
