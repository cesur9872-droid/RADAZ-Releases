import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {loadSettings,saveSettings,visibleSettings,ownerDirectory} from './owner-settings.mjs';
export function createOwnerConsole({root=ownerDirectory(),token=randomBytes(32).toString('hex')}={}){
 const html=readFileSync(new URL('./owner.html',import.meta.url));
 const server=http.createServer(async(req,res)=>{
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const origin=`http://127.0.0.1:${server.address().port}`;
  if(req.headers.host!==new URL(origin).host||req.headers.origin&&req.headers.origin!==origin){reply(403,{error:'Yalnız yerli satıcı paneli.'});return;}
  if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",'Referrer-Policy':'no-referrer'});res.end(html);return;}
  if(req.method==='GET'&&req.url==='/owner.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(readFileSync(new URL('./owner-ui.js',import.meta.url)));return;}
  const supplied=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+token);
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){reply(401,{error:'Paneli OPEN-SELLER-SETTINGS.cmd ilə açın.'});return;}
  try{
   if(req.url==='/settings'&&req.method==='GET'){reply(200,{...visibleSettings(loadSettings(root)),storagePath:root});return;}
   if(req.url==='/settings'&&req.method==='POST'){
    if(req.headers['content-type']!=='application/json')throw new Error('JSON tələb olunur.');
    let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)throw new Error('Sorğu həddindən böyükdür.');body+=chunk;}
    reply(200,saveSettings(JSON.parse(body),root));return;
   }
   reply(404,{error:'Ünvan tapılmadı.'});
  }catch(error){reply(400,{error:error.message});}
 });
 return {server,token};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {server,token}=createOwnerConsole();server.listen(0,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${server.address().port}/#${token}`;
  if(process.platform==='win32')execFile('powershell.exe',['-NoProfile','-Command',`Start-Process '${url}'`],{windowsHide:true});
  else console.log('Owner console requires a local browser opened by the Windows launcher.');
  console.log('Satıcı ayarları açıldı. Bu pəncərəni bağlayanda panel dayanır. Gizli açarlar ekrana çıxarılmır.');
 });
}
