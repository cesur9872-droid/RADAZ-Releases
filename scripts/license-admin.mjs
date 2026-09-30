// Run only on the seller's computer. Never distribute the admin directory/private key.
import {generateKeyPairSync,randomUUID,sign,createPrivateKey,createPublicKey} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2),command=args.shift();
const flags={};for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||!args[i+1])throw new Error('Arguments: --name value');flags[args[i].slice(2)]=args[i+1];}
const root=path.resolve(flags.dir||path.join(os.homedir(),'Documents','RADAZ-License-Admin'));
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
fs.mkdirSync(root,{recursive:true});
const privatePath=path.join(root,'issuer-private.pem'),ledgerPath=path.join(root,'subscriptions.json');
function save(p,value){const temp=p+'.tmp';const fd=fs.openSync(temp,'w',0o600);try{fs.writeFileSync(fd,JSON.stringify(value,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temp,p);}
function expiry(period,base=Date.now()){const d=new Date(base);const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+(period==='yearly'?12:1));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return Math.floor(d.getTime()/1000);}
const lock=path.join(root,'.admin.lock');let fd;
try{
 fd=fs.openSync(lock,'wx');
 if(command==='init'){
  if(!fs.existsSync(privatePath)){const keys=generateKeyPairSync('rsa',{modulusLength:3072,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});fs.writeFileSync(privatePath,keys.privateKey,{mode:0o600,flag:'wx'});}
  const key=createPublicKey(createPrivateKey(fs.readFileSync(privatePath))).export({format:'jwk'});
  save(path.join(root,'issuer-public.json'),key);save(path.resolve(flags.public||path.join(project,'public','license-public.json')),key);
  console.log('Issuer initialized. Private key stays in admin directory. Back it up securely.');
 }else{
  if(!fs.existsSync(privatePath))throw new Error('Run init first.');
  const ledger=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,'utf8')):{subscriptions:[]};
  if(command==='create'){
   const seats=Number(flags.seats),period=flags.period;if(!Number.isInteger(seats)||seats<1||seats>1000||period!=='monthly'||!flags.customer?.trim()||flags.customer.length>200)throw new Error('create --customer Name --seats 1 --period monthly');
   const subscription={id:randomUUID(),customer:flags.customer.trim(),seats,plan:period,expiresAt:expiry(period),activations:[]};ledger.subscriptions.push(subscription);save(ledgerPath,ledger);console.log(subscription.id);
  }else if(command==='activate'){
   const subscription=ledger.subscriptions.find(s=>s.id===flags.license);if(!subscription)throw new Error('Subscription not found.');
   const device=String(flags.device||'').toUpperCase();if(!/^[A-F0-9]{64}$/.test(device))throw new Error('Device ID must be 64 hexadecimal characters.');
   if(subscription.expiresAt<=Date.now()/1000)throw new Error('Subscription expired. Renew first.');
   let activation=subscription.activations.find(a=>a.deviceId===device);
   if(!activation){if(subscription.activations.length>=subscription.seats)throw new Error('Seat limit reached. Existing offline activations remain valid until expiry.');activation={id:randomUUID(),deviceId:device};subscription.activations.push(activation);}
   const claims={v:1,product:'RADAZ',licenseId:subscription.id,activationId:activation.id,customer:subscription.customer,plan:subscription.plan,seats:subscription.seats,deviceId:device,issuedAt:Math.floor(Date.now()/1000),expiresAt:subscription.expiresAt};
   const payload='RADAZ1.'+Buffer.from(JSON.stringify(claims)).toString('base64url');const key=payload+'.'+sign('RSA-SHA256',Buffer.from(payload),fs.readFileSync(privatePath)).toString('base64url');
   if(!flags.out)throw new Error('Specify --out activation.txt to save the key.');save(ledgerPath,ledger);fs.writeFileSync(path.resolve(flags.out),key+'\n',{mode:0o600});console.log('Activation saved.');
  }else if(command==='renew'){
   const subscription=ledger.subscriptions.find(s=>s.id===flags.license);if(!subscription)throw new Error('Subscription not found.');
   const next=expiry(subscription.plan,Math.max(Date.now(),subscription.expiresAt*1000));
   subscription.expiresAt=next;save(ledgerPath,ledger);console.log('Renewed. Reissue each device activation using activate.');
  }else if(command==='list'){console.log(JSON.stringify(ledger.subscriptions.map(s=>({id:s.id,customer:s.customer,plan:s.plan,seats:s.seats,used:s.activations.length,expires:new Date(s.expiresAt*1000).toISOString()})),null,2));}
  else throw new Error('Commands: init, create, activate, renew, list. See DISTRIBUTION.md.');
 }
}catch(error){console.error(error.message);process.exitCode=1;}finally{if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(lock);}}
