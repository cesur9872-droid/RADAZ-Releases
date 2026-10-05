import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFileSync,existsSync,unlinkSync} from 'node:fs';
import {execFile} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadSettings,validateSettings,visibleSettings,ownerDirectory} from './owner-settings.mjs';
import {OwnerVault} from './owner-vault.mjs';
import {defaultCommerce,validateCommerce,fetchExchange,issuerKey,signPolicy} from './commerce.mjs';
import {publishPolicy} from './publish-policy.mjs';
const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);};
export function createOwnerConsole({root=ownerDirectory(),token=randomBytes(32).toString('hex'),now=Date.now,exchange=fetchExchange,publish=publishPolicy}={}){
 const vault=new OwnerVault(root);let session='',lastUse=0,failures=0,blockedUntil=0,authBusy=false;
 const lock=()=>{session='';vault.lock();};
 const server=http.createServer(async(req,res)=>{
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  const origin=`http://127.0.0.1:${server.address().port}`;
  if(req.headers.host!==new URL(origin).host||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site'){reply(403,{error:'Yalnız yerli sahib paneli.'});return;}
  const files={'/':['owner.html','text/html; charset=utf-8'],'/owner-ui.js':['owner-ui.js','text/javascript; charset=utf-8'],'/logo.svg':['../public/radaz-wordmark.svg','image/svg+xml']};
  if(req.method==='GET'&&files[req.url]){const [name,type]=files[req.url];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(readFileSync(new URL(name,import.meta.url)));return;}
  if(!equal(req.headers.authorization,'Bearer '+token)){reply(401,{error:'Sahib panelini öz qısayolundan açın.'});return;}
  if(session&&now()-lastUse>15*60000)lock();
  const cookie=req.headers.cookie?.split('; ').find(c=>c.startsWith('radaz_owner='))?.slice(12);
  const authenticated=!!session&&equal(cookie,session);
  if(req.url==='/auth/status'&&req.method==='GET'){reply(200,{configured:vault.exists,unlocked:authenticated});return;}
  try{
   let body={};
   if(req.method==='POST'){
    if(req.headers.origin!==origin||req.headers['content-type']!=='application/json'){reply(403,{error:'Eyni səhifədən JSON sorğusu tələb olunur.'});return;}
    let data='',size=0;for await(const chunk of req){size+=chunk.length;if(size>32768){reply(413,{error:'Sorğu həddindən böyükdür.'});return;}data+=chunk;}body=JSON.parse(data);
   }
   if(req.url==='/auth/unlock'&&req.method==='POST'){
    if(authBusy||now()<blockedUntil){reply(429,{error:'Giriş cəhdləri çoxdur. Bir dəqiqə sonra sınayın.'});return;}
    authBusy=true;
    try{
     const creating=!vault.exists;
     if(creating&&body.password!==body.confirmPassword)throw Error('Parollar uyğun deyil.');
     const privateFile=path.join(root,'issuer-private.pem');
     const initial=creating?{settings:loadSettings(root),commerce:defaultCommerce(),issuer:existsSync(privateFile)?readFileSync(privateFile,'utf8'):null,revision:0}:undefined;
     await vault.unlock(body.password,initial);
     if(creating){for(const file of [path.join(root,'merchant.json'),privateFile])if(existsSync(file))unlinkSync(file);}
     failures=0;session=randomBytes(32).toString('hex');lastUse=now();
     res.setHeader('Set-Cookie',`radaz_owner=${session}; HttpOnly; SameSite=Strict; Path=/`);reply(200,{ok:true});
    }catch(error){if(++failures>=5){blockedUntil=now()+60000;failures=0;}reply(401,{error:error.message});}finally{authBusy=false;}return;
   }
   if(!authenticated){reply(401,{error:'Sahib parolunu daxil edin.'});return;}lastUse=now();
   if(req.url==='/auth/lock'&&req.method==='POST'){lock();res.setHeader('Set-Cookie','radaz_owner=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');reply(200,{ok:true});return;}
   const visible=()=>({...visibleSettings(vault.data.settings),commerce:vault.data.commerce,issuerConfigured:!!vault.data.issuer,storagePath:root});
   if(req.url==='/settings'&&req.method==='GET'){reply(200,visible());return;}
   if(req.url==='/settings'&&req.method==='POST'){
    const settings=validateSettings(body,vault.data.settings);
    const commerce=validateCommerce({...body.commerce,exchange:vault.data.commerce.exchange});
    vault.data.settings=settings;vault.data.commerce=commerce;vault.save();reply(200,visible());return;
   }
   if(req.url==='/exchange'&&req.method==='POST'){const rate=await exchange();if(!vault.data||!equal(cookie,session))throw Error('Sessiya bitib. Yenidən daxil olun.');vault.data.commerce.exchange=rate;vault.save();reply(200,rate);return;}
   if(['/policy/export','/policy/publish'].includes(req.url)&&req.method==='POST'){
    if(!vault.data.issuer)throw Error('Sahib imza açarı bu kompüterdə yoxdur. Mövcud imza açarını təhlükəsiz bərpa edin.');
    const signed=signPolicy({...vault.data.commerce,billingUrl:vault.data.settings.publicBaseUrl},issuerKey(vault.data.issuer),vault.data.revision);vault.data.revision=JSON.parse(Buffer.from(signed.policy.split('.')[1],'base64url')).revision;vault.save();
    reply(200,req.url.endsWith('publish')?await publish(signed):signed);return;
   }
   reply(404,{error:'Ünvan tapılmadı.'});
  }catch(error){reply(400,{error:error.message});}
 });
 server.on('close',lock);
 const expiry=setInterval(()=>{if(session&&now()-lastUse>15*60000)lock();},30000);expiry.unref();server.on('close',()=>clearInterval(expiry));
 return {server,token};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {server,token}=createOwnerConsole();server.listen(0,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${server.address().port}/#${token}`;
  if(process.platform==='win32')execFile('powershell.exe',['-NoProfile','-Command',`Start-Process '${url}'`],{windowsHide:true});
  console.log('RADAZ sahib paneli açıldı. Parolu yalnız paneldə daxil edin.');
 });
}
