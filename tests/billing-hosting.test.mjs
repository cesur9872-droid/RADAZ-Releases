import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('an unconfigured hosting deployment is healthy but cannot take payment or activate a license',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'radaz-hosting-test-'));
 const child=spawn(process.execPath,['billing/server.mjs'],{cwd:new URL('..',import.meta.url),windowsHide:true,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,USERPROFILE:process.env.USERPROFILE,RADAZ_OWNER_DIR:root,RADAZ_BILLING_DATA:path.join(root,'orders'),RENDER_EXTERNAL_URL:'https://synthetic-radaz.onrender.com',RADAZ_PAYMENTS_ENABLED:'false',PORT:'0'},stdio:['ignore','pipe','pipe']});
 const exit=once(child,'exit');
 try{
  const port=await new Promise((resolve,reject)=>{let output='';const timeout=setTimeout(()=>reject(new Error('Billing test startup timed out')),10000);child.stdout.on('data',data=>{output+=data;const match=output.match(/ready on port (\d+)/);if(match){clearTimeout(timeout);resolve(match[1]);}});child.once('error',error=>{clearTimeout(timeout);reject(error);});child.once('exit',code=>{clearTimeout(timeout);reject(new Error('Billing test exited '+code));});});
  const base='http://127.0.0.1:'+port;
  const health=await fetch(base+'/healthz');assert.equal(health.status,200);assert.deepEqual(await health.json(),{ok:true,paymentsEnabled:false});
  const catalog=await (await fetch(base+'/v1/catalog')).json();assert.equal(catalog.enabled,false);assert.equal(catalog.monthly,10);
  const post=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await fetch(base+'/v1/orders',post({months:3}))).status,400);
  assert.equal((await fetch(base+'/v1/activate',post({code:'anything',deviceId:'A'.repeat(64)}))).status,503);
  assert.equal((await fetch(base+'/settings')).status,404);
  assert.equal((await fetch(base+'/owner.html')).status,404);
 }finally{if(child.exitCode===null)child.kill();await exit;assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'radaz-hosting-test-'));rmSync(root,{recursive:true,force:true});}
});
