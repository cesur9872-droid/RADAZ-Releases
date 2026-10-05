// Epoint's documented protocol uses SHA-1(key + base64(JSON) + key), not an invented HMAC.
// https://developer.epoint.az/en/callbacks
import {createHash,timingSafeEqual} from 'node:crypto';
export const epointSignature=(data,key)=>createHash('sha1').update(key+data+key).digest('base64');
export function amountMinor(value){
 const text=String(value);if(!/^\d+(\.\d{1,2})?$/.test(text))throw new Error('Ödəniş məbləği düzgün deyil.');
 const [whole,decimal='']=text.split('.'),minor=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 if(!Number.isSafeInteger(minor)||minor<1)throw new Error('Ödəniş məbləği düzgün deyil.');return minor;
}
export function createEpointProvider(settings,request=fetch){
 if(!settings.enabled||settings.provider==='kapital')return undefined;
 return {
  currencies:['AZN'],
  async createCheckout({orderId,amountMinor:minor,currency,months}){
   if(currency!=='AZN')throw new Error('Yalnız AZN ödənişi dəstəklənir.');
   const payload={public_key:settings.epointPublicKey,amount:(minor/100).toFixed(2),currency:'AZN',language:'az',order_id:orderId,description:`RADAZ lisenziyası · ${months} ay`,success_redirect_url:settings.publicBaseUrl+'/payment/return',error_redirect_url:settings.publicBaseUrl+'/payment/return'};
   const data=Buffer.from(JSON.stringify(payload)).toString('base64');
   const response=await request(settings.epointRequestUrl,{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data,signature:epointSignature(data,settings.epointPrivateKey)}),signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw new Error('Epoint ödəniş sorğusunu qəbul etmədi.');
   const result=await response.json();
   if(result.status!=='success'||typeof result.transaction!=='string'||!result.transaction||typeof result.redirect_url!=='string')throw new Error('Epoint ödəniş yaratmadı. Satıcı ayarlarını yoxlayın.');
   return {id:result.transaction,url:result.redirect_url};
  },
  async verifyWebhook({headers,rawBody}){
   if(!(headers['content-type']||'').startsWith('application/x-www-form-urlencoded'))throw new Error('Epoint callback formatı düzgün deyil.');
   const form=new URLSearchParams(rawBody.toString('utf8'));
   if(form.getAll('data').length!==1||form.getAll('signature').length!==1)throw new Error('Callback sahələri düzgün deyil.');
   const data=form.get('data'),signature=form.get('signature'),expected=epointSignature(data,settings.epointPrivateKey);
   const a=Buffer.from(signature),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))throw new Error('Epoint imzası düzgün deyil.');
   const event=JSON.parse(Buffer.from(data,'base64').toString('utf8'));
   if(event.status!=='success'||String(event.operation_code)!=='100'||typeof event.transaction!=='string'||!event.transaction||typeof event.order_id!=='string')throw new Error('Tamamlanmış ödəniş təsdiqi yoxdur.');
   if(event.currency!==undefined&&event.currency!=='AZN')throw new Error('Ödəniş valyutası uyğun deyil.');
   if(event.public_key!==undefined&&event.public_key!==settings.epointPublicKey)throw new Error('Satıcı identifikatoru uyğun deyil.');
   // The service also matches the signed transaction ID, order and amount against
   // the checkout stored in SQLite. This adapter creates AZN checkouts only.
   return {id:event.transaction,providerOrder:event.transaction,orderId:event.order_id,amountMinor:amountMinor(event.amount),currency:'AZN',status:'paid'};
  }
 };
}
