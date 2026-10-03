// Built application gateway. DICOM control stays on loopback; the viewer is available on LAN.
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,renameSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!existsSync(path.join(root,'dist/server/index.js')))throw new Error('Built application missing. Run START-RADAZ.cmd from a source checkout or extract the release ZIP.');
const build=JSON.parse(readFileSync(path.join(root,'dist/server/radaz-build.json'),'utf8'));
const product=JSON.parse(readFileSync(path.join(root,'public/product.json'),'utf8'));
if(build.product.version!==product.version)throw new Error('RADAZ files belong to different versions. Extract the complete release ZIP into a new folder.');
const runtime={name:'RADAZ',version:build.product.version,buildId:build.buildId,startedAt:new Date().toISOString()};
const installRoot=process.env.RADAZ_INSTALL_ROOT;
const port=Number(process.env.RADAZ_PORT||5173),workerPort=Number(process.env.RADAZ_WORKER_PORT||5175),archivePort=Number(process.env.RADAZ_ARCHIVE_PORT||8766);
if(![port,workerPort,archivePort].every(p=>Number.isInteger(p)&&p>0&&p<=65535)||new Set([port,workerPort,archivePort]).size!==3)throw new Error('Invalid server ports');
const workerArgs=existsSync(path.join(root,'dist/runtime/web-server.mjs'))?['dist/runtime/web-server.mjs']:['node_modules/vinext/dist/cli.js','start','--port',String(workerPort),'--hostname','127.0.0.1'];
const worker=spawn(process.execPath,workerArgs,{cwd:root,windowsHide:true,stdio:'inherit',env:{...process.env,NODE_ENV:'production',RADAZ_WORKER_PORT:String(workerPort)}});
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/radaz-update'){
  // Only the local, same-origin application may wake the installed updater.
  const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const origin=req.headers.origin;
  const allowedOrigin=origin&&[`http://localhost:${port}`,`http://127.0.0.1:${port}`,`http://[::1]:${port}`].includes(origin);
  if(req.method!=='POST'||!local||!allowedOrigin||!installRoot){res.writeHead(403);res.end();return;}
  try{
   const pending=path.join(installRoot,'update-request.json');
   const temp=pending+'.tmp';writeFileSync(temp,JSON.stringify({requestedAt:Date.now()}));renameSync(temp,pending);
   const updater=spawn(path.join(root,'runtime/python/python.exe'),[path.join(root,'bridge/radaz_desktop.py'),'watch','--install-root',installRoot],{cwd:installRoot,windowsHide:true,detached:true,stdio:'ignore'});
   updater.on('error',error=>{
    console.error('Updater start:',error.message);
    try{unlinkSync(pending);}catch{}
    const stateFile=path.join(installRoot,'update-state.json'),temporary=stateFile+'.tmp';
    try{writeFileSync(temporary,JSON.stringify({state:'error',message:'Yeniləmə xidməti başlamadı. RADAZ Setup quraşdırmasını yoxlayın.'}));renameSync(temporary,stateFile);}catch{}
   });updater.unref();
   res.writeHead(202,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({state:'checking',message:'Yeniləmə başladıldı.'}));
  }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Yeniləmə başladılmadı.'}));}
  return;
 }
 if(pathname==='/radaz-installation.json'){
  let state={managed:!!installRoot,state:'current',message:installRoot?'Yeniləmələr avtomatik yüklənir və RADAZ növbəti dəfə açılarkən tətbiq olunur.':''};
  if(installRoot)try{const saved=JSON.parse(readFileSync(path.join(installRoot,'update-state.json'),'utf8'));state={...state,state:saved.state,version:saved.version,message:saved.message,progress:saved.progress};
   if(existsSync(path.join(installRoot,'update-request.json')))state={...state,state:'checking',message:'Yeniləmələr yoxlanılır…',progress:null};
  }catch{}
  res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(state));return;
 }
 // Desktop lifecycle control is never forwarded from browsers or LAN clients.
 if(pathname.startsWith('/local-archive-api/_desktop/')){res.writeHead(404);res.end();return;}
 if(pathname==='/radaz-runtime.json'||pathname==='/product.json'){
  res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(pathname==='/product.json'?build.product:runtime));return;
 }
 const archive=req.url==='/local-archive-api'||req.url.startsWith('/local-archive-api/');
 const upstream=http.request({hostname:'127.0.0.1',port:archive?archivePort:workerPort,path:archive?req.url.slice('/local-archive-api'.length)||'/':req.url,method:req.method,headers:{...req.headers,host:`127.0.0.1:${archive?archivePort:workerPort}`}},reply=>{res.writeHead(reply.statusCode,{...reply.headers,...(!pathname.startsWith('/assets/')?{'cache-control':'no-store'}:{}),'x-radaz-version':runtime.version});reply.pipe(res);});
 upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8','Retry-After':'3'});res.end('RADAZ xidməti hazırlanır. Bir neçə saniyə sonra səhifəni yeniləyin.');});
 req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
});
let closing=false;const stop=()=>{if(closing)return;closing=true;server.close();if(process.platform==='win32'&&worker.pid)spawnSync('taskkill.exe',['/PID',String(worker.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else worker.kill();setTimeout(()=>process.exit(),1500).unref();};
worker.on('exit',code=>{if(!closing){console.error('RADAZ web runtime stopped',code);stop();process.exitCode=code||1;}});worker.on('error',error=>{console.error(error.message);stop();});
server.on('error',error=>{console.error(error.message);stop();process.exitCode=1;});
process.on('SIGINT',stop);process.on('SIGTERM',stop);
server.listen(port,'0.0.0.0',()=>console.log(`RADAZ: http://localhost:${port}`));
