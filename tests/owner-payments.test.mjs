import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {once} from 'node:events';
import {generateKeyPairSync} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {createOwnerConsole} from '../billing/owner-console.mjs';
import {saveSettings,loadSettings,visibleSettings,validateSettings} from '../billing/owner-settings.mjs';
import {createEpointProvider,epointSignature,amountMinor} from '../billing/epoint.mjs';
import {createLicenseService} from '../billing/license-service.mjs';
import {sortRows} from '../lib/table-sort.ts';
import {runtimeConfig} from '../billing/runtime-config.mjs';
const settings={provider:'epoint',enabled:true,publicBaseUrl:'https://license.example.test',epointPublicKey:'test-merchant',epointPrivateKey:'test-secret-not-real',epointRequestUrl:'https://epoint.az/test-endpoint'};
const callback=event=>{const data=Buffer.from(JSON.stringify(event)).toString('base64');return {headers:{'content-type':'application/x-www-form-urlencoded'},rawBody:Buffer.from(new URLSearchParams({data,signature:epointSignature(data,settings.epointPrivateKey)}).toString())};};
const temporary=()=>mkdtempSync(path.join(os.tmpdir(),'radaz-owner-test-'));
function cleanup(root){assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep+'radaz-owner-test-'));rmSync(root,{recursive:true,force:true});}
test('seller settings keep the private key off API responses and preserve blank secrets',()=>{const root=temporary();try{const saved=saveSettings({...settings,iban:'AZ21 NABZ 00000000137010001944'},root);assert.equal(saved.privateKeyConfigured,true);assert.equal(saved.epointPrivateKey,undefined);saveSettings({...saved,epointPrivateKey:'',sellerName:'Test seller'},root);assert.equal(loadSettings(root).epointPrivateKey,settings.epointPrivateKey);assert.equal(JSON.parse(readFileSync(path.join(root,'merchant.json'),'utf8')).sellerName,'Test seller');saveSettings({...saved,enabled:false,clearPrivateKey:true},root);assert.equal(loadSettings(root).epointPrivateKey,'');}finally{cleanup(root);}});
test('payment setup rejects missing keys, wrong API host, invalid IBAN and unsafe URLs',()=>{for(const changes of [{epointPrivateKey:''},{epointRequestUrl:'https://other.example/pay'},{publicBaseUrl:'http://example.test'},{iban:'AZ123'},{taxId:'abc'}])assert.throws(()=>validateSettings({...settings,...changes}));const root=temporary();try{assert.equal(visibleSettings(loadSettings(root)).privateKeyConfigured,false);}finally{cleanup(root);}});
test('local seller API requires its capability and exact local host/origin',async()=>{const root=temporary(),{server,token}=createOwnerConsole({root});server.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${server.address().port}`;try{assert.equal((await fetch(url+'/settings')).status,401);assert.equal((await fetch(url+'/settings',{headers:{Authorization:'Bearer '+token,Origin:'https://foreign.example'}})).status,403);const saved=await fetch(url+'/settings',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:url},body:JSON.stringify(settings)});assert.equal(saved.status,200);assert.equal((await saved.json()).epointPrivateKey,undefined);const loaded=await fetch(url+'/settings',{headers:{Authorization:'Bearer '+token}});const result=await loaded.json();assert.equal(result.privateKeyConfigured,true);assert.equal(result.storagePath,root);assert.equal(JSON.stringify(result).includes(settings.epointPrivateKey),false);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));cleanup(root);}});
test('Epoint checkout signs the server price and produces only AZN payments',async()=>{let payload;const provider=createEpointProvider(settings,async(url,options)=>{assert.equal(url,settings.epointRequestUrl);const data=options.body.get('data');assert.equal(options.body.get('signature'),epointSignature(data,settings.epointPrivateKey));payload=JSON.parse(Buffer.from(data,'base64'));return {ok:true,json:async()=>({status:'success',transaction:'tx-test',redirect_url:'https://bank.example.test/pay'})};});assert.deepEqual(await provider.createCheckout({orderId:'order',amountMinor:3000,currency:'AZN',months:3}),{id:'tx-test',url:'https://bank.example.test/pay'});assert.equal(payload.amount,'30.00');assert.equal(payload.currency,'AZN');assert.equal(payload.success_redirect_url,settings.publicBaseUrl+'/payment/return');await assert.rejects(provider.createCheckout({currency:'USD'}));assert.equal(createEpointProvider({...settings,enabled:false}),undefined);});
test('signed payment callback issues a key only after matching the stored transaction and amount',async()=>{const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const provider=createEpointProvider(settings,async()=>({ok:true,json:async()=>({status:'success',transaction:'tx-one',redirect_url:'https://bank.example.test/pay'})}));const service=createLicenseService({database:':memory:',privateKey,provider});try{const order=await service.checkout(3);const event={order_id:order.id,transaction:'tx-one',status:'success',operation_code:'100',amount:'30.00'};for(const changes of [{amount:'0.01'},{transaction:'wrong'}])assert.throws(()=>service.confirmPayment({...event,orderId:order.id,providerOrder:changes.transaction||'tx-one',id:changes.transaction||'tx-one',status:'paid',currency:'AZN',amountMinor:changes.amount?1:3000}));const confirmed=await provider.verifyWebhook(callback(event));service.confirmPayment(confirmed);const paid=service.status(order.id,order.token);assert.match(paid.activationCode,/^RADAZ-ACT-/);assert.equal(paid.activatedAt,null);service.confirmPayment(confirmed);assert.equal(service.status(order.id,order.token).activationCode,paid.activationCode);}finally{service.close();}});
test('forged callbacks and non-payment events are rejected',async()=>{const provider=createEpointProvider(settings),event={order_id:'id',transaction:'tx',status:'success',operation_code:'100',amount:'10.00'};const forged=callback(event);forged.rawBody=Buffer.from(forged.rawBody.toString().replace('signature=','signature=wrong'));await assert.rejects(provider.verifyWebhook(forged),/imzası/);for(const changes of [{status:'failed'},{operation_code:'001'},{currency:'USD'},{amount:'1e2'},{public_key:'other'}])await assert.rejects(provider.verifyWebhook(callback({...event,...changes})));assert.equal(amountMinor('10.01'),1001);for(const amount of ['1.001','-1','1e2',NaN])assert.throws(()=>amountMinor(amount));});
test('table sort is numeric, stable, reversible, leaves source intact and puts blanks last',()=>{const rows=[{name:'Seriya 10',n:10},{name:'Seriya 2',n:2},{name:'Seriya 2',n:2},{name:'',n:null}],values={name:r=>r.name,n:r=>r.n};assert.deepEqual(sortRows(rows,{key:'n',direction:'asc'},values).map(r=>r.n),[2,2,10,null]);assert.deepEqual(sortRows(rows,{key:'name',direction:'desc'},values),[rows[0],rows[1],rows[2],rows[3]]);assert.equal(rows[0].n,10);assert.deepEqual(sortRows(rows,{key:'name',direction:'asc'},values),[rows[1],rows[2],rows[0],rows[3]]);});

test('bank fields reject wrong IBAN check digits and currency in place of recipient name',()=>{
 assert.throws(()=>validateSettings({iban:'AZ22NABZ00000000137010001944'}),/yoxlama rəqəmləri/);
 assert.throws(()=>validateSettings({beneficiary:'azn'}),/valyuta deyil/);
});
test('cloud configuration derives the real HTTPS host and remains disabled without credentials',()=>{
 const root=temporary();try{
  const result=runtimeConfig(root,{RENDER_EXTERNAL_URL:'https://synthetic-radaz.onrender.com',RADAZ_PAYMENTS_ENABLED:'false'});
  assert.equal(result.settings.publicBaseUrl,'https://synthetic-radaz.onrender.com');assert.equal(result.settings.enabled,false);assert.equal(result.privateKey,null);
  assert.throws(()=>runtimeConfig(root,{RADAZ_PAYMENTS_ENABLED:'true'}),/API inteqrasiyası/);
  assert.throws(()=>runtimeConfig(root,{RADAZ_ISSUER_PRIVATE_KEY_PEM:'not-a-key'}),/PEM formatında/);
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  assert.throws(()=>runtimeConfig(root,{RADAZ_ISSUER_PRIVATE_KEY_PEM:privateKey.export({format:'pem',type:'pkcs8'})}),/public açara uyğun deyil/);
 }finally{cleanup(root);}
});

test('Kapital accounts keep AZN and USD separate and never activate Epoint',()=>{
 const root=temporary();try{
  saveSettings({provider:'kapital',iban:'AZ21NABZ00000000137010001944',usdIban:'',enabled:false},root);
  const value=loadSettings(root);assert.equal(value.provider,'kapital');assert.equal(value.usdIban,'');
  assert.equal(createEpointProvider({...settings,provider:'kapital'}),undefined);
  assert.throws(()=>validateSettings({...value,enabled:true}),/Kapital Bank API/);
  assert.throws(()=>validateSettings({...value,usdIban:'AZ123'}),/IBAN/);
 }finally{cleanup(root);}
});
