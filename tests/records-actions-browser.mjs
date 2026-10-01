import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const base=process.env.RADAZ_TEST_URL || 'http://localhost:5186';
try {
 for(const route of ['/archive','/pacs']) {
  const page=await browser.newPage({viewport:{width:1366,height:680}});
  await page.request.get(`${base}/test-reset`);
  await page.addInitScript(()=>localStorage.setItem('radaz-pacs-config-v1',JSON.stringify({selected:'test',aeTitle:'RADAZ',listenerPort:'11112',locations:[{id:'test',host:'',port:'11112',aeTitle:'TEST',description:'Synthetic PACS',dicomwebUrl:location.origin+'/test-pacs'}]})));
  const deleteRequests=[];
  page.on('request',r=>{if(r.url().includes('/studies/delete'))deleteRequests.push(r.url());});
  await page.goto(base+route);
  await page.getByRole('checkbox',{name:'Bu gün',exact:true}).waitFor();
  assert.equal(await page.getByRole('checkbox',{name:'Bu gün',exact:true}).isChecked(),true);
  if(route==='/pacs') await page.getByRole('button',{name:'Axtar',exact:true}).click();
  const table=page.getByRole('table',{name:route==='/archive'?'Arxiv müayinələri':'PACS müayinələri',exact:true});
  await table.getByRole('cell').filter({hasText:'Z SINAQ'}).waitFor();
  assert.equal(await table.locator('tbody tr').count(),1);
  await page.getByRole('checkbox',{name:'Bu gün',exact:true}).uncheck();
  if(route==='/pacs') await page.getByRole('button',{name:'Axtar',exact:true}).click();
  await table.getByRole('cell').filter({hasText:'A SINAQ'}).waitFor();
  await table.getByRole('checkbox',{name:'Hamısını seç',exact:true}).check();
  assert.equal(await table.locator('tbody input:checked').count(),2);
  await page.getByRole('checkbox',{name:'Bu gün',exact:true}).check();
  assert.equal(await table.locator('tbody input:checked').count(),1);
  // A browser copy with the same UID must also be removed, otherwise it reappears.
  await page.evaluate(async()=>{await new Promise((resolve,reject)=>{const r=indexedDB.open('radaz-local-archive',1);r.onupgradeneeded=()=>{const db=r.result;db.createObjectStore('studies',{keyPath:'uid'});db.createObjectStore('instances',{keyPath:'id'}).createIndex('studyUID','studyUID');};r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction(['studies','instances'],'readwrite');t.objectStore('studies').put({uid:'1.2.826.0.1.2',patient:'Z SINAQ',date:'',series:[],imageCount:1});t.objectStore('instances').put({id:'sample',studyUID:'1.2.826.0.1.2',file:new Blob(['synthetic'])});t.oncomplete=()=>{db.close();resolve();};};});});
  const remove=page.getByRole('button',{name:route==='/archive'?'Seçilmiş müayinəni sil':/Lokal nüsxələri sil/});
  page.once('dialog',dialog=>dialog.dismiss());await remove.click();await page.waitForTimeout(250);
  assert.equal(deleteRequests.length,0,'Cancel must preserve records');
  await page.route('**/local-archive-api/studies/delete',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Synthetic disk failure'})}));
  page.once('dialog',dialog=>dialog.accept());await remove.click();
  await page.getByRole('status').filter({hasText:'Synthetic disk failure'}).waitFor();
  assert.equal(await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('radaz-local-archive',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('instances').objectStore('instances').count();q.onsuccess=()=>{db.close();resolve(q.result);};};})),1,'Disk error must preserve browser copy');
  await page.unroute('**/local-archive-api/studies/delete');
  page.once('dialog',dialog=>dialog.accept());await remove.click();
  await page.getByRole('status').filter({hasText:'1 müayinənin lokal nüsxələri silindi'}).waitFor();
  assert.deepEqual(await (await page.request.get(base+'/test-deleted')).json(),['1.2.826.0.1.2']);
  assert.ok(deleteRequests.every(url=>url.startsWith(base+'/local-archive-api/studies/delete')),'No remote PACS writes');
  assert.equal(await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('radaz-local-archive',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('instances').objectStore('instances').count();q.onsuccess=()=>{db.close();resolve(q.result);};};})),0);
  if(route==='/pacs') assert.equal(await table.locator('tbody tr').count(),1,'Remote study remains available');
  await page.getByRole('checkbox',{name:'Bu gün',exact:true}).uncheck();
  await table.getByRole('cell').filter({hasText:'A SINAQ'}).waitFor();
  console.log(route+': today, filtered select-all, cancel, local disk + browser deletion passed');
  await page.close();
 }
} finally {await browser.close();}
