'use client';
import {useEffect,useRef,useState} from 'react';
type Module={id:string;name:string;monthlyMinor:number;enabled:boolean};
type Catalog={enabled:boolean;monthly:number;currency:'AZN'|'USD';maxMonths:number;currencies?:string[];modules?:Module[];exchange?:{usdAzn:number;date:string;checkedAt:number}|null};
async function api<T>(path:string,body?:unknown):Promise<T>{const r=await fetch('/local-archive-api/'+path,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const data=await r.json() as T & {error?:string};if(!r.ok)throw Error(data.error||'Ödəniş xidməti cavab vermədi.');return data;}
export function LicensePayment({onKey}:{onKey:(key:string)=>void}){
 const [catalog,setCatalog]=useState<Catalog|null>(null),[months,setMonths]=useState(1),[currency,setCurrency]=useState('AZN'),[moduleId,setModuleId]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[order,setOrder]=useState(''),[url,setUrl]=useState(''),[code,setCode]=useState('');
 const activated=useRef(new Set<string>());
 useEffect(()=>{void api<Catalog>('billing/catalog').then(c=>{setCatalog(c);setCurrency(c.currencies?.[0]||c.currency);}).catch(e=>setMessage(e.message));try{setOrder(localStorage.getItem('radaz-payment-order')||'');}catch{}},[]);
 useEffect(()=>{
  if(!order)return;let alive=true,running=false;
  const check=async()=>{if(running)return;running=true;try{
   const paid=await api<{status:string;activationCode?:string;moduleId?:string}>(`billing/order?id=${encodeURIComponent(order)}`);if(!alive)return;
   if(paid.status==='paid'&&paid.activationCode){setCode(paid.activationCode);if(!activated.current.has(order)){
    activated.current.add(order);setMessage('Ödəniş təsdiqləndi. Aktivləşdirilir…');
    try{const result=await api<{message:string}>('license/activate',{key:paid.activationCode});if(!alive)return;setMessage(result.message);window.dispatchEvent(new Event('radaz-license-change'));setOrder('');try{localStorage.removeItem('radaz-payment-order');}catch{}}
    catch(error){if(alive)setMessage(`Ödəniş təsdiqləndi, aktivləşdirmə alınmadı: ${error instanceof Error?error.message:''} Aşağıdakı açarla yenidən sınayın.`);}
   }}else if(paid.status==='failed')setMessage('Ödəniş tamamlanmadı.');else setMessage('Provayderin ödəniş təsdiqi gözlənilir…');
  }catch(e){if(alive)setMessage(e instanceof Error?e.message:'Ödəniş yoxlanmadı.');}finally{running=false;}};
  void check();const timer=setInterval(()=>void check(),5000);return()=>{alive=false;clearInterval(timer);};
 },[order]);
 const selected=catalog?.modules?.find(m=>m.id===moduleId),baseMinor=selected?.monthlyMinor??Math.round((catalog?.monthly??10)*100);
 const rate=catalog?.exchange?.usdAzn;
 const converted=catalog&&currency!==catalog.currency;
 const unit=converted?(rate?Math.round(catalog.currency==='USD'?baseMinor*rate:baseMinor/rate):null):baseMinor;
 const stale=converted&&(!catalog?.exchange||Date.now()-catalog.exchange.checkedAt>7*86400000);
 const valid=Number.isInteger(months)&&months>=1&&months<=(catalog?.maxMonths||120);
 const total=valid&&unit!==null?unit*months/100:null;
 const checkout=async()=>{if(!catalog?.enabled||total===null)return;setBusy(true);setMessage('Ödəniş hazırlanır…');const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;try{
  const result=await api<{id:string;url:string}>('billing/checkout',{months,currency,moduleId:moduleId||null});setCode('');setOrder(result.id);setUrl(result.url);try{localStorage.setItem('radaz-payment-order',result.id);}catch{}if(tab)tab.location.replace(result.url);
 }catch(e){try{tab?.close();}catch{}setMessage(e instanceof Error?e.message:'Ödəniş açılmadı.');}finally{setBusy(false);}};
 const saveKey=()=>{const link=document.createElement('a'),href=URL.createObjectURL(new Blob([code+'\n'],{type:'text/plain;charset=utf-8'}));link.href=href;link.download='RADAZ-lisenziya.txt';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);};
 return <section className="monthly-payment" aria-label="Lisenziya ödənişi"><h3>Lisenziya və modullar</h3>
  <label>Məhsul<select aria-label="Məhsul" value={moduleId} disabled={busy} onChange={e=>setModuleId(e.target.value)}><option value="">RADAZ əsas lisenziya</option>{catalog?.modules?.filter(m=>m.enabled).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
  <div className="product-actions"><label>Valyuta<select aria-label="Valyuta" value={currency} disabled={busy} onChange={e=>setCurrency(e.target.value)}><option>AZN</option><option>USD</option></select></label><label>Ay sayı<input type="number" aria-label="Lisenziya ay sayı" min={1} max={catalog?.maxMonths||120} value={Number.isNaN(months)?'':months} disabled={busy} onChange={e=>setMonths(e.target.valueAsNumber)}/></label></div>
  <strong className="license-price">Cəmi: {total===null?'—':total.toFixed(2)} {currency}</strong>
  <p>{(baseMinor/100).toFixed(2)} {catalog?.currency||'AZN'} / ay{rate?` · 1 USD = ${rate.toFixed(4)} AZN · ${catalog?.exchange?.date}`:''}</p>
  {!!moduleId&&<p>Bu ödəniş yalnız seçilmiş modulu aktivləşdirir. Əsas RADAZ lisenziyası ayrıca saxlanılır.</p>}
  <button disabled={busy||!catalog?.enabled||total===null||!!stale||!(catalog.currencies||['AZN']).includes(currency)} onClick={()=>void checkout()}>{busy?'Hazırlanır…':'Ödəniş sisteminə keç'}</button>
  {!catalog?.enabled&&<p className="product-note">Ödəniş provayderi hələ qoşulmayıb. Hesab / ödəniş linki təkbaşına avtomatik aktivləşdirmə yaratmır.</p>}
  {catalog?.enabled&&!(catalog.currencies||['AZN']).includes(currency)&&<p>Bu provayder {currency} qəbul etmir. Digər valyutanı seçin.</p>}{stale&&<p>Məzənnə yenilənməlidir. Ödəniş pəncərəsini yenidən açın.</p>}
  {url&&<a href={url} target="_blank" rel="noreferrer">Ödəniş səhifəsini aç</a>}{code&&<><label>Ödənilmiş aktivləşdirmə kodu<textarea readOnly value={code}/></label><button onClick={saveKey}>Açarı TXT faylı kimi saxla</button><button onClick={()=>void navigator.clipboard.writeText(code).then(()=>setMessage('Açar kopyalandı.')).catch(()=>setMessage('Açarı mətn sahəsindən kopyalayın.'))}>Açarı kopyala</button><button onClick={()=>onKey(code)}>Aktivləşdirməni yenidən aç</button></>}{message&&<p role="status">{message}</p>}
 </section>;
}
