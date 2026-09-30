import { outputRequest } from './output-jobs';
export type PrinterSettings = { host: string; port: string; aeTitle: string; callingAe: string; mediumType: string; copies: number; filmSize: string; orientation: 'PORTRAIT'|'LANDSCAPE'; layout: string; paperSize: string };
export const defaultPrinter: PrinterSettings = { host: '', port: '104', aeTitle: 'PRINTER', callingAe: 'RADAZ', mediumType: 'BLUE FILM', copies: 1, filmSize: '14INX17IN', orientation: 'PORTRAIT', layout: '2,2', paperSize: 'A4' };
export async function loadPrinterSettings(): Promise<PrinterSettings> {
  try { return { ...defaultPrinter, ...await outputRequest<Partial<PrinterSettings>>('/printer-settings') }; }
  catch { try { return { ...defaultPrinter, ...JSON.parse(localStorage.getItem('radaz-dicom-printer-v1') || '{}') }; } catch { return defaultPrinter; } }
}
export async function savePrinterSettings(value: PrinterSettings) {
  const result = await outputRequest<PrinterSettings>('/printer-settings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(value) });
  localStorage.setItem('radaz-dicom-printer-v1', JSON.stringify(result)); return result;
}
