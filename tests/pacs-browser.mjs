// Synthetic, isolated DICOMweb fixture for the real PACS double-click flow.
import http from 'node:http';
import {readFileSync} from 'node:fs';
import dicomParser from 'dicom-parser';
const file=readFileSync(new URL('./fixtures/demo/abdomen-1.dcm',import.meta.url));
const ds=dicomParser.parseDicom(new Uint8Array(file));
const tag=id=>ds.string('x'+id.toLowerCase())||'';
const value=(v,vr='LO')=>({vr,Value:[v]});
const study={'0020000D':value(tag('0020000D'),'UI'),'00100010':value({Alphabetic:'SYNTHETIC^PACS'},'PN'),'00080020':value(tag('00080020'),'DA'),'00080061':value('CT'),'00081030':value('Double-click test'),'00201206':value(1,'IS'),'00201208':value(1,'IS')};
const series={'0020000E':value(tag('0020000E'),'UI'),'00200011':value(2,'IS'),'00080060':value('CT'),'0008103E':value('Synthetic abdomen'),'00201209':value(1,'IS')};
http.createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const json=body=>{res.writeHead(200,{'Content-Type':'application/dicom+json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
 if(path==='/test-pacs/studies'){json([study]);return;}
 if(path.startsWith('/test-pacs/studies/')&&path.endsWith('/series')){setTimeout(()=>json([series]),400);return;}
 if(path.startsWith('/test-pacs/studies/')&&path.endsWith('/instances')){json([{'00080018':value(tag('00080018'),'UI')}]);return;}
 if(path.startsWith('/test-pacs/studies/')&&path.includes('/instances/')){res.writeHead(200,{'Content-Type':'application/dicom'});res.end(file);return;}
 if(path.startsWith('/local-archive-api/')){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"Synthetic test: disk archive disconnected"}');return;}
 const upstream=http.request({hostname:'127.0.0.1',port:5180,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:5180'}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});upstream.on('error',()=>{res.writeHead(502);res.end('Start RADAZ on 5180');});req.pipe(upstream);
}).listen(5185,'127.0.0.1',()=>console.log('PACS double-click fixture: http://localhost:5185; DICOMweb: /test-pacs'));
