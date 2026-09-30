import type { ArchiveStudy } from './local-archive';

export type ArchiveReceiverStatus = {
  aeTitle: string; port: number; enabled: boolean; running: boolean; error: string;
  addresses: string[]; databasePath: string; storagePath: string; instanceCount: number; size: number;
};
export function hasLocalArchiveEndpoint() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}
async function request(path: string, init: RequestInit = {}, timeout = 10000) {
  if (!hasLocalArchiveEndpoint()) throw new Error('Disk arxivi üçün bu kompüterdə START-RADAZ.cmd ilə lokal proqramı açın');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`/local-archive-api${path}`, { ...init, cache: 'no-store', signal: controller.signal });
    if (!response.ok) {
      const result: unknown = await response.json().catch(() => null);
      throw new Error(result && typeof result === 'object' && 'error' in result ? String(result.error) : 'Daimi arxiv xidməti işləmir. START-RADAZ.cmd faylını başladın.');
    }
    return response;
  } finally { clearTimeout(timer); }
}
export const receiverStatus = async (): Promise<ArchiveReceiverStatus> => (await request('/status', {}, 2500)).json();
export const diskStudies = async (): Promise<ArchiveStudy[]> => (await request('/studies', {}, 4000)).json();
export const configureReceiver = async (settings: Pick<ArchiveReceiverStatus, 'aeTitle' | 'port' | 'enabled'>): Promise<ArchiveReceiverStatus> =>
  (await request('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })).json();
export async function diskFiles(study: string): Promise<File[]> {
  const items: { uid: string }[] = await (await request(`/instances?study=${encodeURIComponent(study)}`)).json();
  const files: File[] = [];
  for (const item of items) {
    const response = await request(`/file/${encodeURIComponent(item.uid)}`, {}, 60000);
    files.push(new File([await response.blob()], `${item.uid}.dcm`, { type: 'application/dicom' }));
  }
  return files;
}
export async function saveDiskFiles(files: File[], onProgress?: (done: number, total: number) => void) {
  for (const [index, file] of files.entries()) {
    await request('/import', { method: 'POST', headers: { 'Content-Type': 'application/dicom' }, body: file }, 60000);
    onProgress?.(index + 1, files.length);
  }
}
export const diskStudyOpened = async (study: string) => request('/opened', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ study }),
});
