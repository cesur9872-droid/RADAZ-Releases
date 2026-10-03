import test from 'node:test';
import assert from 'node:assert/strict';
import {measureDeviation} from '../lib/deviation-measurement.ts';
test('two-point deviation reports image-horizontal angle and calibrated vertical height',()=>{
 const result=measureDeviation([[0,0,0],[10,10,0]],[1,0,0],[0,1,0]);
 assert.equal(result.height,10);assert.equal(result.angle,45);assert.deepEqual(result.foot,[10,0,0]);
 const oblique=measureDeviation([[12,30,-10],[22,38,-4]],[1,0,0],[0,.8,.6]);
 assert.ok(Math.abs(oblique.height-10)<1e-8);assert.ok(Math.abs(oblique.angle-45)<1e-8);assert.deepEqual(oblique.foot,[22,30,-10]);
 assert.equal(measureDeviation([[0,0,0],[0,-7,0]],[1,0,0],[0,1,0]).angle,90);
 assert.equal(measureDeviation([[0,0,0],[9,0,0]],[1,0,0],[0,1,0]).height,0);
 assert.equal(measureDeviation([[0,0,0],[0,0,0]],[1,0,0],[0,1,0]),null);
});
