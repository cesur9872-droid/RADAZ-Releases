import type { RemoteSeries, RemoteStudy } from './dicomweb';

export type DimseLocation = { host: string; port: string; aeTitle: string };
type BridgeList<T> = { items: T[]; truncated: boolean };
const base = 'http://127.0.0.1:8765';

export async function getDimseBridgeVersion(): Promise<number> {
  try {
    const response = await fetch(`${base}/health`, {
      mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      targetAddressSpace: 'loopback',
    } as RequestInit & { targetAddressSpace: 'loopback' });
    if (!response.ok) throw new Error(`PACS körpüsü HTTP ${response.status}`);
    const health: unknown = await response.json();
    return health && typeof health === 'object' && 'version' in health && Number.isFinite(Number(health.version))
      ? Number(health.version) : 0;
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Yerli PACS körpüsünə bağlantı alınmadı');
    throw error;
  }
}

async function bridgeRequest<T>(path: string, location: DimseLocation, callingAe: string,
  filters: Record<string, unknown>, read: (response: Response) => Promise<T>, timeout = 45000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...location, callingAe, ...filters }),
      signal: controller.signal,
      targetAddressSpace: 'loopback',
    } as RequestInit & { targetAddressSpace: 'loopback' });
    if (!response.ok) {
      const result: unknown = await response.json().catch(() => null);
      const message = path === '/retrieve' && response.status === 404
        ? 'Görüntü endirmək üçün RADAZ PACS körpüsünün yeni versiyasını endirib başladın.'
        : result && typeof result === 'object' && 'error' in result ? String(result.error) : `PACS körpüsü HTTP ${response.status}`;
      if (path === '/retrieve' && message.startsWith('PACS çağıran ') && message.includes('AE-ni tanımır')) {
        throw new Error(`PACS C-MOVE 0xA801: ${callingAe} adlı görüntü qəbul ünvanı serverdə qeyd edilməyib. PACS administratoru həmin AE adını, bu kompüterin LAN IPv4 ünvanını və listener port ${filters.listenerPort} məlumatını PACS-in DICOM Devices siyahısına əlavə etməlidir.`);
      }
      throw new Error(message);
    }
    return await read(response);
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Yerli PACS körpüsünə bağlantı alınmadı. Körpü ZIP-ni endirib bu kompüterdə başladın və Chrome-un lokal şəbəkə icazəsini qəbul edin.');
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('PACS cavabı gecikir. Şəbəkəni və körpünün işlədiyini yoxlayın.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const request = <T,>(path: string, location: DimseLocation, callingAe: string, filters: Record<string, unknown> = {}) =>
  bridgeRequest<T>(path, location, callingAe, filters, response => response.json() as Promise<T>);

export const queryDimseStudies = (location: DimseLocation, callingAe: string, patient: string, date: string) =>
  request<BridgeList<RemoteStudy>>('/studies', location, callingAe, { patient, date: date.replaceAll('-', '') });

export const queryDimseSeries = (location: DimseLocation, callingAe: string, studyUID: string) =>
  request<BridgeList<RemoteSeries>>('/series', location, callingAe, { studyUID });

export const echoDimse = (location: DimseLocation, callingAe: string) =>
  request<{ ok: boolean }>('/echo', location, callingAe);

export async function retrieveDimseStudy(location: DimseLocation, callingAe: string, listenerPort: string,
  studyUID: string, seriesUIDs: string[], onProgress: (done: number, total: number) => void): Promise<File[]> {
  const buffer = await bridgeRequest('/retrieve', location, callingAe,
    { listenerPort, studyUID, seriesUIDs }, response => response.arrayBuffer(), 10 * 60 * 1000);
  const JSZip = (await import('jszip')).default;
  const archive = await JSZip.loadAsync(buffer);
  const images = Object.values(archive.files).filter(entry => !entry.dir && entry.name.toLowerCase().endsWith('.dcm'));
  if (!images.length) throw new Error('PACS köçürməsində DICOM görüntüsü tapılmadı');
  if (images.length > 800) throw new Error('800-dən çox görüntü var. Daha az seriya seçin.');
  const files: File[] = [];
  for (const image of images) {
    const bytes = await image.async('uint8array');
    files.push(new File([Uint8Array.from(bytes)], image.name.split('/').pop() || `${files.length}.dcm`, { type: 'application/dicom' }));
    onProgress(files.length, images.length);
  }
  return files;
}
