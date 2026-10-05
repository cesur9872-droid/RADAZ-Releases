import {scrypt,randomBytes,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {existsSync,readFileSync,writeFileSync,renameSync,mkdirSync,chmodSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const derive=promisify(scrypt),aad=Buffer.from('RADAZ owner vault v1');
const fingerprint=file=>existsSync(file)?createHash('sha256').update(readFileSync(file)).digest('hex'):null;
export function protectOwnerDirectory(root){
 mkdirSync(root,{recursive:true,mode:0o700});
 if(process.platform==='win32'){
  const identity=execFileSync('whoami.exe',['/user','/fo','csv','/nh'],{encoding:'utf8',windowsHide:true});
  const sid=identity.match(/S-1-5-[\d-]+/)?.[0];if(!sid)throw Error('Windows istifadəçisi təsdiqlənmədi.');
  execFileSync('icacls.exe',[root,'/inheritance:r','/grant:r',`*${sid}:(OI)(CI)F`,'*S-1-5-18:(OI)(CI)F','/T','/Q'],{windowsHide:true,stdio:'pipe'});
 }else chmodSync(root,0o700);
}
export class OwnerVault{
 constructor(root){this.root=root;this.file=path.join(root,'owner-vault.json');this.key=null;this.data=null;}
 get exists(){return existsSync(this.file);}
 async unlock(password,initial){
  if(typeof password!=='string'||password.length<12||password.length>128)throw Error('Parol 12–128 simvol olmalıdır.');
  const snapshot=this.exists?readFileSync(this.file):null,record=snapshot?JSON.parse(snapshot):null;
  if(!record&&!initial)throw Error('Əvvəl sahib parolunu yaradın.');
  if(record&&(record.v!==1||!/^[a-f0-9]{32}$/.test(record.salt)))throw Error('Sahib yaddaşı düzgün deyil.');
  const salt=record?.salt||randomBytes(16).toString('hex');
  const key=await derive(password,Buffer.from(salt,'hex'),32,{N:131072,r:8,p:1,maxmem:160*1024**2});
  let data=initial;
  try{if(record){const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(record.iv,'hex'));cipher.setAAD(aad);cipher.setAuthTag(Buffer.from(record.tag,'hex'));data=JSON.parse(Buffer.concat([cipher.update(Buffer.from(record.body,'base64')),cipher.final()]).toString());}}
  catch{key.fill(0);throw Error('Parol yanlışdır və ya qorunan fayl dəyişdirilib.');}
  this.lock();this.key=key;this.salt=salt;this.data=data;this.revision=snapshot?createHash('sha256').update(snapshot).digest('hex'):null;
  if(!record){try{protectOwnerDirectory(this.root);this.save();}catch(error){this.lock();throw error;}}
  return this.data;
 }
 save(){
  if(!this.key)throw Error('Sahib paneli kilidlidir.');
  if(fingerprint(this.file)!==this.revision)throw Error('Ayarlar başqa paneldə dəyişib. Kilidləyib yenidən daxil olun.');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);cipher.setAAD(aad);
  const body=Buffer.concat([cipher.update(JSON.stringify(this.data)),cipher.final()]);
  const temp=this.file+'.'+randomBytes(6).toString('hex')+'.tmp';
  const fd=openSync(temp,'wx',0o600);try{writeFileSync(fd,JSON.stringify({v:1,salt:this.salt,iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),body:body.toString('base64')}));fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,this.file);this.revision=fingerprint(this.file);
 }
 lock(){this.key?.fill(0);this.key=null;this.data=null;}
}
