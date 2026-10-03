import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.RADAZ_TEST_URL||'http://127.0.0.1:5197';
const fixture=process.env.RADAZ_FIXTURE||'outputs/reference-ct',label=process.env.RADAZ_LOOK_LABEL||'improved';
const files=readdirSync(fixture).filter(f=>f.endsWith('.dcm')).map(f=>readFileSync(path.join(fixture,f)));
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(90000);
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route('**/local-archive-api/**',route=>{
  const p=new URL(route.request().url()).pathname;
  if(p.endsWith('/license'))return route.fulfill({json:{valid:true,required:true,kind:'owner',message:'Public QA',deviceId:'TEST'}});
  if(p.endsWith('/instances'))return route.fulfill({json:files.map((_,i)=>({uid:String(i)}))});
  if(p.includes('/file/'))return route.fulfill({contentType:'application/dicom',body:files[Number(p.split('/').pop())]});
  return route.fulfill({json:[]});
 });
 const viewer=await context.newPage();await viewer.goto(base+'/#archive-study=2.25.702');
 await viewer.waitForFunction(count=>document.querySelector('.statusbar')?.textContent.includes(`${count} DICOM görüntüsü yükləndi`),files.length);
 const before=await viewer.evaluate(()=>window.radazPerformance());
 let volume=viewer;
 if(process.env.RADAZ_IN_PLACE)await viewer.getByRole('button',{name:'3D həcm görüntüləmə',exact:true}).click();
 else{const pending=context.waitForEvent('page');await viewer.getByRole('button',{name:'3D həcm görüntüləmə',exact:true}).click();volume=await pending;}
 await Promise.race([volume.locator('.cornerstone-volume-stage[data-ready="true"]').waitFor(),volume.getByText('3D həcm açıla bilmədi',{exact:true}).waitFor().then(async()=>{throw Error(await volume.locator('.volume-cover').innerText());})]);
 await volume.waitForTimeout(1500);
 mkdirSync('outputs/reference-review',{recursive:true});
 await volume.screenshot({path:`outputs/reference-review/${label}-front.png`});
 const box=await volume.locator('.cornerstone-volume-host').boundingBox();
 await volume.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await volume.mouse.down();
 await volume.mouse.move(box.x+box.width*.64,box.y+box.height*.52,{steps:20});await volume.mouse.up();
 await volume.waitForTimeout(1000);await volume.screenshot({path:`outputs/reference-review/${label}-oblique.png`});
 if(!process.env.RADAZ_IN_PLACE){
  assert.equal(await viewer.locator('[data-panel="A"][data-has-image="true"]').count(),1,'2D Viewer stays open');
  assert.match(volume.url(),/\/3d\?handoff=/);
  const host=volume.locator('.cornerstone-volume-host');assert.equal(await host.getAttribute('data-interacting'),'false');
  assert.equal(await host.getAttribute('data-shaded'),'true');assert.equal(await host.getAttribute('data-occlusion'),'false');
  assert.equal((await volume.evaluate(()=>window.radazPerformance())).decodeCount,0,'3D must borrow already decoded source pixels');
  const pending=context.waitForEvent('page');await viewer.getByRole('button',{name:'MPR rekonstruksiya',exact:true}).click();const mpr=await pending;
  await mpr.waitForFunction(()=>document.querySelectorAll('[data-panel][data-has-image="true"]').length===3&&!document.querySelector('.viewport-loading'));
  assert.equal((await mpr.evaluate(()=>window.radazPerformance())).decodeCount,0,'MPR must borrow the same decoded source pixels');
  assert.equal((await viewer.evaluate(()=>window.radazPerformance())).decodeCount,before.decodeCount);
  await viewer.getByRole('button',{name:'3D həcm görüntüləmə',exact:true}).click();assert.equal(context.pages().length,3,'Repeat click reuses its 3D tab');
  await mpr.screenshot({path:`outputs/reference-review/${label}-mpr.png`});
  if(base.endsWith(':5197')){
   const shared=await volume.evaluate(async()=>{
    const child=await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/lib/cornerstone.ts')).name);const {engine}=await child.getViewer();
    const viewport=engine.getViewports().find(v=>v.id.startsWith('RADAZ-3D'));
    const parent=window.opener.radazDetachedSources.values().next().value();
    const parentPixels=parent.series[0].images[0].record.pixels;
    const v=await child.getSeriesVolume(child.borrowLocalDicoms(parent.series[0].images));
    const cached=engine.getViewport(viewport.id).getDefaultActor().actor;
    return {directShared:child.shareLocalDicoms(v.imageIds)[0].record.pixels.buffer===parentPixels.buffer,
     opacity300:cached.getProperty().getScalarOpacity(0).getValue(300),gradient:cached.getProperty().getUseGradientOpacity(0),
     autoSampling:cached.getMapper().getAutoAdjustSampleDistances(),lights:viewport.getRenderer().getLights().length};
   });
   assert.equal(shared.directShared,true);assert.equal(shared.gradient,false);assert.equal(shared.autoSampling,false);assert.equal(shared.lights,3);
   console.log('Material/shared-buffer checks',shared);
   const zoom=()=>volume.evaluate(async()=>{const {engine}=await(await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/lib/cornerstone.ts')).name)).getViewer();return engine.getViewports().find(v=>v.id.startsWith('RADAZ-3D')).getCamera().parallelScale;});
   const beforeZoom=await zoom();await volume.bringToFront();await volume.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await volume.mouse.down({button:'right'});
   await volume.mouse.move(box.x+box.width*.5,box.y+box.height*.5+45,{steps:8});await volume.mouse.up({button:'right'});
   assert.notEqual(await zoom(),beforeZoom,'3D right-button drag changes zoom');
  }
 }
 const result={fixture,before,volume:await volume.evaluate(()=>window.radazPerformance()),errors};
 writeFileSync(`outputs/reference-review/${label}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));assert.deepEqual(errors,[]);
}catch(error){for(const p of browser.contexts()[0]?.pages()||[])console.error(p.url(),await p.locator('body').innerText());throw error;}finally{await browser.close();}
