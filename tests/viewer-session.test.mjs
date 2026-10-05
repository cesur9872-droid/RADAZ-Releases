import test from 'node:test';
import assert from 'node:assert/strict';
import {registerViewer,openStudyInViewer,openStudiesInViewer,requestedStudies,focusViewer,notifyViewerProgress} from '../lib/viewer-session.ts';
let opened=[],navigated=[];
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
const open=(url,name)=>{opened.push([url,name]);return {name,closed:false,focus(){},location:{href:'http://localhost/',assign:url=>navigated.push(url),replace:url=>navigated.push(url)}};};
globalThis.window={name:'',open,focus(){},addEventListener(){},removeEventListener(){}};
test('reuses the registered Viewer and loads each selection in place',async()=>{
 const loaded=[],stop=registerViewer(async ids=>loaded.push(ids));
 try{
  assert.equal(await openStudyInViewer('1.2.3'),'reused');
  assert.equal(await openStudiesInViewer(['1.2.4','1.2.5','1.2.4']),'reused');
  assert.equal(opened.length,0);assert.deepEqual(loaded,[['1.2.3'],['1.2.4','1.2.5']]);assert.deepEqual(navigated,[]);
 }finally{stop();}
});
test('PACS reserves the existing tab and delivers scoped progress',async()=>{
 opened=[];navigated=[];const values=[],stop=registerViewer(async()=>{},p=>values.push(p));
 try{const tab=await focusViewer();notifyViewerProgress(tab,{label:'PACS',done:12,total:20});await new Promise(r=>setTimeout(r,30));assert.equal(values[0].done,12);assert.equal(await openStudyInViewer('1.2.4',tab),'reused');assert.equal(opened.length,0);assert.deepEqual(navigated,[]);}finally{stop();}
});
test('closed or unready Viewer receives a complete selection URL in the reserved tab',async()=>{
 opened=[];navigated=[];assert.equal(await openStudiesInViewer(['1.2.3','1.2.4','1.2.3']),'new');assert.equal(opened.length,1);
 assert.deepEqual(requestedStudies(navigated[0].slice(1)),['1.2.3','1.2.4']);
});
test('popup denial is recoverable and invalid IDs never navigate',async()=>{
 navigated=[];window.open=()=>null;
 try{await assert.rejects(openStudyInViewer('1.2.5'),/pop-up/);assert.deepEqual(navigated,[]);}finally{window.open=open;}
 await assert.rejects(openStudyInViewer('https://external.invalid'));await assert.rejects(openStudiesInViewer([]));
 assert.throws(()=>requestedStudies('#archive-studies=1.2.3,https://bad'));
});
