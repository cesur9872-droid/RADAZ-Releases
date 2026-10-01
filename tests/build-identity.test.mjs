import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sourceHash, writeBuildIdentity } from '../scripts/build-identity.mjs';
import { isNewerRelease } from '../lib/release-version.ts';

test('runtime identity ties the installed version to the source and compiled output', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'radaz-identity-'));
  try {
    for (const folder of ['public','app','scripts','dist/client','dist/server']) mkdirSync(path.join(root,folder),{recursive:true});
    writeFileSync(path.join(root,'public/product.json'),JSON.stringify({version:'0.2.7'}));
    writeFileSync(path.join(root,'app/page.tsx'),'first');
    writeFileSync(path.join(root,'dist/server/index.js'),'compiled first');
    const source = sourceHash(root), first = writeBuildIdentity(root,source);
    assert.equal(first.product.version,'0.2.7');
    assert.equal(sourceHash(root),source,'Build output must not change source fingerprint');
    assert.deepEqual(writeBuildIdentity(root,source),first,'Build metadata must not hash itself');
    writeFileSync(path.join(root,'app/page.tsx'),'changed while building');
    assert.throws(()=>writeBuildIdentity(root,source),/Source changed/);
    const next=writeBuildIdentity(root,sourceHash(root));
    assert.notEqual(next.buildId,first.buildId);
    writeFileSync(path.join(root,'dist/server/index.js'),'compiled second');
    assert.notEqual(writeBuildIdentity(root,sourceHash(root)).buildId,next.buildId);
  } finally { assert.ok(path.resolve(root).startsWith(path.join(tmpdir(),'radaz-identity-'))); rmSync(root,{recursive:true,force:true}); }
});

test('an older archive service cannot advertise the current viewer version as an update',()=>{
  assert.equal(isNewerRelease('0.2.7','0.2.7'),false);
  assert.equal(isNewerRelease('0.2.6','0.2.7'),false);
  assert.equal(isNewerRelease('0.2.10','0.2.7'),true);
  assert.equal(isNewerRelease('1.0.0','0.2.7'),true);
  assert.equal(isNewerRelease(undefined,'0.2.7'),false);
});
