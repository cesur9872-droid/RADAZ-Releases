import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/local-archive-api/**',route=>route.fulfill({json:route.request().url().endsWith('/license')?{valid:true,kind:'owner'}:[]}));
 for(const path of ['/archive','/pacs','/3d']){
  await page.goto((process.env.RADAZ_TEST_URL||'http://127.0.0.1:5197')+path);await page.locator('main>header').waitFor();
  for(const width of [1920,1366,1024,800,390]){
   await page.setViewportSize({width,height:900});
   const state=await page.locator('main>header').evaluate(e=>{const actions=e.querySelector('.records-header-actions')||e;return {body:document.documentElement.scrollWidth,width:innerWidth,height:e.clientHeight,rows:[...actions.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width).map(b=>{const r=b.getBoundingClientRect();return r.y+r.height/2;})};});
   assert.ok(Math.max(...state.rows)-Math.min(...state.rows)<12,`${path} ${width}: buttons remain in one row`);assert.ok(state.body<=width+1);assert.ok(state.height<100,`${path} ${width}: compact header`);
   if(path!=='/3d'){
    await page.getByRole('button',{name:'Müayinə növlərini seç'}).click();const menu=page.locator('.modality-popover');await menu.waitFor();
    const bounds=await menu.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=900,'Portaled menu remains visible outside scrolling toolbar');
    await page.getByRole('menuitem',{name:'Bütün müayinələr',exact:true}).click();
   }
   assert.equal(await page.locator('.help-trigger>span').evaluate(e=>getComputedStyle(e).display),'none',`${path} ${width}: help label stays hidden`);
   await page.getByRole('button',{name:'Yardım və lisenziya',exact:true}).click();await page.getByRole('menuitem',{name:/Proqram haqqında/}).waitFor();await page.keyboard.press('Escape');
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS: Archive/PACS/3D single-row headers at 1920–390px, reachable help and unclipped filter popup');
}finally{await browser.close();}
