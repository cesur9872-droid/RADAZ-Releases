import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.RADAZ_TEST_URL||'http://127.0.0.1:5197';
const files=readdirSync('outputs/oblique-fixture').filter(f=>f.endsWith('.dcm')).map(f=>readFileSync('outputs/oblique-fixture/'+f));
const browser=await chromium.launch({headless:true,channel:'msedge'});let mpr;
mkdirSync('outputs/mpr-qa',{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(30000);
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route('**/local-archive-api/**',route=>{const p=new URL(route.request().url()).pathname;
  if(p.endsWith('/license'))return route.fulfill({json:{valid:true,required:true,kind:'owner'}});
  if(p.endsWith('/instances'))return route.fulfill({json:files.map((_,i)=>({uid:String(i)}))});
  if(p.includes('/file/'))return route.fulfill({contentType:'application/dicom',body:files[Number(p.split('/').pop())]});
  return route.fulfill({json:[]});
 });
 const page=await context.newPage();await page.goto(base+'/#archive-study=2.25.702');
 await page.waitForFunction(()=>document.querySelector('.statusbar')?.textContent.includes('DICOM görüntüsü yükləndi'));
 const opened=context.waitForEvent('page');await page.getByRole('button',{name:'MPR rekonstruksiya',exact:true}).click();mpr=await opened;
 await mpr.waitForFunction(()=>document.querySelectorAll('[data-panel][data-has-image="true"]').length===3&&!document.querySelector('.viewport-loading'));
 const snap=()=>mpr.evaluate(async()=>{
  const api=await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/lib/cornerstone.ts')).name),{engine}=await api.getViewer();
  const world=document.querySelector('[data-panel="MA"] .localizer-overlay').getAttribute('data-world').split(',').map(Number);
  return {world,panels:Object.fromEntries(['MA','MC','MS'].map(id=>{const vp=engine.getViewport('panel-'+id);return [id,{camera:vp.getCamera(),id:vp.getCurrentImageId(),anchor:vp.worldToCanvas(world),geometry:api.getLocalizerGeometry(vp.getCurrentImageId())}]}))};
 });
 const near=(a,b,label,tolerance=.001)=>assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<tolerance,`${label}: ${a} vs ${b}`);
 const stable=(a,b)=>{near(a.world,b.world,'Physical intersection preserved');for(const id of ['MA','MC','MS']){near(a.panels[id].anchor,b.panels[id].anchor,id+' pivot screen position',.1);assert.ok(Math.abs(a.panels[id].camera.parallelScale-b.panels[id].camera.parallelScale)<.001,id+' zoom preserved');}};
 const zoom=async(panel)=>{const c=await mpr.locator(`[data-panel="${panel}"] .dicom-canvas`).boundingBox();await mpr.mouse.move(c.x+c.width*.6,c.y+c.height*.6);await mpr.keyboard.down('Control');await mpr.mouse.wheel(0,-180);await mpr.keyboard.up('Control');await mpr.waitForTimeout(150);};
 const drag=async(x,y,dx,dy)=>{await mpr.mouse.move(x,y);await mpr.mouse.down();await mpr.mouse.move(x+dx,y+dy,{steps:8});await mpr.mouse.up();await mpr.waitForTimeout(400);};
 // A prior Fit must not reset a later reconstructed image.
 await mpr.getByRole('button',{name:'Ekrana sığdır',exact:true}).click();await zoom('MA');await zoom('MC');
 const before=await snap();
 await mpr.getByRole('button',{name:'MIP',exact:true}).click();await mpr.waitForTimeout(600);
 await mpr.getByRole('slider',{name:'Aktiv MPR panelinin qalınlığı'}).fill('9');await mpr.waitForTimeout(800);
 const thick=await snap();stable(before,thick);assert.equal(before.panels.MC.id,thick.panels.MC.id);assert.equal(before.panels.MS.id,thick.panels.MS.id);
 console.log('Thickness and MIP preserve intersection, zoom, and unaffected planes after Fit');
 const line=mpr.locator('[data-panel="MA"] .localizer-line[data-source="MC"]');
 assert.equal(await line.locator('.localizer-rotate-hit').count(),2);
 const first=line.locator('.localizer-rotate-hit').first();assert.match(await first.evaluate(e=>getComputedStyle(e).cursor),/rotate-cursor/);
 await first.focus();await first.press('ArrowRight');await mpr.waitForTimeout(900);
 const rotated=await snap();stable(thick,rotated);assert.equal(rotated.panels.MA.id,thick.panels.MA.id,'Axial stack is not rebuilt for a coronal rotation');
 assert.notDeepEqual(rotated.panels.MC.geometry.rowDirection,thick.panels.MC.geometry.rowDirection);
 console.log('Oblique rotation keeps axial zoom/pan and pivot in every panel');
 const lineBox=await mpr.locator('[data-panel="MA"] .dicom-canvas').boundingBox();
 const positions=await line.evaluate(e=>{const l=e.querySelector('.localizer-stroke');return [l.x1.baseVal.value,l.y1.baseVal.value,l.x2.baseVal.value,l.y2.baseVal.value]});
 const [ax,ay,bx,by]=positions,tx=ax+(bx-ax)*.8,ty=ay+(by-ay)*.8;
 await mpr.mouse.move(lineBox.x+tx,lineBox.y+ty);await mpr.waitForTimeout(100);
 const following=await line.locator('.localizer-rotate-hit').evaluateAll(elements=>elements.map(e=>[e.cx.baseVal.value,e.cy.baseVal.value]));
 assert.ok(following.some(p=>Math.hypot(p[0]-tx,p[1]-ty)<13),'Handle follows cursor along hovered side');
 const pivot=rotated.panels.MA.anchor;
 const hx=lineBox.x+tx,hy=lineBox.y+ty,px=lineBox.x+pivot[0],py=lineBox.y+pivot[1],angle=.13;
 // Press exactly where we hovered the line: the catchable handle must already be there.
 assert.ok(await mpr.evaluate(({x,y})=>document.elementFromPoint(x,y)?.classList.contains('localizer-rotate-hit'),{x:hx,y:hy}));
 await drag(hx,hy,px+(hx-px)*Math.cos(angle)-(hy-py)*Math.sin(angle)-hx,py+(hx-px)*Math.sin(angle)+(hy-py)*Math.cos(angle)-hy);
 const dragged=await snap();stable(rotated,dragged);assert.notDeepEqual(dragged.panels.MC.geometry.columnDirection,rotated.panels.MC.geometry.columnDirection,'Pointer drag rotates just its source plane');
 const coronalBox=await mpr.locator('[data-panel="MC"] .dicom-canvas').boundingBox();await mpr.mouse.click(coronalBox.x+25,coronalBox.y+25);
 await mpr.getByRole('slider',{name:'Aktiv MPR panelinin qalınlığı'}).fill('7');await mpr.waitForTimeout(700);stable(dragged,await snap());
 // Every plane must span the whole grid, not its original grid area.
 for(const id of ['MC','MS','MA']){
  const box=await mpr.locator(`[data-panel="${id}"] .dicom-canvas`).boundingBox();
  await mpr.mouse.dblclick(box.x+25,box.y+box.height-25);await mpr.waitForTimeout(300);
  const grid=await mpr.locator('.mpr-grid').boundingBox(),expanded=await mpr.locator(`[data-panel="${id}"]`).boundingBox();
  assert.equal(await mpr.locator('.mpr-grid.maximized').count(),1);
  assert.ok(Math.abs(expanded.width-grid.width)<8&&Math.abs(expanded.height-grid.height)<8,`${id} fills grid: ${JSON.stringify({grid,expanded})}`);
  assert.equal(await mpr.locator('[data-panel]').count(),3);
  if(id!=='MA'){await mpr.mouse.dblclick(expanded.x+25,expanded.y+expanded.height-25);await mpr.waitForTimeout(300);}
 }
 const center=mpr.locator('[data-panel="MA"] .localizer-center-hit'),cb=await center.boundingBox();
 const full=await snap();await drag(cb.x+cb.width/2,cb.y+cb.height/2,20,-18);const moved=await snap();
 assert.ok(Math.hypot(...moved.world.map((v,i)=>v-full.world[i]))>.3,'Center moves while other panes are concealed');
 assert.notEqual(moved.panels.MC.id,full.panels.MC.id);assert.notEqual(moved.panels.MS.id,full.panels.MS.id);
 await mpr.screenshot({path:'outputs/mpr-qa/maximized.png'});
 console.log('Maximized pane keeps both other viewports alive and draggable');
 // Right-click deletion and repeated popup actions must never toggle maximization.
 await mpr.getByRole('button',{name:'Ölçmə alətləri',exact:true}).click();await mpr.getByRole('menuitem',{name:/Uzunluq/}).click();
 await mpr.getByRole('menu').waitFor({state:'hidden'});await mpr.waitForTimeout(150);
 const measured=await mpr.locator('[data-panel="MA"] .dicom-canvas').boundingBox(),mx=measured.x+measured.width*.3,my=measured.y+measured.height*.7;
 await drag(mx-40,my,80,0);await mpr.mouse.click(mx,my,{button:'right'});
 await mpr.getByRole('menuitem',{name:'Sil',exact:true}).click();
 assert.equal(await mpr.locator('line[data-id*="-endpoint-"]').count(),0);
 await mpr.mouse.dblclick(mx,my,{button:'right'});
 await mpr.getByRole('menuitem',{name:/Cari kəsitdə hamısını sil/}).dblclick({force:true});
 assert.equal(await mpr.locator('[data-panel="MA"][data-expanded="true"]').count(),1,'Deletion and right double-click do not restore');
 await mpr.keyboard.press('Escape');await mpr.waitForTimeout(800);
 await mpr.mouse.dblclick(measured.x+25,measured.y+measured.height-25);await mpr.waitForTimeout(300);
 assert.equal(await mpr.locator('.mpr-grid.maximized').count(),0,'Normal double-click still restores');
 for(const target of [page,mpr])for(const width of [1920,1366,1024,800,390]){
  await target.setViewportSize({width,height:900});await target.waitForTimeout(100);
  const state=await target.locator('.topbar').evaluate(e=>({height:e.clientHeight,overflow:getComputedStyle(e).overflowX,rows:[...e.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width).map(b=>{const r=b.getBoundingClientRect();return r.y+r.height/2;}),body:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(Math.max(...state.rows)-Math.min(...state.rows)<12,`One toolbar row at ${width}: ${JSON.stringify(state)}`);assert.ok(state.body<=state.width+1);assert.equal(state.overflow,'auto');
 }
 await mpr.screenshot({path:'outputs/mpr-qa/mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS: MPR coordinate/zoom stability, paired cursor-following handles, maximized localizers, single-row responsive headers');
}catch(e){if(mpr){await mpr.screenshot({path:'outputs/mpr-qa/failure.png'});console.error(await mpr.locator('.statusbar').textContent());}throw e;}finally{await browser.close();}
