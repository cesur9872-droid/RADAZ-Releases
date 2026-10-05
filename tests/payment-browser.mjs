import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import http from 'node:http';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const free=()=>new Promise(resolve=>{const s=http.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const port=await free(),worker=await free(),archive=await free();
const server=spawn(process.execPath,['scripts/start-release.mjs'],{windowsHide:true,stdio:'ignore',env:{...process.env,RADAZ_PORT:String(port),RADAZ_WORKER_PORT:String(worker),RADAZ_ARCHIVE_PORT:String(archive)}});
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const base=`http://127.0.0.1:${port}`;for(let i=0;i<60;i++){try{if((await fetch(base)).status===200)break;}catch{}await delay(300);}
 const page=await browser.newPage();let checkouts=0,activations=0;const orderId='12345678-1234-1234-1234-123456789abc';
 await page.route('https://payments.example.test/**',r=>r.fulfill({body:'Synthetic payment provider'}));
 await page.route('**/local-archive-api/**',r=>{
  const url=new URL(r.request().url());let json=[];
  if(url.pathname.endsWith('/license'))json={valid:true,required:true,kind:'paid',deviceId:'A'.repeat(64)};
  if(url.pathname.endsWith('/billing/catalog'))json={enabled:true,monthly:10,currency:'USD',currencies:['AZN','USD'],maxMonths:120,exchange:{usdAzn:1.7,date:'2026-10-06',checkedAt:Date.now()},modules:[{id:'future-module',name:'Gələcək modul',monthlyMinor:500,enabled:true}]};
  if(url.pathname.endsWith('/billing/checkout')){assert.deepEqual(r.request().postDataJSON(),{months:2,currency:'AZN',moduleId:'future-module'});checkouts++;json={id:orderId,url:'https://payments.example.test/pay'};}
  if(url.pathname.endsWith('/billing/order'))json={status:'paid',activationCode:'RADAZ-ACT-'+'A'.repeat(48),moduleId:'future-module'};
  if(url.pathname.endsWith('/license/activate')){activations++;assert.equal(r.request().postDataJSON().key,'RADAZ-ACT-'+'A'.repeat(48));json={message:'Ödənilmiş modul aktivləşdirildi.'};}
  return r.fulfill({json});
 });
 await page.goto(base+'/archive');await page.getByRole('button',{name:'Yardım və lisenziya'}).click();await page.getByRole('menuitem',{name:'Aylıq ödəniş',exact:true}).click();
 await page.getByLabel('Məhsul',{exact:true}).selectOption('future-module');await page.getByLabel('Valyuta',{exact:true}).selectOption('AZN');await page.getByLabel('Lisenziya ay sayı').fill('2');
 await page.getByText('Cəmi: 17.00 AZN',{exact:true}).waitFor();await page.getByRole('button',{name:'Ödəniş sisteminə keç'}).click();
 await page.getByText('Ödənilmiş modul aktivləşdirildi.',{exact:true}).waitFor();assert.equal(checkouts,1);assert.equal(activations,1);await delay(5500);assert.equal(activations,1);
 console.log('PASS: selected module and AZN quote, payment checkout, paid status automatically activates exactly once and preserves downloadable code');
}finally{await browser.close();spawnSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}
