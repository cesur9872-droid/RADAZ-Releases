import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.RADAZ_TEST_URL||'http://localhost:5186';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1366,height:680}});
 if(process.env.RADAZ_FIXTURE_URL)await page.route('**/local-archive-api/**',async route=>{const req=route.request(),url=new URL(req.url());const response=await page.request.fetch(process.env.RADAZ_FIXTURE_URL+url.pathname+url.search,{method:req.method(),data:req.postData()||undefined});await route.fulfill({response});});
 await page.addInitScript(()=>localStorage.setItem('radaz-pacs-config-v1',JSON.stringify({selected:'test',locations:[{id:'test',host:'',port:'11112',aeTitle:'TEST',description:'Synthetic PACS',dicomwebUrl:location.origin+'/test-pacs'}]})));
 for(const route of ['/archive','/pacs']){
  await page.goto(base+route);
  const table=page.getByRole('table',{name:route==='/archive'?'Arxiv müayinələri':'PACS müayinələri',exact:true});
  const handle=table.getByRole('separator',{name:'Pasiyent sütununun eni',exact:true});await handle.waitFor();
  const header=handle.locator('..');const before=await header.boundingBox();const order=await header.getAttribute('aria-sort');
  const grip=await handle.boundingBox();await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+grip.width/2+110,grip.y+grip.height/2,{steps:10});await page.mouse.up();
  const after=await header.boundingBox();assert.ok(after.width>before.width+100);assert.equal(await header.getAttribute('aria-sort'),order,'Resize must not sort');
  await page.reload();await handle.waitFor();assert.ok(Math.abs((await header.boundingBox()).width-after.width)<2,'Width persists after reload');
  await handle.focus();await page.keyboard.press('ArrowLeft');assert.ok((await header.boundingBox()).width<after.width-3);
  await handle.dblclick();assert.ok(Math.abs((await header.boundingBox()).width-before.width)<2,'Double click resets widths');
  console.log(route+': drag, persistent widths, keyboard, reset and independent sorting passed');
 }
 await page.goto(base+'/');await page.getByRole('button',{name:'Yardım və lisenziya'}).waitFor();
 for(const width of [1920,1366,1024,853,390]){
  await page.setViewportSize({width,height:800});
  const last=await page.evaluate(()=>{const h=document.querySelector('.help-command').getBoundingClientRect();return [...document.querySelectorAll('main>header button')].filter(b=>!b.closest('.help-command')).every(b=>{const r=b.getBoundingClientRect();return !r.width||(r.bottom<=h.bottom+1&&(r.top<h.top-10||r.right<=h.left+1));});});
  assert.ok(last,`Help must be the last visible command at ${width}`);
 }
 console.log('Viewer help is the last command at all tested sizes');
}finally{await browser.close();}
