// Built application gateway. DICOM control stays on loopback; the viewer is available on LAN.
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!existsSync(path.join(root,'dist/server/index.js')))throw new Error('Built application missing. Run START-RADAZ.cmd from a source checkout or extract the release ZIP.');
const port=Number(process.env.RADAZ_PORT||5173),workerPort=Number(process.env.RADAZ_WORKER_PORT||5175),archivePort=Number(process.env.RADAZ_ARCHIVE_PORT||8766);
if(![port,workerPort,archivePort].every(p=>Number.isInteger(p)&&p>0&&p<=65535)||new Set([port,workerPort,archivePort]).size!==3)throw new Error('Invalid server ports');
const worker=spawn(process.execPath,['node_modules/vinext/dist/cli.js','start','--port',String(workerPort),'--hostname','127.0.0.1'],{cwd:root,windowsHide:true,stdio:'inherit',env:{...process.env,NODE_ENV:'production'}});
const server=http.createServer((req,res)=>{
 const archive=req.url==='/local-archive-api'||req.url.startsWith('/local-archive-api/');
 const upstream=http.request({hostname:'127.0.0.1',port:archive?archivePort:workerPort,path:archive?req.url.slice('/local-archive-api'.length)||'/':req.url,method:req.method,headers:{...req.headers,host:`127.0.0.1:${archive?archivePort:workerPort}`}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
 upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8','Retry-After':'3'});res.end('RADAZ xidməti hazırlanır. Bir neçə saniyə sonra səhifəni yeniləyin.');});
 req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
});
let closing=false;const stop=()=>{if(closing)return;closing=true;server.close();if(process.platform==='win32'&&worker.pid)spawnSync('taskkill.exe',['/PID',String(worker.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else worker.kill();setTimeout(()=>process.exit(),1500).unref();};
worker.on('exit',code=>{if(!closing){console.error('RADAZ web runtime stopped',code);stop();process.exitCode=code||1;}});worker.on('error',error=>{console.error(error.message);stop();});
server.on('error',error=>{console.error(error.message);stop();process.exitCode=1;});
process.on('SIGINT',stop);process.on('SIGTERM',stop);
server.listen(port,'0.0.0.0',()=>console.log(`RADAZ: http://localhost:${port}`));
