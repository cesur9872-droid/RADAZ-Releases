// Test-only proxy: verifies the real UI with an expired license, without changing user licenses.
import http from 'node:http';
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync(new URL('../public/product.json',import.meta.url),'utf8'));
http.createServer((req,res)=>{
 const json=value=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 if(req.url==='/product.json'){json({...config,licenseRequired:true});return;}
 if(req.url==='/local-archive-api/license'){json({valid:false,required:true,deviceId:'A'.repeat(64),message:'Sınaq: lisenziyanın müddəti bitib.'});return;}
 if(req.url==='/local-archive-api/billing/catalog'){json({enabled:false,monthly:10,currency:'AZN',maxMonths:120});return;}
 const upstream=http.request({hostname:'127.0.0.1',port:5180,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:5180'}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
 upstream.on('error',()=>{res.writeHead(502);res.end('Start the development app on port 5180.');});req.pipe(upstream);
}).listen(5184,'127.0.0.1',()=>console.log('Expired-license UI fixture: http://localhost:5184'));
