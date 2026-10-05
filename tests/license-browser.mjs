// Test-only proxy: verifies trial/expired UI without changing user licenses.
import http from 'node:http';
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync(new URL('../public/product.json',import.meta.url),'utf8'));
const trial=process.env.RADAZ_LICENSE_SCENARIO==='trial',port=Number(process.env.RADAZ_TEST_PORT||5184);
const expiresAt=Math.floor(Date.now()/1000)+(trial?7*86400:-1);
const server=http.createServer((req,res)=>{
 const json=value=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 if(req.url==='/product.json'){json({...config,licenseRequired:true});return;}
 if(req.url==='/local-archive-api/license'){json({valid:trial,required:true,deviceId:'A'.repeat(64),kind:trial?'trial':'expired',trial:{valid:trial,expiresAt,daysRemaining:trial?30:0},message:trial?'30 günlük pulsuz demo aktivdir.':'30 günlük pulsuz demo bitib.'});return;}
 if(req.url==='/local-archive-api/billing/catalog'){json({enabled:false,monthly:10,currency:'AZN',maxMonths:120});return;}
 const upstream=http.request({hostname:'127.0.0.1',port:5180,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:5180'}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
 upstream.on('error',()=>{res.writeHead(502);res.end('Start the development app on port 5180.');});req.pipe(upstream);
}).listen(port,'127.0.0.1',()=>console.log(`${trial?'Trial':'Expired'} UI fixture: http://localhost:${server.address().port}`));
