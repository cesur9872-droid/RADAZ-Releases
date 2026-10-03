import type { WorkProgress } from './work-progress';
const CHANNEL = 'radaz-viewer-open-v2';
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
const validStudy = (v: unknown): v is string => typeof v === 'string' && v.length <= 64 && /^[0-9]+(?:\.[0-9]+)*$/.test(v);

/** A unique browsing context owns each study's pixels, camera and measurements. */
export function focusViewer(): Window | null {
  return window.open('/?pending=pacs', `RADAZ_VIEWER_${randomId()}`);
}
export function registerViewer(_load: (study: string) => Promise<void>, progress?: (value: WorkProgress | null, error?: string) => void) {
  if (!window.name.startsWith('RADAZ_VIEWER_')) window.name = `RADAZ_VIEWER_${randomId()}`;
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = event => {
    const data = event.data;
    if (data?.kind === 'PROGRESS' && data.target === window.name) progress?.(data.progress, data.error);
  };
  return () => channel.close();
}
export function notifyViewerProgress(tab: Window | null, progress: WorkProgress | null, error?: string) {
  if (!tab || tab.closed) return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ kind: 'PROGRESS', target: tab.name, progress, error }); channel.close();
}
export async function openStudyInViewer(study: string, reserved?: Window | null): Promise<'new'> {
  return openStudiesInViewer([study],reserved);
}
export function requestedStudies(hash:string):string[] {
  const params=new URLSearchParams(hash.replace(/^#/,''));
  const studies=(params.get('archive-studies')||params.get('archive-study')||'').split(',').filter(Boolean);
  if(studies.length>200||studies.some(id=>!validStudy(id)))throw new Error('DICOM Study UID düzgün deyil');
  return [...new Set(studies)];
}
export async function openStudiesInViewer(studies: string[], reserved?: Window | null): Promise<'new'> {
  if (!studies.length||studies.length>200||studies.some(study=>!validStudy(study))) throw new Error('DICOM Study UID düzgün deyil');
  const unique=[...new Set(studies)];
  const url = unique.length===1?`/#archive-study=${encodeURIComponent(unique[0])}`:`/#archive-studies=${encodeURIComponent(unique.join(','))}`;
  const tab = reserved === undefined ? window.open(url, `RADAZ_VIEWER_${randomId()}`) : reserved;
  if (!tab || tab.closed) throw new Error('Yeni Viewer vərəqəsi açıla bilmədi. RADAZ üçün pop-up icazəsini aktiv edin.');
  if (reserved !== undefined) tab.location.assign(url);
  tab.focus(); return 'new';
}
