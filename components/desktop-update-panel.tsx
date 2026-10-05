'use client';
import {useEffect,useRef,useState} from 'react';
type State={managed?:boolean;state:string;message:string;version?:string;progress?:{done:number;total:number;unit?:string}|null};
export function DesktopUpdatePanel({fallback,onCheck,busy}:{fallback:React.ReactNode;onCheck:()=>void;busy:boolean}){
 const [state,setState]=useState<State|null>(null),[starting,setStarting]=useState(false),[error,setError]=useState('');
 const [confirmVersion,setConfirmVersion]=useState<string|null>(null);
 const managed=useRef(false);
 useEffect(()=>{
  let alive=true,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{
   try{const response=await fetch('/radaz-installation.json',{cache:'no-store'});if(!response.ok)throw Error('status');const value=await response.json() as State;if(alive){managed.current=!!value.managed;setState(value);setError('');}}
   catch{if(alive&&managed.current)setError('Yeniləmə xidməti ilə əlaqə kəsildi. Yenidən cəhd edin.');}
   finally{if(alive)timer=setTimeout(poll,750);}
  };void poll();return()=>{alive=false;clearTimeout(timer);};
 },[]);
 const active=!!state&&['checking','downloading','verifying','installing'].includes(state.state);
 const start=async(version?:string)=>{
  if(!state?.managed){onCheck();return;}
  setStarting(true);setError('');
  try{const response=await fetch('/radaz-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(version?{action:'download',version,confirmed:true}:{action:'check'})});
   if(!response.ok)throw Error('Yeniləmə başladılmadı. RADAZ-ı iş masasındakı qısayoldan başladın.');
   setConfirmVersion(null);setState({...state,state:'checking',message:version?'Təsdiqlənmiş yeniləmə hazırlanır…':'Yeniləmələr yoxlanılır…',progress:null});
  }catch(cause){setError(cause instanceof Error?cause.message:String(cause));}finally{setStarting(false);}
 };
 const done=state?.progress?.done||(state?.state==='ready'?1:0),total=state?.progress?.total||(state?.state==='ready'?1:0);
 const success=state?.state==='ready'||state?.state==='current';
 return <>
  {state?.managed?<div className="desktop-update-progress" data-state={state.state}>
   <p role={state.state==='error'?'alert':'status'}>{state.message}</p>
   {(active||state.state==='ready')&&<><progress aria-label="Yenilənmə prosesi" max={total||1} value={total?Math.min(done,total):undefined}/>
    <span>{total?`${Math.round(done/total*100)}%`:'Hazırlanır…'}{state.progress?.unit==='bayt'&&total>0?` · ${(done/1048576).toFixed(1)} / ${(total/1048576).toFixed(1)} MB`:''}</span></>}
   {success&&<p className="update-confirmation">{state.state==='ready'?'Yeniləmə hazırdır. Setup-ı yenidən quraşdırmaq lazım deyil.':'RADAZ yenilənmə vəziyyəti təsdiqləndi.'}</p>}
  </div>:fallback}
  {error&&<p role="alert">{error}</p>}
  <p className="product-note">Yeni versiya haqqında yalnız bildiriş göstərilir. Yükləmə “Yenilə” düyməsindən sonra təsdiqinizlə başlayır. Hazır yeniləmə növbəti açılışda tətbiq edilir; lokal arxiv saxlanılır.</p>
  {confirmVersion&&<div className="update-approval" role="group" aria-label="Yeniləməni təsdiqlə">
   <p>RADAZ {confirmVersion} yüklənib növbəti açılış üçün hazırlansın?</p>
   <button disabled={starting||active||state?.version!==confirmVersion} onClick={()=>void start(confirmVersion)}>Təsdiq et və yenilə</button>
   <button disabled={starting} onClick={()=>setConfirmVersion(null)}>Ləğv et</button>
  </div>}
  {!confirmVersion&&<button disabled={starting||active||busy||state?.state==='ready'||state?.state==='deferred'} onClick={()=>{
   if(state?.managed&&state.state==='available'&&state.version)setConfirmVersion(state.version);else void start();
  }}>{starting||active?'Yoxlanılır…':state?.state==='available'?'Yenilə':'Yeniləmələri yoxla'}</button>}
 </>;
}
