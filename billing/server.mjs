import http from 'node:http';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createLicenseService} from './license-service.mjs';
import {isIP} from 'node:net';
import {ownerDirectory} from './owner-settings.mjs';
import {runtimeConfig} from './runtime-config.mjs';
import {createEpointProvider} from './epoint.mjs';
const owner=ownerDirectory(),{settings,privateKey}=runtimeConfig(owner);
const data=path.resolve(process.env.RADAZ_BILLING_DATA||path.join(owner,'billing-data'));mkdirSync(data,{recursive:true,mode:0o700});
const provider=!privateKey?undefined:process.env.RADAZ_PAYMENT_ADAPTER?(await import(pathToFileURL(path.resolve(process.env.RADAZ_PAYMENT_ADAPTER)))).default:createEpointProvider(settings);
if(provider&&(!provider.createCheckout||!provider.verifyWebhook))throw new Error('Payment adapter must implement createCheckout and verifyWebhook.');
const service=createLicenseService({database:path.join(data,'billing.sqlite'),privateKey,provider});
const windows=new Map();
const server=http.createServer(async(req,res)=>{
 const reply=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
 try{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/healthz'){reply(200,{ok:true,paymentsEnabled:!!provider});return;}
  const forwarded=req.headers['x-real-ip'];
  const address=process.env.RADAZ_TRUST_PROXY==='1'&&typeof forwarded==='string'&&isIP(forwarded)?forwarded:req.socket.remoteAddress,now=Date.now();let rate=windows.get(address);if(!rate||rate.until<now){rate={count:0,until:now+60000};windows.set(address,rate);}if(++rate.count>120){reply(429,{error:'Bir az gözləyib yenidən sınayın.'});return;}if(windows.size>10000)for(const [id,item]of windows)if(item.until<now)windows.delete(id);
  if(req.method==='GET'&&url.pathname==='/payment/return'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"});res.end('<!doctype html><html lang="az"><meta charset="utf-8"><title>RADAZ ödənişi</title><body style="font:20px system-ui;padding:40px;background:#102331;color:white"><h1>RADAZ-a qayıdın</h1><p>Ödəniş pəncərəsini bağlayıb RADAZ-da Lisenziya ödənişi bölməsinə qayıdın.</p><p>Bank təsdiqi serverə çatdıqda açar həmin bölmədə görünəcək. Bu səhifənin açılması ödəniş təsdiqi sayılmır.</p></body></html>');return;}
  if(req.method==='GET'&&url.pathname==='/v1/catalog'){reply(200,service.catalog());return;}
  if(req.method==='GET'&&/^\/v1\/orders\/[a-f0-9-]{36}$/.test(url.pathname)){reply(200,service.status(url.pathname.split('/').pop(),req.headers.authorization?.replace(/^Bearer /,'')));return;}
  if(req.method!=='POST'){reply(404,{error:'Ünvan tapılmadı'});return;}
  const parts=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>65536){reply(413,{error:'Sorğu həddindən böyükdür'});return;}parts.push(chunk);}const rawBody=Buffer.concat(parts);
  if(url.pathname==='/v1/webhooks/provider'){
   if(!provider){reply(503,{error:'Ödəniş provayderi qoşulmayıb'});return;}
   const event=await provider.verifyWebhook({headers:req.headers,rawBody});reply(200,service.confirmPayment(event));return;
  }
  if(!(req.headers['content-type']||'').startsWith('application/json'))throw new Error('JSON tələb olunur');
  const body=JSON.parse(rawBody.toString('utf8'));
  if(url.pathname==='/v1/orders'){reply(200,await service.checkout(body.months));return;}
  if(url.pathname==='/v1/activate'){if(!privateKey){reply(503,{error:'Lisenziya serverinin imza açarı hələ qoşulmayıb.'});return;}reply(200,service.activate(body.code,body.deviceId));return;}
  reply(404,{error:'Ünvan tapılmadı'});
 }catch(error){reply(400,{error:error.message||'Sorğu alınmadı'});}
});
server.listen(Number(process.env.PORT||8790),process.env.RADAZ_BIND||'127.0.0.1',()=>console.log(`RADAZ billing service ready on port ${server.address().port}. Payments ${provider?'enabled':'disabled'}. Use HTTPS in production.`));
process.on('SIGTERM',()=>server.close(()=>{service.close();process.exit();}));
