import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.RADAZ_TEST_URL||'http://127.0.0.1:5197';
const files=readdirSync('outputs/volume-fixture').filter(f=>f.endsWith('.dcm')).map(f=>readFileSync(path.join('outputs/volume-fixture',f)));
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--enable-precise-memory-info']});
try {
 const context=await browser.newContext({viewport:{width:1366,height:768}});context.setDefaultTimeout(90000);
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route('**/local-archive-api/**',route=>{
  const url=new URL(route.request().url()),p=url.pathname;
  if(p.endsWith('/license'))return route.fulfill({json:{valid:true,required:true,kind:'owner',message:'Synthetic',deviceId:'TEST'}});
  if(p.endsWith('/instances'))return route.fulfill({json:files.map((_,i)=>({uid:String(i)}))});
  if(p.includes('/file/'))return route.fulfill({contentType:'application/dicom',body:files[Number(p.split('/').pop())]});
  return route.fulfill({json:[]});
 });
 await context.route('**/product.json',route=>route.fulfill({json:{name:'RADAZ',version:'0.2.11',licenseRequired:true}}));
 const page=await context.newPage();const started=Date.now();
 page.on('pageerror',error=>console.error('PAGE',error.message));
 page.on('console',message=>{if(message.type()==='error')console.error('CONSOLE',message.text());});
 page.on('requestfailed',r=>console.error('FAILED',r.url(),r.failure()?.errorText));
 await page.goto(base+'/#archive-study=2.25.702');
 console.log('Viewer loaded');
 await page.locator('[data-panel="A"][data-has-image="true"]').waitFor();
 await page.waitForFunction(count=>document.querySelector('.statusbar')?.textContent.includes(`${count} DICOM görüntüsü yükləndi`),files.length);
 const importMs=Date.now()-started; const source=await page.evaluate(()=>window.radazPerformance?.());
 console.log('Import complete',source);console.log(await page.locator('.statusbar').innerText());
 const open=async(mode)=>{
  if(process.env.RADAZ_IN_PLACE){await page.getByRole('button',{name:mode==='3d'?'3D həcm görüntüləmə':'MPR rekonstruksiya',exact:true}).click();return page;}
  const pending=context.waitForEvent('page');await page.getByRole('button',{name:mode==='3d'?'3D həcm görüntüləmə':'MPR rekonstruksiya',exact:true}).click();return pending;
 };
 const volume=await open('3d');
 console.log('3D requested');
 await Promise.race([volume.locator('.cornerstone-volume-stage[data-ready="true"]').waitFor(),volume.getByText('3D həcm açıla bilmədi',{exact:true}).waitFor().then(async()=>{throw Error(await volume.locator('.volume-cover').innerText());})]);
 const first=await volume.evaluate(()=>window.radazPerformance());
 console.log('3D ready',first);
 const box=await volume.locator('.cornerstone-volume-host').boundingBox();
 await volume.mouse.move(box.x+box.width/2,box.y+box.height/2);await volume.mouse.down();
 for(let i=0;i<90;i++){await volume.mouse.move(box.x+box.width/2+Math.sin(i/12)*150,box.y+box.height/2+Math.cos(i/12)*80);await new Promise(r=>setTimeout(r,16));}
 await volume.mouse.up();
 const interaction=await volume.evaluate(()=>window.radazPerformance());
 {
  await volume.waitForFunction(()=>document.querySelector('.cornerstone-volume-host')?.getAttribute('data-interacting')==='false');
  const volumeId=await volume.locator('.cornerstone-volume-host').getAttribute('data-volume-id');
  await volume.getByRole('button',{name:'Professional 3D ayarları',exact:true}).click();
  const quality=volume.getByRole('combobox',{name:'3D keyfiyyəti',exact:true});assert.equal(await quality.inputValue(),'balanced');
  for(const profile of ['performance','high','ultra','auto','balanced']){console.log('Quality',profile);await quality.selectOption(profile,{timeout:10000});}
  await volume.keyboard.press('Escape');
  for(const preset of ['Bone','Angio','Soft Tissue','Lung','Airway','Skin','Transparent','MIP','MinIP']){
   await volume.getByRole('button',{name:'3D göstərmə presetləri',exact:true}).click();
   await volume.getByRole('menuitem').filter({has:volume.locator('strong',{hasText:new RegExp('^'+preset+'$')})}).click();
  }
  assert.equal(await volume.locator('.cornerstone-volume-host').getAttribute('data-volume-id'),volumeId,'Quality/presets do not rebuild the volume');
 }
 const mpr=await open('mpr');
 await mpr.waitForFunction(()=>document.querySelectorAll('[data-panel][data-has-image="true"]').length===3&&!document.querySelector('.viewport-loading'));
 const afterMpr=await mpr.evaluate(()=>window.radazPerformance());
 if(process.env.RADAZ_IN_PLACE){assert.equal(afterMpr.decodeCount,source.decodeCount);assert.equal(afterMpr.volumeBuildCount,1);assert.ok(afterMpr.volumeCacheHits>0);}
 else{assert.equal(first.decodeCount,0);assert.equal(afterMpr.decodeCount,0);assert.equal((await page.evaluate(()=>window.radazPerformance())).decodeCount,source.decodeCount);}
 const gpuSession=await browser.newBrowserCDPSession();const gpu=(await gpuSession.send('SystemInfo.getInfo')).gpu;
 const result={fixture:{width:512,height:512,slices:files.length},importMs,source,first,interaction,afterMpr,gpu:gpu.devices,errors};
 mkdirSync('outputs/performance',{recursive:true});writeFileSync(`outputs/performance/${process.env.RADAZ_BENCH_LABEL||'baseline'}.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));assert.deepEqual(errors,[]);
}catch(error){for(const p of browser.contexts()[0].pages())console.error(p.url(),await p.locator('body').innerText());throw error;}finally{await browser.close();}
