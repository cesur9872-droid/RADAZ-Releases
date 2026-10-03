// Dev-only module access tests the native Cornerstone volume, not a reimplementation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();
 const files=readdirSync('outputs/oblique-fixture').filter(f=>f.endsWith('.dcm')).reverse().map(f=>readFileSync('outputs/oblique-fixture/'+f));
 await page.route('**/test-volume/*',route=>route.fulfill({body:files[Number(new URL(route.request().url()).pathname.split('/').pop())]}));
 await page.route('**/local-archive-api/**',route=>route.fulfill({json:{valid:true,required:true}}));
 await page.goto((process.env.RADAZ_TEST_URL||'http://127.0.0.1:5197')+'/archive');
 const result=await page.evaluate(async count=>{
  const api=await import('/lib/cornerstone.ts'),{parseDicomFile}=await import('/lib/dicom-file.ts');
  const {core}=await api.getViewer(),ids=[];
  for(let i=0;i<count;i++){const bytes=new Uint8Array(await(await fetch('/test-volume/'+i)).arrayBuffer());ids.push(api.registerLocalDicom(bytes,parseDicomFile(bytes)));}
  const stream=await api.getSeriesVolume(ids);
  await Promise.all(ids.map(id=>core.imageLoader.loadAndCacheImage(id)));
  const repeated=await api.getSeriesVolume([...ids].reverse());
  const volume=stream.volume;
  const samples=[];
  for(const id of ids){
   const g=api.getLocalizerGeometry(id);
   for(const [x,y] of [[1,1],[20,30],[32,32],[50,50]]){
    const world=g.origin.map((v,i)=>v+x*g.columnSpacing*g.columnDirection[i]+y*g.rowSpacing*g.rowDirection[i]);
    const ijk=volume.imageData.worldToIndex(world).map(Math.round);
    samples.push([api.sampleLocalDicom(id,world),volume.voxelManager.getAtIJKPoint(ijk)]);
   }
  }
  const settings=Object.fromEntries(['AX','COR','SAG'].map(p=>[p,{mode:'MPR',thickness:1}]));
  const stacks=api.createMprStacks(ids,settings);
  const g=api.getLocalizerGeometry(stacks.COR[30]);
  const mprWorld=g.origin.map((v,i)=>v+20*g.columnSpacing*g.columnDirection[i]);
  const mprValue=api.sampleLocalDicom(stacks.COR[30],mprWorld);
  const sharedValue=volume.voxelManager.getAtIJKPoint(volume.imageData.worldToIndex(mprWorld).map(Math.round));
  const small=await api.getSeriesVolume(stream.geometry.imageIds.slice(0,3),{maxDimension:32,budgetBytes:32*32*3*4});
  const metrics=window.radazPerformance();
  const data={samples,mprValue,sharedValue,same:stream===repeated,dimensions:volume.dimensions,spacing:volume.spacing,direction:volume.direction,
   thinDimensions:small.volume.dimensions,thinSpacing:small.volume.spacing,metrics};
  api.releaseLocalDicoms([...ids,...stacks.COR,...stacks.SAG]);
  await new Promise(r=>setTimeout(r,50));data.released=!core.cache.getVolume(volume.volumeId)&&!core.cache.getVolume(small.volumeId);
  return data;
 },files.length);
 assert.equal(result.same,true);assert.equal(result.metrics.decodeCount,8);assert.equal(result.released,true);
 assert.ok(result.samples.every(([source,voxel])=>Math.abs(source-voxel)<.001),'HU values and oblique world coordinates agree');
 assert.ok(result.samples.some(([value])=>!Number.isInteger(value)),'Fractional HU retained');
 assert.ok(result.samples.some(([value])=>value<-900),'Air retains negative HU');
 assert.ok(Math.abs(result.mprValue-result.sharedValue)<.001,'MPR uses the same calibrated volume');
 assert.deepEqual(result.thinDimensions,[32,32,3]);assert.ok(Math.abs(result.thinSpacing[2]-1.4)<.001);
 assert.ok(result.direction.some(v=>Math.abs(Math.abs(v)-.6)<.001),'Oblique direction retained');
 console.log('PASS: oblique physical coordinates, fractional/negative HU, shared MPR/3D cache, thin-volume GPU downsampling and release',result);
}finally{await browser.close();}
