import {readFileSync,existsSync,mkdirSync,writeFileSync,renameSync,chmodSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export const ownerDirectory=()=>path.resolve(process.env.RADAZ_OWNER_DIR||path.join(os.homedir(),'Documents','RADAZ-License-Admin'));
// Verified against Epoint's linked PHP SDK, EpointClient.php + PaymentRequest.php.
export const EPOINT_REQUEST_URL='https://epoint.az/api/1/request';
const defaults={provider:'kapital',sellerName:'',taxId:'',bankName:'',iban:'',usdIban:'',branchCode:'',bankTaxId:'',swift:'',correspondentAccount:'',beneficiary:'',supportEmail:'drnaghiyev@gmail.com',publicBaseUrl:'',epointPublicKey:'',epointPrivateKey:'',epointRequestUrl:EPOINT_REQUEST_URL,enabled:false};
export function loadSettings(root=ownerDirectory()){
 const file=path.join(root,'merchant.json');
 if(!existsSync(file))return {...defaults};
 const saved=JSON.parse(readFileSync(file,'utf8'));
 return {...defaults,...saved,provider:saved.provider||(saved.epointPublicKey?'epoint':'kapital')};
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
 for(const key of ['iban','usdIban','correspondentAccount']){
 next[key]=next[key].replace(/\s/g,'').toUpperCase();
 if(next[key]){
  if(!/^AZ\d{2}[A-Z]{4}[A-Z0-9]{20}$/.test(next[key]))throw new Error('Azərbaycan IBAN-ı AZ ilə başlayan 28 simvol olmalıdır; bank rekvizitindən tam köçürün.');
  const digits=(next[key].slice(4)+next[key].slice(0,4)).replace(/[A-Z]/g,c=>String(c.charCodeAt(0)-55));
  if(BigInt(digits)%97n!==1n)throw new Error('IBAN yoxlama rəqəmləri uyğun deyil. Bank rekvizitindən dəyişmədən köçürün.');
 }}
 if(!['kapital','epoint'].includes(next.provider))throw new Error('Ödəniş provayderi düzgün deyil.');
 if(next.branchCode&&!/^\d{6}$/.test(next.branchCode))throw new Error('Filial kodu 6 rəqəm olmalıdır.');
 if(next.bankTaxId&&!/^\d{10}$/.test(next.bankTaxId))throw new Error('Bank VÖEN-i 10 rəqəm olmalıdır.');
 if(next.swift&&!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(next.swift))throw new Error('SWIFT kodu düzgün deyil.');
 if(next.enabled&&next.provider==='kapital')throw new Error('Kapital Bank API inteqrasiyası hələ qoşulmayıb. Rekvizitlər ödənişi avtomatik aktiv etmir.');
 if(/^(azn|usd|eur)$/i.test(next.beneficiary))throw new Error('Vəsaiti alanın adı sahəsinə valyuta deyil, bank hesabının sahibinin tam adı yazılmalıdır.');
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
