import {readFileSync,existsSync,mkdirSync,writeFileSync,renameSync,chmodSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export const ownerDirectory=()=>path.resolve(process.env.RADAZ_OWNER_DIR||path.join(os.homedir(),'Documents','RADAZ-License-Admin'));
const defaults={sellerName:'',taxId:'',bankName:'',iban:'',beneficiary:'',supportEmail:'drnaghiyev@gmail.com',publicBaseUrl:'',epointPublicKey:'',epointPrivateKey:'',epointRequestUrl:'',enabled:false};
export function loadSettings(root=ownerDirectory()){
 const file=path.join(root,'merchant.json');
 return existsSync(file)?{...defaults,...JSON.parse(readFileSync(file,'utf8'))}:{...defaults};
}
export function visibleSettings(settings){const {epointPrivateKey,...publicFields}=settings;return {...publicFields,privateKeyConfigured:!!epointPrivateKey};}
export function validateSettings(input,previous=defaults){
 const next={...defaults};
 for(const key of Object.keys(defaults)){
  if(key==='enabled'){next.enabled=input.enabled===true;continue;}
  const value=input[key]??previous[key];
  if(typeof value!=='string'||value.length>2000)throw new Error('Ayar sahəsi düzgün deyil: '+key);
  next[key]=value.trim();
 }
 if(!next.epointPrivateKey&&!input.clearPrivateKey)next.epointPrivateKey=previous.epointPrivateKey;
 if(input.clearPrivateKey)next.epointPrivateKey='';
 next.iban=next.iban.replace(/\s/g,'').toUpperCase();
 if(next.iban&&!/^AZ\d{2}[A-Z]{4}[A-Z0-9]{20}$/.test(next.iban))throw new Error('Azərbaycan IBAN-ı AZ ilə başlayan 28 simvol olmalıdır.');
 if(next.taxId&&!/^\d{10}$/.test(next.taxId))throw new Error('VÖEN 10 rəqəm olmalıdır.');
 if(next.publicBaseUrl){const u=new URL(next.publicBaseUrl);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw new Error('Lisenziya xidmətinin HTTPS domenini daxil edin (alt yol olmadan).');next.publicBaseUrl=u.origin;}
 if(next.epointRequestUrl){const u=new URL(next.epointRequestUrl);if(u.protocol!=='https:'||!(u.hostname==='epoint.az'||u.hostname.endsWith('.epoint.az'))||u.username||u.password||u.search||u.hash)throw new Error('Epoint-in verdiyi rəsmi HTTPS API ünvanını daxil edin.');}
 if(next.enabled&&(!next.publicBaseUrl||!next.epointRequestUrl||!next.epointPublicKey||!next.epointPrivateKey))throw new Error('Ödənişi açmaq üçün domen və Epoint-in API ünvanı/açarları lazımdır.');
 return next;
}
export function saveSettings(input,root=ownerDirectory()){
 const next=validateSettings(input,loadSettings(root));mkdirSync(root,{recursive:true,mode:0o700});
 const file=path.join(root,'merchant.json'),temp=file+'.tmp';
 writeFileSync(temp,JSON.stringify(next,null,2),{mode:0o600});chmodSync(temp,0o600);renameSync(temp,file);return visibleSettings(next);
}
