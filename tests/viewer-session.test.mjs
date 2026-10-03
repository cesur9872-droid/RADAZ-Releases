import test from 'node:test';
import assert from 'node:assert/strict';
import {registerViewer,openStudyInViewer,openStudiesInViewer,requestedStudies,focusViewer,notifyViewerProgress} from '../lib/viewer-session.ts';
let opened=[],navigated=[];
const open=(url,name)=>{opened.push([url,name]);return {name,closed:false,focus(){},location:{assign:url=>navigated.push(url)}};};
globalThis.window={name:'',open,location:{origin:'http://localhost',assign:url=>navigated.push(url)}};
test('each study owns a different Viewer, with no existing-study replacement',async()=>{
  const loaded=[];const stop=registerViewer(async uid=>loaded.push(uid));
  try {await openStudyInViewer('1.2.3');await openStudyInViewer('1.2.4');assert.equal(opened.length,2);assert.notEqual(opened[0][1],opened[1][1]);assert.deepEqual(loaded,[]);assert.deepEqual(navigated,[]);}finally{stop();}
});
test('PACS reserves once, receives scoped progress, then opens only that tab',async()=>{
  opened=[];navigated=[];const tab=focusViewer();window.name=tab.name;const values=[];const stop=registerViewer(async()=>{},p=>values.push(p));
  try {notifyViewerProgress(tab,{label:'PACS',done:12,total:20});await new Promise(r=>setTimeout(r,30));assert.equal(values[0].done,12);assert.equal(await openStudyInViewer('1.2.4',tab),'new');assert.equal(opened.length,1);assert.deepEqual(navigated,['/#archive-study=1.2.4']);}finally{stop();}
});
test('popup denial preserves the current patient and reports a recoverable error',async()=>{
  navigated=[];window.open=()=>null;try{await assert.rejects(openStudyInViewer('1.2.5'),/pop-up/);assert.deepEqual(navigated,[]);}finally{window.open=open;}
});
test('reject malformed study IDs before opening',async()=>{await assert.rejects(openStudyInViewer('https://external.invalid'));await assert.rejects(openStudyInViewer('1.'.repeat(40)+'2'));});
test('a checkbox selection opens once and round-trips exactly those study IDs',async()=>{
 opened=[];await openStudiesInViewer(['1.2.3','1.2.4','1.2.3']);assert.equal(opened.length,1);
 assert.deepEqual(requestedStudies(opened[0][0].slice(1)),['1.2.3','1.2.4']);
 assert.deepEqual(requestedStudies('#archive-study=1.2.5'),['1.2.5']);
 assert.throws(()=>requestedStudies('#archive-studies=1.2.3,https://bad'));await assert.rejects(openStudiesInViewer([]));
});
