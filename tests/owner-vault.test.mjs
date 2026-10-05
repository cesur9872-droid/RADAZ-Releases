import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {OwnerVault} from '../billing/owner-vault.mjs';
test('vault authenticates ciphertext, rejects stale writes, recovers only with correct password',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'radaz-vault-test-'));try{
  const first=new OwnerVault(root);await first.unlock('Synthetic owner passphrase 2026',{account:'private account',issuer:'private issuer'});
  const original=readFileSync(first.file,'utf8');assert.equal(original.includes('private account'),false);assert.equal(original.includes('passphrase'),false);
  const second=new OwnerVault(root);await second.unlock('Synthetic owner passphrase 2026');assert.equal(second.data.account,'private account');
  first.data.account='changed';first.save();second.data.account='stale';assert.throws(()=>second.save(),/başqa paneldə/);first.lock();second.lock();
  await assert.rejects(first.unlock('Incorrect owner passphrase'),/yanlışdır/);assert.equal(first.data,null);
  await first.unlock('Synthetic owner passphrase 2026');assert.equal(first.data.account,'changed');first.lock();
  const tampered=JSON.parse(readFileSync(first.file,'utf8'));tampered.tag='0'.repeat(32);writeFileSync(first.file,JSON.stringify(tampered));await assert.rejects(first.unlock('Synthetic owner passphrase 2026'),/dəyişdirilib/);
 }finally{assert.ok(root.startsWith(path.join(tmpdir(),'radaz-vault-test-')));rmSync(root,{recursive:true,force:true});}
});
