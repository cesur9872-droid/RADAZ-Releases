import {readFileSync,existsSync} from 'node:fs';
import {createPrivateKey,createPublicKey} from 'node:crypto';
import path from 'node:path';
import {loadSettings,validateSettings} from './owner-settings.mjs';

// Hosting credentials belong in the hosting provider's secret store, never Git.
export function runtimeConfig(root,env=process.env,owner){
 if(existsSync(path.join(root,'owner-vault.json'))&&!owner)throw Error('Şifrələnmiş sahib yaddaşı üçün RADAZ_OWNER_PASSWORD təhlükəsiz mühit dəyişənini qurun.');
 const input=owner?{...owner.settings}:loadSettings(root);
 const mapping={RADAZ_PUBLIC_BASE_URL:'publicBaseUrl',EPOINT_PUBLIC_KEY:'epointPublicKey',EPOINT_PRIVATE_KEY:'epointPrivateKey',EPOINT_REQUEST_URL:'epointRequestUrl'};
 for(const [name,key]of Object.entries(mapping))if(env[name]!==undefined)input[key]=env[name];
 if(!input.publicBaseUrl&&env.RENDER_EXTERNAL_URL)input.publicBaseUrl=env.RENDER_EXTERNAL_URL;
 if(env.RADAZ_PAYMENTS_ENABLED!==undefined){if(!['true','false'].includes(env.RADAZ_PAYMENTS_ENABLED))throw new Error('RADAZ_PAYMENTS_ENABLED true və ya false olmalıdır.');input.enabled=env.RADAZ_PAYMENTS_ENABLED==='true';}
 const settings=validateSettings(input);
 const keyPath=env.RADAZ_ISSUER_PRIVATE_KEY||path.join(root,'issuer-private.pem');
 const pem=env.RADAZ_ISSUER_PRIVATE_KEY_PEM||owner?.issuer||(existsSync(keyPath)?readFileSync(keyPath):null);
 let privateKey=null;
 if(pem){
  try{privateKey=createPrivateKey(pem);}catch{throw new Error('Lisenziya imza açarı düzgün PEM formatında deyil.');}
  if(privateKey.asymmetricKeyType!=='rsa')throw new Error('Lisenziya imza açarı RSA olmalıdır.');
  const expected=JSON.parse(readFileSync(new URL('../public/license-public.json',import.meta.url),'utf8'));
  const actual=createPublicKey(privateKey).export({format:'jwk'});
  if(actual.n!==expected.n||actual.e!==expected.e)throw new Error('Server imza açarı müştəri paketindəki public açara uyğun deyil. Mövcud issuer-private.pem faylını istifadə edin.');
 }
 return {settings,privateKey};
}
