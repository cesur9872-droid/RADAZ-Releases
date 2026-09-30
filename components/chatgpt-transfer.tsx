'use client';
import {useEffect,useRef,useState} from 'react';
import {Download,ExternalLink,MessageCircle,PackageOpen,Clipboard} from 'lucide-react';
import JSZip from 'jszip';
import {renderReportImage,type ReportImage} from '@/lib/report-dicom';
import {chatgptPrompt,CHATGPT_IMAGE_BATCH} from '@/lib/chatgpt-prompt';

type Bundle={prompt:string;blob:Blob;previews:{name:string;data:string}[];count:number};
const MAX_ZIP=480*1024*1024, CHUNK=512*1024;
export function ChatGPTTransfer({images,windowMode,modality,onPaste}:{images:ReportImage[];windowMode:'metadata'|'lung'|'soft'|'bone';modality:string;onPaste:(text:string)=>void}){
 const [clinical,setClinical]=useState(''),[bundle,setBundle]=useState<Bundle|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[answer,setAnswer]=useState(''),[url,setUrl]=useState('');
 const [first,setFirst]=useState(0),[includeZip,setIncludeZip]=useState(true);
 const [bridge,setBridge]=useState<'checking'|'ready'|'missing'>('checking'),[bridgeMessage,setBridgeMessage]=useState('');
 const epoch=useRef(0),objectUrl=useRef(''),activeRequest=useRef('');
 useEffect(()=>{epoch.current++;activeRequest.current='';setFirst(0);setBundle(null);setAnswer('');setStatus('');if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current='';setUrl('');},[images,windowMode]);
 const prompt=chatgptPrompt({imageCount:images.length,seriesCount:new Set(images.map(im=>im.seriesUID)).size,modality,windowMode,clinical,first,includeZip});
 useEffect(()=>()=>{epoch.current++;if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);},[]);
 useEffect(()=>{
  const receive=(e:MessageEvent)=>{
   if(e.source!==window||e.origin!==location.origin||e.data?.source!=='RADAZ_CHATGPT_EXTENSION'||e.data.request!==activeRequest.current)return;
   if(e.data.stage==='answer'&&typeof e.data.text==='string'){setAnswer(e.data.text);setStatus('ChatGPT analizi gəldi. Yoxlayıb hesabata əlavə edin.');}
   else if(e.data.stage==='complete')setStatus(String(e.data.message||''));
  };
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[]);
 const invalidate=()=>{epoch.current++;activeRequest.current='';setBundle(null);setStatus('');if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current='';setUrl('');};
 const prepare=async()=>{
  if(!images.length||busy)return;const request=++epoch.current;setBusy(true);setBundle(null);setStatus('Bütün görüntülər hazırlanır…');
  try{
   const zip=new JSZip(),previews:Bundle['previews']=[],manifest:{name:string;series:number;slice:number}[]=[];let bytes=0;
   const series=[...new Set(images.map(im=>im.seriesUID))];
   for(let i=0;i<images.length;i++){
    const data=await renderReportImage(images[i],windowMode);if(request!==epoch.current)return;
    const name=`RADAZ-image-${String(i+1).padStart(6,'0')}.jpg`,base64=data.split(',')[1];bytes+=Math.ceil(base64.length*3/4);
    if(bytes>MAX_ZIP)throw new Error('ZIP 480 MB həddini keçir. Hesabatda seriyaları ayrı seçib ötürün; heç bir görüntü səssizcə çıxarılmadı.');
    zip.file(name,base64,{base64:true});manifest.push({name,series:series.indexOf(images[i].seriesUID)+1,slice:images[i].instance});
    if(previews.length<12)previews.push({name,data});setStatus(`${i+1} / ${images.length} görüntü hazırlanıb`);await new Promise(r=>setTimeout(r,0));
   }
   zip.file('ChatGPT-tapsiriq.txt',prompt);zip.file('manifest.json',JSON.stringify({imageCount:images.length,seriesCount:series.length,windowMode,images:manifest},null,2));
   const blob=await zip.generateAsync({type:'blob',compression:'STORE'});if(request!==epoch.current)return;
   if(blob.size>MAX_ZIP)throw new Error('ZIP 480 MB həddini keçir. Seriyaları ayrı ötürün.');
   if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current=URL.createObjectURL(blob);setUrl(objectUrl.current);setBundle({prompt,blob,previews,count:images.length});setStatus(`${images.length} görüntü bir ZIP-də hazırdır · ${(blob.size/1048576).toFixed(1)} MB`);
  }catch(e){if(request===epoch.current)setStatus(e instanceof Error?e.message:'Görüntülər hazırlanmadı');}finally{setBusy(false);}
 };
 const send=(type:string,request:string,payload:Record<string,unknown>={})=>new Promise<{protocol?:number;version?:string}>((resolve,reject)=>{
  const timer=setTimeout(()=>{window.removeEventListener('message',listener);reject(new Error('Bu brauzer səhifəsində RADAZ əlavəsi qoşulmayıb. Chrome/Edge-də əlavəni aktivləşdirin və ya aşağıdakı JPEG kopyalama/yükləmə seçimindən istifadə edin.'));},type==='BRIDGE_INFO'?1800:15000);
  const listener=(e:MessageEvent)=>{if(e.source!==window||e.origin!==location.origin||e.data?.source!=='RADAZ_CHATGPT_EXTENSION'||e.data.request!==request||e.data.type!==type||e.data.stage!=='reply')return;clearTimeout(timer);window.removeEventListener('message',listener);e.data.ok?resolve(e.data):reject(new Error(e.data.message||'Ötürmə alınmadı'));};
  window.addEventListener('message',listener);window.postMessage({source:'RADAZ_CHATGPT',type,request,...payload},location.origin);
 });
 const checkBridge=async()=>{setBridge('checking');try{const result=await send('BRIDGE_INFO',crypto.randomUUID().replaceAll('-',''));if(result.protocol!==2)throw new Error('Əlavənin köhnə versiyası işləyir. Yeni 0.3.2 paketini quraşdırıb səhifəni yeniləyin.');setBridge('ready');setBridgeMessage(`Əlavə qoşulub${result.version?` · ${result.version}`:''}`);}catch(e){setBridge('missing');setBridgeMessage(e instanceof Error?e.message:'Əlavə qoşulmayıb');}};
 useEffect(()=>{void checkBridge();const check=()=>void checkBridge();window.addEventListener('focus',check);return()=>window.removeEventListener('focus',check);},[]);
 const copyImage=async(data:string)=>{try{
  const png=new Promise<Blob>((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d');if(!context){reject(new Error('Görüntü kopyalanmadı'));return;}context.drawImage(image,0,0);canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Görüntü kopyalanmadı')),'image/png');};image.onerror=()=>reject(new Error('JPEG oxunmadı'));image.src=data;});
  await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);setStatus('Görüntü kopyalandı. ChatGPT mesaj sahəsində Ctrl+V basın, sonra “Tapşırığı kopyala” ilə mətni əlavə edin.');
 }catch{setStatus('Brauzer görüntü kopyalamağa icazə vermədi. “JPEG yüklə” ilə faylı saxlayıb ChatGPT-yə əlavə edin.');}};
 const transfer=async()=>{
  if(!bundle||busy)return;const version=epoch.current;setBusy(true);const request=crypto.randomUUID().replaceAll('-','');activeRequest.current=request;
  try{
   const info=await send('BRIDGE_INFO',request);if(info.protocol!==2)throw new Error('RADAZ ChatGPT əlavəsini 0.3.2-yə yeniləyin. Köhnə əlavə JPEG ötürməsini təsdiqləyə bilmir.');
   await send('ZIP_BEGIN',request,{prompt,name:'RADAZ-ChatGPT.zip',size:bundle.blob.size,count:Math.ceil(bundle.blob.size/CHUNK),attachments:{includeZip,first,count:Math.min(CHATGPT_IMAGE_BATCH,bundle.count-first),total:bundle.count}});
   for(let index=0,offset=0;offset<bundle.blob.size;index++,offset+=CHUNK){
    if(version!==epoch.current)throw new Error('Görüntü seçimi dəyişdi. Ötürmə dayandırıldı.');
    const part=bundle.blob.slice(offset,offset+CHUNK),data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('ZIP oxunmadı'));reader.readAsDataURL(part);});
    await send('ZIP_CHUNK',request,{index,data});setStatus(`ZIP ötürülür: ${Math.min(100,Math.round((offset+part.size)/bundle.blob.size*100))}%`);
   }
   if(version!==epoch.current)throw new Error('Görüntü seçimi dəyişdi. Ötürmə dayandırıldı.');
   await send('ZIP_FINISH',request);setStatus('ChatGPT açıldı; görüntü əlavələrinin təsdiqi gözlənilir…');
  }catch(e){void send('ZIP_CANCEL',request).catch(()=>{});if(version===epoch.current)setStatus(e instanceof Error?e.message:'Ötürmə alınmadı');}finally{setBusy(false);}
 };
 return <div className="chatgpt-transfer"><div className="chatgpt-title"><MessageCircle size={19}/><b>ChatGPT ilə hesabat</b><a href="/chatgpt-help" target="_blank" rel="noreferrer" title="Əlavənin quraşdırılması"><ExternalLink size={15}/></a></div>
  <p>Bütün görüntülər ZIP-də saxlanılır. JPEG-lər ayrıca görüntü əlavəsi kimi də ötürülür; beləliklə baxış ZIP-in açılmasından asılı qalmır. Mesajı özünüz göndərirsiniz.</p>
  <div className={`chatgpt-connection ${bridge}`} role="status"><strong>{bridge==='ready'?bridgeMessage:bridge==='checking'?'Əlavə bağlantısı yoxlanılır…':'Bu səhifədə əlavə bağlantısı yoxdur'}</strong>{bridge==='missing'&&<><p>{bridgeMessage}</p><p>Əlavə olmadan da JPEG-i kopyalayıb ChatGPT-yə yapışdıra bilərsiniz.</p><a href="/chatgpt-help" target="_blank" rel="noreferrer">Chrome/Edge üçün quraşdırma qaydası</a> · <a href="/radaz-chatgpt-extension.zip" download>0.3.2 əlavəsini yüklə</a></>}<button type="button" disabled={bridge==='checking'} onClick={()=>void checkBridge()}>Bağlantını yoxla</button></div>
  <span className="chatgpt-selection">{images.length} görüntü · bütün kəsitlər · bir ZIP</span>
  <label>Klinik məlumat və sual<textarea rows={3} value={clinical} disabled={busy} placeholder="Şikayət, anamnez və radioloji sual" onChange={e=>{invalidate();setClinical(e.target.value);}}/></label>
  <button disabled={busy||!images.length} onClick={()=>void prepare()}><PackageOpen size={16}/>{busy?'Hazırlanır / ötürülür…':'Bütün görüntüləri ZIP hazırla'}</button>
  {bundle&&<><div className="chatgpt-previews">{bundle.previews.map(im=><div key={im.name}><a href={im.data} download={im.name} title={`${im.name} — JPEG yüklə`}><img src={im.data} alt={im.name}/><span>JPEG yüklə</span></a><button type="button" aria-label={`${im.name} görüntüsünü kopyala`} onClick={()=>void copyImage(im.data)}>Görüntünü kopyala</button></div>)}</div><p>Önbaxış: ilk {bundle.previews.length} görüntü. ZIP-də {bundle.count} görüntünün hamısı var.</p><p className="chatgpt-privacy">Pasiyent etiketləri əlavə edilmir. Pikselə yazılmış məlumatlar qala bilər; önbaxışı yoxlayın.</p>
  {bundle.count>CHATGPT_IMAGE_BATCH&&<label>Birbaşa JPEG qrupu<select disabled={busy} value={first} onChange={e=>setFirst(Number(e.target.value))}>{Array.from({length:Math.ceil(bundle.count/CHATGPT_IMAGE_BATCH)},(_,i)=>i*CHATGPT_IMAGE_BATCH).map(start=><option key={start} value={start}>{start+1}–{Math.min(bundle.count,start+CHATGPT_IMAGE_BATCH)} / {bundle.count}</option>)}</select><small>JPEG-lər {CHATGPT_IMAGE_BATCH}-lik qruplarla ötürülür. Hər qrup üçün ayrıca ötürün; ZIP bütün görüntüləri saxlayır.</small></label>}
  <label><input type="checkbox" checked={includeZip} disabled={busy} onChange={e=>setIncludeZip(e.target.checked)}/> Bütün görüntülərin ZIP-ini də əlavə et</label><p>Bu ötürmə: {includeZip?'1 ZIP + ':''}{Math.min(CHATGPT_IMAGE_BATCH,bundle.count-first)} JPEG ({first+1}–{Math.min(bundle.count,first+CHATGPT_IMAGE_BATCH)}). ZIP qəbul edilmirsə, yuxarıdakı seçimi söndürüb yalnız JPEG-ləri ötürün.</p>
  <button className="chatgpt-send" disabled={busy||bridge!=='ready'} onClick={()=>void transfer()}><MessageCircle size={16}/>Görüntüləri ChatGPT-yə ötür</button><div className="chatgpt-fallback">{url&&<a href={url} download="RADAZ-ChatGPT.zip"><Download size={14}/>ZIP yüklə</a>}<button onClick={()=>void navigator.clipboard.writeText(prompt).then(()=>setStatus('Tapşırıq kopyalandı')).catch(()=>setStatus('Mətni aşağıdakı sahədən seçib kopyalayın.'))}><Clipboard size={14}/>Tapşırığı kopyala</button><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT aç</a></div><details><summary>Tapşırıq mətni</summary><textarea readOnly rows={8} value={prompt} onFocus={e=>e.target.select()}/></details></>}
  <p role="status" className="chatgpt-status">{status}</p>
  <section aria-label="ChatGPT analizi"><h3>ChatGPT analizi</h3>{answer?<div className="chatgpt-answer">{answer}</div>:<p>ChatGPT cavabı hazır olanda əlavədəki “RADAZ-a qaytar” düyməsini basın. Cavab burada görünəcək.</p>}<details><summary>Cavabı əl ilə yapışdır</summary><textarea value={answer} rows={7} onChange={e=>setAnswer(e.target.value)}/></details><button disabled={!answer.trim()} onClick={()=>{onPaste(answer.trim());setStatus('Analiz hesabatın sonuna əlavə edildi.');}}>Yoxlanmış analizi hesabata əlavə et</button></section>
 </div>;
}
