// Isolated synthetic UI fixture. Never reads or changes patient data or real licenses.
import http from 'node:http';
import {readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createOwnerConsole} from '../billing/owner-console.mjs';
const product=JSON.parse(readFileSync(new URL('../public/product.json',import.meta.url),'utf8'));
const day = offset => { const d=new Date(); d.setDate(d.getDate()+offset); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10).replaceAll('-',''); };
const studies=[['2','Z SINAQ',day(0),2],['10','A SINAQ',day(-1),10]].map(([id,patient,date,imageCount])=>({
 storage:'disk',uid:`1.2.826.0.1.${id}`,patient,date,imageCount,time:'120000',patientId:`TEST-${id}`,birth:'',modality:'CT',description:'Sintetik UI yoxlaması',accession:id,referring:'',size:0,addedAt:1,openedAt:null,
 series:[10,2].map(number=>({uid:`1.2.826.0.1.${id}.${number}`,number:String(number),modality:'CT',description:`Seriya ${number}`,protocol:'Sınaq',imageCount:number,addedAt:1})),
}));
let deleted=[];
let status={capabilities:['delete-studies'],aeTitle:'TEST_ARCHIVE',port:11113,enabled:true,running:true,error:'',addresses:['127.0.0.1'],databasePath:'Synthetic UI fixture / archive.sqlite3',storagePath:'Synthetic UI fixture / instances',instanceCount:12,size:0};
const value=(v,vr='LO')=>({vr,Value:[v]});
http.createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const json=data=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(path==='/product.json')return json({...product,licenseRequired:true});
 if(path==='/local-archive-api/license')return json({valid:true,required:true,deviceId:'SYNTHETIC-UI-TEST',message:'Yalnız sintetik brauzer sınağı.'});
 if(path==='/local-archive-api/status')return json(status);
 if(path==='/local-archive-api/studies')return json(studies.filter(s=>!deleted.includes(s.uid)));
 if(path==='/local-archive-api/studies/delete'){let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{deleted.push(...JSON.parse(body).studies);json({freedBytes:1234,pendingBytes:0});});return;}
 if(path==='/test-reset'){deleted=[];return json({ok:true});}
 if(path==='/test-deleted')return json(deleted);
 if(path==='/local-archive-api/settings'){let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{const input=JSON.parse(body);status={...status,...input,running:input.enabled};json(status);});return;}
 if(path==='/local-archive-api/billing/catalog')return json({enabled:false,monthly:10,currency:'AZN',maxMonths:120});
 if(path==='/local-archive-api/updates')return json({state:'current',message:'Sintetik UI sınağı.'});
 if(path==='/test-pacs/studies')return json(studies.map(s=>({'0020000D':value(s.uid,'UI'),'00100010':value({Alphabetic:s.patient},'PN'),'00100020':value(s.patientId),'00080020':value(s.date,'DA'),'00080061':value(s.modality),'00081030':value(s.description),'00201206':value(2,'IS'),'00201208':value(s.imageCount,'IS')})));
 if(path.startsWith('/test-pacs/studies/')&&path.endsWith('/series'))return json(studies[0].series.map(s=>({'0020000E':value(s.uid,'UI'),'00200011':value(s.number,'IS'),'00080060':value(s.modality),'0008103E':value(s.description),'00201209':value(s.imageCount,'IS')})));
 if(path.startsWith('/local-archive-api/')){res.writeHead(404);res.end('Synthetic fixture has no clinical files.');return;}
 const upstream=http.request({hostname:'127.0.0.1',port:5180,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:5180'}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
 upstream.on('error',()=>{res.writeHead(502);res.end('Start RADAZ development server on 5180.');});req.pipe(upstream);
}).listen(5186,'127.0.0.1',()=>console.log('Synthetic records UI: http://localhost:5186/archive; DICOMweb /test-pacs'));
// A separate, temporary owner form; no actual merchant credentials are loaded.
const owner=createOwnerConsole({root:mkdtempSync(join(tmpdir(),'radaz-owner-preview-')),token:'synthetic-owner-ui-test'});
owner.server.listen(5187,'127.0.0.1',()=>console.log('Synthetic owner UI: http://127.0.0.1:5187/#synthetic-owner-ui-test'));
