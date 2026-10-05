import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify,createPublicKey} from 'node:crypto';
import {defaultCommerce,validateCommerce,convertMinor,fetchExchange,signPolicy,verifyPolicy} from '../billing/commerce.mjs';
import {createLicenseService} from '../billing/license-service.mjs';
const exchange={usdAzn:1.7,date:'2026-10-06',checkedAt:Date.now(),source:'CBAR'};
test('USD/AZN minor-unit conversion and official nominal/date are correct',async()=>{
 assert.equal(convertMinor(1000,'USD','AZN',exchange),1700);assert.equal(convertMinor(1700,'AZN','USD',exchange),1000);assert.equal(convertMinor(1000,'AZN','USD',exchange),588);
 assert.throws(()=>convertMinor(1000,'USD','AZN',null));assert.throws(()=>convertMinor(1000,'USD','AZN',{...exchange,checkedAt:0},{fresh:true}));
 const e=await fetchExchange(async url=>{assert.match(url,/^https:\/\/www.cbar.az\/currencies\//);return {ok:true,text:async()=>'<ValCurs Date="05.10.2026"><Valute Code="USD"><Nominal>1</Nominal><Value>1.7000</Value></Valute></ValCurs>'};});
 assert.equal(e.usdAzn,1.7);assert.equal(e.date,'2026-10-05');
});
test('public signed policy excludes unknown/private fields and rejects tamper and rollback',()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});const c={...defaultCommerce(),exchange,trialDays:45,monthlyMinor:1000,baseCurrency:'USD',iban:'DO NOT PUBLISH',epointPrivateKey:'SECRET'};
 const signed=signPolicy(c,privateKey),verified=verifyPolicy(signed,publicKey);assert.equal(verified.trialDays,45);assert.equal(JSON.stringify(verified).includes('SECRET'),false);assert.equal(JSON.stringify(verified).includes('DO NOT PUBLISH'),false);
 const parts=signed.policy.split('.');parts[1]=Buffer.from(JSON.stringify({...verified,trialDays:365})).toString('base64url');assert.throws(()=>verifyPolicy({policy:parts.join('.')},publicKey));assert.throws(()=>verifyPolicy(signed,publicKey,verified.revision+1));
});
test('module payment snapshots price/currency; signed activation grants only purchased module',async()=>{
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});let c={...defaultCommerce(),baseCurrency:'USD',monthlyMinor:1000,exchange,modules:[{id:'future-module',name:'Future module',monthlyMinor:500,enabled:true}]},payment;
 const provider={currencies:['AZN','USD'],async createCheckout(p){payment=p;return {id:'tx-'+p.orderId,url:'https://payments.example.test/pay'};}};
 const service=createLicenseService({database:':memory:',privateKey,provider,commerce:()=>c});try{
  const order=await service.checkout(2,{currency:'AZN',moduleId:'future-module'});assert.equal(payment.amountMinor,1700);assert.equal(order.moduleId,'future-module');
  c={...c,monthlyMinor:9000,modules:[]};
  const event={orderId:order.id,providerOrder:payment.id||'tx-'+order.id,id:'paid-once',status:'paid',amountMinor:1700,currency:'AZN'};
  assert.throws(()=>service.confirmPayment({...event,currency:'USD'}));assert.throws(()=>service.confirmPayment({...event,amountMinor:1}));service.confirmPayment(event);
  const paid=service.status(order.id,order.token),one=service.activate(paid.activationCode,'A'.repeat(64)),two=service.activate(paid.activationCode,'A'.repeat(64));assert.equal(one.expiresAt,two.expiresAt);
  const [prefix,payload,signature]=one.key.split('.');assert.ok(verify('RSA-SHA256',Buffer.from(prefix+'.'+payload),createPublicKey(privateKey),Buffer.from(signature,'base64url')));assert.equal(JSON.parse(Buffer.from(payload,'base64url')).moduleId,'future-module');
  assert.throws(()=>service.activate(paid.activationCode,'B'.repeat(64)));await assert.rejects(service.checkout(1,{moduleId:'future-module'}));await assert.rejects(service.checkout(1,{currency:'EUR'}));
 }finally{service.close();}
});
test('trial, module identities, duplicate IDs, fractional minor units are validated',()=>{
 for(const changes of [{trialDays:366},{trialDays:-1},{trialDays:1.5},{monthlyMinor:1.5},{modules:[{id:'../admin',name:'Bad',monthlyMinor:100,enabled:true}]},{billingUrl:'http://unsafe.example'}])assert.throws(()=>validateCommerce({...defaultCommerce(),...changes}));
});
