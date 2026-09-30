export type DicomPrinterConfig = { host: string; port: string; aeTitle: string; callingAe: string; mediumType: string; copies?: number };
type Film = { filmSize: string; orientation: string; layout: string; images: Array<{ rows: number; columns: number; pixels: string }> };

export async function printDicomFilm(printer: DicomPrinterConfig, film: Film): Promise<{ message: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch('/local-archive-api/print', {
      method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...printer, ...film }), signal: controller.signal,
    });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result && typeof result === 'object' && 'error' in result ? String(result.error) : `Körpü HTTP ${response.status}`);
    return result as { message: string };
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Lokal çap xidmətinə bağlantı kəsildi. Təkrar göndərmədən əvvəl printer növbəsini yoxlayın.');
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Printer cavabı üçün vaxt bitdi. Çap baş tutmuş ola bilər; təkrar göndərmədən əvvəl printer növbəsini yoxlayın.');
    throw error;
  } finally { clearTimeout(timer); }
}
