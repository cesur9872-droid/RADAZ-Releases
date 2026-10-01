import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const b=await chromium.launch({headless:true,channel:'msedge'});
try{
 const p=await b.newPage({viewport:{width:1366,height:680}});
 await p.goto('http://localhost:5186/');
 await p.waitForFunction(()=>document.querySelector('[data-panel="A"] .overlay.bottom-right')?.textContent.includes('/ 5'));
 // Observe the real Cornerstone camera through its existing development module.
 const camera=()=>p.evaluate(async()=>{const {getViewer}=await import('/lib/cornerstone.ts');const {engine}=await getViewer();const vp=engine.getViewport('panel-A');return {zoom:vp.getZoom(),index:vp.getCurrentImageIdIndex(),width:innerWidth};});
 const initial=await camera();
 const panel=p.locator('[data-panel="A"]'); const rect=await panel.boundingBox();await p.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
 await p.keyboard.down('Control');await p.mouse.wheel(0,-120);await p.keyboard.up('Control');await p.waitForTimeout(300);
 const bigger=await camera();assert.ok(bigger.zoom>initial.zoom);assert.equal(bigger.index,initial.index);assert.equal(bigger.width,initial.width);
 await p.keyboard.down('Control');await p.mouse.wheel(0,120);await p.keyboard.up('Control');await p.waitForTimeout(300);
 const restored=await camera();assert.ok(Math.abs(restored.zoom-initial.zoom)<0.001);assert.equal(restored.index,initial.index);
 await p.mouse.wheel(0,120);await p.waitForTimeout(300);const next=await camera();assert.equal(next.index,(initial.index+1)%5);
 // Active drawing/scroll overlay must not turn Ctrl+wheel into a slice change.
 await p.keyboard.press('s');await p.keyboard.down('Control');await p.mouse.wheel(0,-120);await p.keyboard.up('Control');await p.waitForTimeout(300);
 const overlay=await camera();assert.ok(overlay.zoom>next.zoom);assert.equal(overlay.index,next.index);
 await p.screenshot({path:'outputs/responsive/viewer-ctrl-wheel.png'});
 console.log('Ctrl+wheel zoom in/out, unchanged slice, no browser zoom, normal scroll and overlay passed');
}finally{await b.close();}
