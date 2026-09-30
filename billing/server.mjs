import http from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createLicenseService} from './license-service.mjs';
const keyPath=process.env.RADAZ_ISSUER_PRIVATE_KEY;
if(!keyPath)throw new Error('RADAZ_ISSUER_PRIVATE_KEY must point to the seller private key.');
const data=path.resolve(process.env.RADAZ_BILLING_DATA||'billing-data');mkdirSync(data,{recursive:true});
const provider=process.env.RADAZ_PAYMENT_ADAPTER?(await import(pathToFileURL(path.resolve(process.env.RADAZ_PAYMENT_ADAPTER)))).default:undefined;
if(provider&&(!provider.createCheckout||!provider.verifyWebhook))throw new Error('Payment adapter must implement createCheckout and verifyWebhook.');
const service=createLicenseService({database:path.join(data,'billing.sqlite'),privateKey:readFileSync(keyPath),provider});
const windows=new Map();
const server=http.createServer(async(req,res)=>{
 const reply=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
 try{
  const address=req.socket.remoteAddress,now=Date.now();let rate=windows.get(address);if(!rate||rate.until<now){rate={count:0,until:now+60000};windows.set(address,rate);}if(++rate.count>60){reply(429,{error:'Bir az gözləyib yenidən sınayın.'});return;}if(windows.size>10000)for(const [id,item]of windows)if(item.until<now)windows.delete(id);
  const url=new URL(req.url,'http://localhost');
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
  if(url.pathname==='/v1/activate'){reply(200,service.activate(body.code,body.deviceId));return;}
  reply(404,{error:'Ünvan tapılmadı'});
 }catch(error){reply(400,{error:error.message||'Sorğu alınmadı'});}
});
server.listen(Number(process.env.PORT||8790),'127.0.0.1',()=>console.log('RADAZ billing service ready. Use a HTTPS reverse proxy in production.'));
process.on('SIGTERM',()=>server.close(()=>{service.close();process.exit();}));
