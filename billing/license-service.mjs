// Seller-side service only. Never include its database or private key in client packages.
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHash,sign} from 'node:crypto';
import {chmodSync} from 'node:fs';
export const PRICE_MINOR=1000, CURRENCY='AZN', MAX_MONTHS=120;
const hash=value=>createHash('sha256').update(value).digest('hex');
export function addMonths(seconds,months){
 const date=new Date(seconds*1000),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+months);
 date.setUTCDate(Math.min(day,new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()));return Math.floor(date.getTime()/1000);
}
export function createLicenseService({database,privateKey,provider,now=()=>Math.floor(Date.now()/1000)}){
 const db=new DatabaseSync(database);if(database!==':memory:')chmodSync(database,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,tokenHash TEXT NOT NULL,months INTEGER NOT NULL,amountMinor INTEGER NOT NULL,status TEXT NOT NULL,providerOrder TEXT,paymentId TEXT UNIQUE,code TEXT UNIQUE,deviceId TEXT,activatedAt INTEGER,expiresAt INTEGER,createdAt INTEGER NOT NULL);`);
 const order=id=>db.prepare('SELECT * FROM orders WHERE id=?').get(id);
 return {
  catalog(){return {enabled:!!provider,monthly:PRICE_MINOR/100,currency:CURRENCY,maxMonths:MAX_MONTHS};},
  async checkout(months){
   if(!Number.isInteger(months)||months<1||months>MAX_MONTHS)throw new Error('Ay sayı 1–120 olmalıdır.');
   if(!provider)throw new Error('Ödəniş provayderi hələ qoşulmayıb.');
   const id=randomUUID(),token=randomBytes(32).toString('hex'),amountMinor=PRICE_MINOR*months;
   db.prepare('INSERT INTO orders(id,tokenHash,months,amountMinor,status,createdAt) VALUES (?,?,?,?,?,?)').run(id,hash(token),months,amountMinor,'pending',now());
   try{
    const payment=await provider.createCheckout({orderId:id,amountMinor,currency:CURRENCY,months});
    const url=new URL(payment.url);if(url.protocol!=='https:'||url.username||url.password||!payment.id)throw new Error('Provayder etibarlı HTTPS ödəniş ünvanı qaytarmadı.');
    db.prepare('UPDATE orders SET providerOrder=? WHERE id=?').run(String(payment.id),id);
    return {id,token,url:url.href,months,amountMinor,currency:CURRENCY};
   }catch(error){db.prepare("UPDATE orders SET status='failed' WHERE id=? AND status='pending'").run(id);throw error;}
  },
  // Called only after the provider adapter verifies its signature and transaction status.
  confirmPayment(event){
   db.exec('BEGIN IMMEDIATE');
   try{
    const row=order(event.orderId);
    if(!row||event.status!=='paid'||event.amountMinor!==row.amountMinor||event.currency!==CURRENCY||event.providerOrder!==row.providerOrder||typeof event.id!=='string'||!event.id)throw new Error('Ödəniş məbləği, valyutası və ya sifarişi təsdiqlənmədi.');
    if(row.status==='paid'){if(row.paymentId!==event.id)throw new Error('Sifariş başqa əməliyyatla ödənilib.');db.exec('COMMIT');return {ok:true};}
    if(row.status!=='pending')throw new Error('Sifariş ödəniş gözləmir.');
    const code='RADAZ-ACT-'+randomBytes(24).toString('hex').toUpperCase();
    db.prepare("UPDATE orders SET status='paid',paymentId=?,code=? WHERE id=?").run(event.id,code,row.id);
    db.exec('COMMIT');return {ok:true};
   }catch(error){db.exec('ROLLBACK');throw error;}
  },
  status(id,token){
   const row=order(id);if(!row||typeof token!=='string'||hash(token)!==row.tokenHash)throw new Error('Sifariş əlçatan deyil.');
   return {id:row.id,status:row.status,months:row.months,amountMinor:row.amountMinor,currency:CURRENCY,activationCode:row.status==='paid'?row.code:undefined,activatedAt:row.activatedAt,expiresAt:row.expiresAt};
  },
  activate(code,deviceId){
   if(typeof code!=='string'||!/^RADAZ-ACT-[A-F0-9]{48}$/.test(code)||typeof deviceId!=='string'||!/^[A-F0-9]{64}$/.test(deviceId))throw new Error('Aktivləşdirmə açarı və ya kompüter kodu düzgün deyil.');
   db.exec('BEGIN IMMEDIATE');
   try{
    const row=db.prepare("SELECT * FROM orders WHERE code=? AND status='paid'").get(code);if(!row)throw new Error('Ödənilmiş açar tapılmadı.');
    if(row.deviceId&&row.deviceId!==deviceId)throw new Error('Açar başqa kompüterdə aktivləşdirilib.');
    const start=row.activatedAt??now(),end=row.expiresAt??addMonths(start,row.months);
    const claims={v:1,product:'RADAZ',licenseId:row.id,activationId:row.id,customer:'RADAZ istifadəçisi',plan:'monthly',months:row.months,seats:1,deviceId,issuedAt:start,activatedAt:start,expiresAt:end};
    const payload='RADAZ1.'+Buffer.from(JSON.stringify(claims)).toString('base64url');
    const key=payload+'.'+sign('RSA-SHA256',Buffer.from(payload),privateKey).toString('base64url');
    db.prepare('UPDATE orders SET deviceId=?,activatedAt=?,expiresAt=? WHERE id=?').run(deviceId,start,end,row.id);db.exec('COMMIT');return {key,activatedAt:start,expiresAt:end,months:row.months};
   }catch(error){db.exec('ROLLBACK');throw error;}
  },close(){db.close();}
 };
}
