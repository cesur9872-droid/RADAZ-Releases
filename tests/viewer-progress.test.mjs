import test from 'node:test';
import assert from 'node:assert/strict';
import {progressPercent} from '../lib/work-progress.ts';
import {measurementState,measurementTheme} from '../lib/measurement-theme.ts';
import {intersectPlanes,worldAt,normalOf} from '../lib/localizer.ts';
test('progress reports completed units and never invented elapsed time',()=>{
  assert.equal(progressPercent(842,1241),67);assert.equal(progressPercent(0,0),0);assert.equal(progressPercent(1241,1241),100);
  assert.equal(progressPercent(2,3),66);assert.equal(progressPercent(200,100),100);
});
test('each measurement state is distinct and hover returns to selected when the pointer leaves',()=>{
  assert.equal(new Set(['normal','hover','selected','drawing'].map(s=>measurementTheme[s].color)).size,4);
  assert.equal(measurementState(false,true,true),'hover');assert.equal(measurementState(false,true,false),'selected');assert.equal(measurementState(true,true,true),'drawing');assert.equal(measurementState(false,false,true),'hover');
});
const base={studyId:'1.2.3',frameId:'1.2.4',origin:[10,20,30],columnDirection:[1,0,0],rowDirection:[0,1,0],columnSpacing:.7,rowSpacing:1.2,columns:512,rows:512};
test('shared intersection uses DICOM millimetres with anisotropic pixels',()=>{
  const axial={...base},sag={...base,origin:[17,20,30],columnDirection:[0,1,0],rowDirection:[0,0,1]},cor={...base,origin:[10,44,30],columnDirection:[1,0,0],rowDirection:[0,0,1]};
  assert.deepEqual(intersectPlanes([axial,sag,cor]),[17,44,30]);
  assert.deepEqual(worldAt(base,10,20),[17,44,30]);
  const radians=.3,n=[Math.cos(radians),Math.sin(radians),0];
  const rotated={...sag,origin:[17,44,30],columnDirection:[-n[1],n[0],0]};
  const intersection=intersectPlanes([axial,rotated,cor]);
  assert.ok(intersection.every((v,i)=>Math.abs(v-[17,44,30][i])<1e-9));
  assert.deepEqual(normalOf(cor),[0,-1,0]);
  assert.equal(intersectPlanes([axial,axial,cor]),null);
  assert.equal(intersectPlanes([axial,{...sag,frameId:'different'},cor]),null);
});
