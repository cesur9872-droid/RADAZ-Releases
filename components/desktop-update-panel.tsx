'use client';
import {useEffect,useRef,useState} from 'react';
type State={managed?:boolean;state:string;message:string;version?:string;progress?:{done:number;total:number;unit?:string}|null};
export function DesktopUpdatePanel({fallback,onCheck,busy,onComplete}:{fallback:React.ReactNode;onCheck:()=>void;busy:boolean;onComplete?:()=>void}){
 const [state,setState]=useState<State|null>(null),[starting,setStarting]=useState(false),[error,setError]=useState('');
 const [confirmVersion,setConfirmVersion]=useState<string|null>(null);
 const managed=useRef(false),restartInProgress=useRef(false);
 const downloading=useRef(false),complete=useRef(onComplete);complete.current=onComplete;
 const [applyConfirm,setApplyConfirm]=useState(false),[applying,setApplying]=useState(false);
 useEffect(()=>{
  if(['downloading','verifying','installing'].includes(state?.state||''))downloading.current=true;
  if(state?.state!=='ready'||!downloading.current)return;
  const timer=setTimeout(()=>{downloading.current=false;complete.current?.();},2500);return()=>clearTimeout(timer);
 },[state?.state]);
 useEffect(()=>{
  let alive=true,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{
   try{const response=await fetch('/radaz-installation.json',{cache:'no-store'});if(!response.ok)throw Error('status');const value=await response.json() as State;if(alive){managed.current=!!value.managed;setState(value);setError('');}}
   catch{if(alive&&managed.current&&!restartInProgress.current)setError('Yeniləmə xidməti ilə əlaqə kəsildi. Yenidən cəhd edin.');}
   finally{if(alive)timer=setTimeout(poll,750);}
  };void poll();return()=>{alive=false;clearTimeout(timer);};
 },[]);
 const active=!!state&&['checking','downloading','verifying','installing'].includes(state.state);
 const start=async(version?:string)=>{
  if(!state?.managed){onCheck();return;}
  setStarting(true);setError('');
  try{const response=await fetch('/radaz-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(version?{action:'download',version,confirmed:true}:{action:'check'})});
   if(!response.ok)throw Error('Yeniləmə başladılmadı. RADAZ-ı iş masasındakı qısayoldan başladın.');
   if(version)downloading.current=true;
   setConfirmVersion(null);setState({...state,state:'checking',message:version?'Təsdiqlənmiş yeniləmə hazırlanır…':'Yeniləmələr yoxlanılır…',progress:null});
  }catch(cause){setError(cause instanceof Error?cause.message:String(cause));}finally{setStarting(false);}
 };
 const apply=async()=>{
  if(!state?.version)return;restartInProgress.current=true;setApplying(true);setError('');
  try{
   const target=state.version,response=await fetch('/radaz-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'apply',version:target,confirmed:true})});
   if(!response.ok)throw Error('Yenidən başlatma qəbul edilmədi. Yenilənmələri yenidən yoxlayın.');
   for(let i=0;i<120;i++){
    await new Promise(r=>setTimeout(r,1000));
    try{const runtime=await fetch('/radaz-runtime.json',{cache:'no-store'}).then(r=>r.json()) as {version:string};if(runtime.version===target){location.reload();return;}
     const status=await fetch('/radaz-installation.json',{cache:'no-store'}).then(r=>r.json()) as {state:string;message:string};if(['error','deferred'].includes(status.state))throw Object.assign(Error(status.message),{terminal:true});
    }catch(cause){if((cause as {terminal?:boolean}).terminal)throw cause;}
   }
   throw Error('Açılış təsdiqlənmədi. RADAZ qısayolunu açın; əvvəlki versiya qorunur.');
  }catch(cause){restartInProgress.current=false;setError(cause instanceof Error?cause.message:String(cause));setApplying(false);setApplyConfirm(false);}
 };
 const done=state?.progress?.done||(state?.state==='ready'?1:0),total=state?.progress?.total||(state?.state==='ready'?1:0);
 const success=state?.state==='ready'||state?.state==='current';
 return <>
  {state?.managed?<div className="desktop-update-progress" data-state={state.state}>
   <p role={state.state==='error'?'alert':'status'}>{state.message}</p>
   {(active||state.state==='ready')&&<><progress aria-label="Yenilənmə prosesi" max={total||1} value={total?Math.min(done,total):undefined}/>
    <span>{total?`${Math.round(done/total*100)}%`:'Hazırlanır…'}{state.progress?.unit==='bayt'&&total>0?` · ${(done/1048576).toFixed(1)} / ${(total/1048576).toFixed(1)} MB`:''}</span></>}
   {success&&<p className="update-confirmation">{state.state==='ready'?'Endirmə tamamlandı. Yeni versiyanı tətbiq etmək üçün yenidən başladın.':'RADAZ yenilənmə vəziyyəti təsdiqləndi.'}</p>}
  </div>:fallback}
  {error&&<p role="alert">{error}</p>}
  <p className="product-note">Yeni versiya haqqında yalnız bildiriş göstərilir. Yükləmə “Yenilə” düyməsindən sonra təsdiqinizlə başlayır. Hazır yeniləmə növbəti açılışda tətbiq edilir; lokal arxiv saxlanılır.</p>
  {confirmVersion&&<div className="update-approval" role="group" aria-label="Yeniləməni təsdiqlə">
   <p>RADAZ {confirmVersion} yüklənib növbəti açılış üçün hazırlansın?</p>
   <button disabled={starting||active||state?.version!==confirmVersion} onClick={()=>void start(confirmVersion)}>Təsdiq et və yenilə</button>
   <button disabled={starting} onClick={()=>setConfirmVersion(null)}>Ləğv et</button>
  </div>}
  {state?.managed&&['ready','deferred'].includes(state.state)&&<div className="update-approval">
   {applyConfirm?<><p>Açıq işinizi saxlayın. RADAZ yenidən başlayacaq; arxiv məlumatları qorunur.</p><button disabled={applying} onClick={()=>void apply()}>{applying?'RADAZ yenidən başlayır…':'Təsdiq et və yenidən başlat'}</button><button disabled={applying} onClick={()=>setApplyConfirm(false)}>Sonra</button></>:<button onClick={()=>setApplyConfirm(true)}>Yenidən başlat və tətbiq et</button>}
  </div>}
  {!confirmVersion&&<button disabled={starting||active||busy||applying} onClick={()=>{
   if(state?.managed&&state.state==='available'&&state.version)setConfirmVersion(state.version);else void start();
  }}>{starting||active?'Yoxlanılır…':state?.state==='available'?'Yenilə':'Yeniləmələri yoxla'}</button>}
 </>;
}
