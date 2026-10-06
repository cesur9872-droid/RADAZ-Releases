import type { WorkProgress } from './work-progress';
const CHANNEL = 'radaz-viewer-open-v2';
const VIEWER_KEY = 'radaz-active-viewer';
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
const recordsToken = (value: string) => /^RADAZ_RECORDS_[a-f0-9]{32}$/.test(value);
export function openRecordsWindow(kind: 'archive' | 'pacs') {
  const token = `RADAZ_RECORDS_${randomId()}`;
  return window.open(`/${kind}?records=${token}`, token, `popup=yes,width=${Math.min(1440,screen.availWidth)},height=${Math.min(960,screen.availHeight)},resizable=yes,scrollbars=yes`);
}
export function recordsWindowTitle(label: string) {
  // Edge/PWA may sever window.opener or reset window.name across window groups.
  const token = new URLSearchParams(window.location.search).get('records') || window.name;
  if (recordsToken(token)) window.name = token;
  document.title = `RADAZ · ${label}`;
}
let maximizing: Promise<void> | undefined;
let nativeRegistration: Promise<void> | undefined;
function maximizeViewerWindow() {
  window.focus();
  if (maximizing) return maximizing;
  maximizing = Promise.resolve(nativeRegistration).then(() => nativeViewerAction('maximize')).finally(() => { maximizing = undefined; });
  return maximizing;
}
async function nativeViewerAction(action: 'register' | 'maximize') {
  if (!/^RADAZ_VIEWER_[a-f0-9]{32}$/.test(window.name)) return;
  const title = document.title;
  try {
    // Keep the token until the bridge locates the native window. Edge may take
    // longer than a single frame to update its caption after Viewer activation.
    document.title = `RADAZ [${window.name}] · ${title}`;
    const response = await fetch(`/local-archive-api/window/${action}`, {method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({token:window.name}), signal:AbortSignal.timeout(3500)});
    await response.json();
  } catch { /* The already-focused Viewer remains usable without a native bridge. */ }
  finally { document.title = title; }
}
const validStudy = (v: unknown): v is string => typeof v === 'string' && v.length <= 64 && /^[0-9]+(?:\.[0-9]+)*$/.test(v);

export type ViewerTarget=Window|{kind:'registered';name:string;closed:false};

/** Find live Viewers even when tabs were opened independently (different opener groups). */
export async function focusViewer(): Promise<ViewerTarget|null> {
  let name = 'RADAZ_VIEWER_MAIN';
  try { const saved=localStorage.getItem(VIEWER_KEY);if(saved&&/^RADAZ_VIEWER_[a-zA-Z0-9]+$/.test(saved))name=saved; } catch {}
  const live=typeof BroadcastChannel!=='undefined'&&await new Promise<string|null>(resolve=>{
    const channel=new BroadcastChannel(CHANNEL),request=randomId();let first:string|null=null;
    const finish=()=>{clearTimeout(timer);channel.close();resolve(first);};
    const timer=setTimeout(finish,150);
    channel.onmessage=e=>{if(e.data?.kind==='PRESENT'&&e.data.request===request&&typeof e.data.name==='string'){
      first=first||e.data.name;if(e.data.name===name){first=name;finish();}
    }};
    channel.postMessage({kind:'FIND',request});
  });
  if(live){const channel=new BroadcastChannel(CHANNEL);channel.postMessage({kind:'FOCUS',target:live});channel.close();return {kind:'registered',name:live,closed:false};}
  const tab=window.open('',name);
  if(tab&&!tab.closed){if(tab.location.href==='about:blank')tab.location.replace('/?pending=pacs');tab.focus();}
  return tab;
}
export function registerViewer(load: (studies: string[]) => Promise<void>, progress?: (value: WorkProgress | null, error?: string) => void) {
  if (!/^RADAZ_VIEWER_[a-f0-9]{32}$/.test(window.name)) window.name = `RADAZ_VIEWER_${randomId()}`;
  const register=()=>{try{localStorage.setItem(VIEWER_KEY,window.name);}catch{}};
  register();window.addEventListener('focus',register);
  nativeRegistration = nativeViewerAction('register');
  if (window.location.hash.includes('archive-stud') || new URLSearchParams(window.location.search).has('pending')) void maximizeViewerWindow();
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = event => {
    const data = event.data;
    if(data?.kind==='FIND'){channel.postMessage({kind:'PRESENT',request:data.request,name:window.name});return;}
    if(data?.target!==window.name)return;
    if(data.kind==='FOCUS')void maximizeViewerWindow();
    if(data.kind==='PROGRESS')progress?.(data.progress,data.error);
    if(data.kind==='OPEN'&&Array.isArray(data.studies)&&data.studies.length>0&&data.studies.length<=200&&data.studies.every(validStudy)){
      channel.postMessage({kind:'ACCEPTED',request:data.request});
      void maximizeViewerWindow();void load([...new Set<string>(data.studies)]).catch(error=>progress?.(null,String(error)));
    }
  };
  return () => {window.removeEventListener('focus',register);channel.close();};
}
export function notifyViewerProgress(tab: ViewerTarget | null, progress: WorkProgress | null, error?: string) {
  if (!tab || tab.closed) return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ kind: 'PROGRESS', target: tab.name, progress, error }); channel.close();
}
export async function openStudyInViewer(study: string, reserved?: ViewerTarget | null): Promise<'new'|'reused'> {
  return openStudiesInViewer([study],reserved);
}
export function requestedStudies(hash:string):string[] {
  const params=new URLSearchParams(hash.replace(/^#/,''));
  const studies=(params.get('archive-studies')||params.get('archive-study')||'').split(',').filter(Boolean);
  if(studies.length>200||studies.some(id=>!validStudy(id)))throw new Error('DICOM Study UID düzgün deyil');
  return [...new Set(studies)];
}
export async function openStudiesInViewer(studies: string[], reserved?: ViewerTarget | null): Promise<'new'|'reused'> {
  if (!studies.length||studies.length>200||studies.some(study=>!validStudy(study))) throw new Error('DICOM Study UID düzgün deyil');
  const unique=[...new Set(studies)];
  const url = unique.length===1?`/#archive-study=${encodeURIComponent(unique[0])}`:`/#archive-studies=${encodeURIComponent(unique.join(','))}`;
  const tab = reserved === undefined ? await focusViewer() : reserved;
  if (!tab || tab.closed) throw new Error('Yeni Viewer vərəqəsi açıla bilmədi. RADAZ üçün pop-up icazəsini aktiv edin.');
  // A ready Viewer loads in place; a closed/starting Viewer navigates the same reserved tab.
  const accepted=typeof BroadcastChannel!=='undefined'&&await new Promise<boolean>(resolve=>{
    const channel=new BroadcastChannel(CHANNEL),request=randomId();
    const finish=(value:boolean)=>{clearTimeout(timer);channel.close();resolve(value);};
    const timer=setTimeout(()=>finish(false),450);
    channel.onmessage=e=>{if(e.data?.kind==='ACCEPTED'&&e.data.request===request)finish(true);};
    channel.postMessage({kind:'OPEN',request,target:tab.name,studies:unique});
  });
  if(!accepted){
    const fallback='kind' in tab?window.open(url,tab.name):tab;
    if(!fallback||fallback.closed)throw new Error('Viewer bağlanıb. Müayinəni açmaq üçün yenidən klikləyin.');
    if(!('kind' in tab))fallback.location.assign(url);
    fallback.focus();
  }else if(!('kind' in tab))tab.focus();
  return accepted?'reused':'new';
}
