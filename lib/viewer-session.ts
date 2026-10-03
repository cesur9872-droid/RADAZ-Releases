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
  if (!validStudy(study)) throw new Error('DICOM Study UID düzgün deyil');
  const url = `/#archive-study=${encodeURIComponent(study)}`;
  const tab = reserved === undefined ? window.open(url, `RADAZ_VIEWER_${randomId()}`) : reserved;
  if (!tab || tab.closed) throw new Error('Yeni Viewer vərəqəsi açıla bilmədi. RADAZ üçün pop-up icazəsini aktiv edin.');
  if (reserved !== undefined) tab.location.assign(url);
  tab.focus(); return 'new';
}
