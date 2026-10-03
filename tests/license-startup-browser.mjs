import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 for(const [path,kind] of [['/mpr','owner'],['/3d','paid'],['/report','trial'],['/mpr','expired'],['/3d','error']]){
  const context=await browser.newContext();const page=await context.newPage();
  await page.addInitScript(()=>{window.licenseFlashes=[];new MutationObserver(()=>{if(document.querySelector('.license-gate,.product-dialog[open]'))window.licenseFlashes.push(performance.now());}).observe(document,{subtree:true,childList:true,attributes:true});});
  let respond;const ready=new Promise(resolve=>respond=resolve);
  await page.route('**/local-archive-api/**',async route=>{
   if(new URL(route.request().url()).pathname.endsWith('/license')){await ready;return kind==='error'?route.fulfill({status:503,body:'temporarily unavailable'}):route.fulfill({json:{required:true,valid:kind!=='expired',kind,trial:{daysRemaining:4}}});}
   return route.fulfill({json:[]});
  });
  await page.goto((process.env.RADAZ_TEST_URL||'http://127.0.0.1:5197')+path,{waitUntil:'domcontentloaded'});
  await page.locator('.product-loading').waitFor();await page.waitForTimeout(600);
  assert.equal((await page.evaluate(()=>window.licenseFlashes)).length,0,'No license prompt before validation');respond();
  if(kind==='expired'){await page.locator('.product-dialog[open]').waitFor();assert.equal(await page.locator('.license-gate').count(),1);}
  else if(kind==='error'){await page.getByRole('button',{name:'Yenidən yoxla',exact:true}).waitFor();assert.equal((await page.evaluate(()=>window.licenseFlashes)).length,0);}
  else {await page.locator('.product-loading').waitFor({state:'detached'});await page.waitForTimeout(200);assert.equal((await page.evaluate(()=>window.licenseFlashes)).length,0,`No transient license prompt for ${kind}`);}
  await context.close();
 }
 console.log('PASS: delayed valid/paid/trial licenses never flash a gate; expired opens activation; service failure offers retry without an activation flash');
}finally{await browser.close();}
