'use client';
import { OutputPageHeader } from '@/components/output-page-header';
import { useEffect, useState } from 'react';
import { Printer, ArrowLeft, Radio } from 'lucide-react';
import { defaultPrinter, loadPrinterSettings, savePrinterSettings } from '@/lib/printer-settings';
import { outputRequest } from '@/lib/output-jobs';

export default function PrinterSettingsPage() {
  useEffect(() => { document.title = 'RADAZ · Printer ayarları'; }, []);
  const [settings, setSettings] = useState(defaultPrinter), [printers, setPrinters] = useState<string[]>([]);
  const [status, setStatus] = useState('Ayarlar oxunur…'), [busy, setBusy] = useState(false);
  useEffect(() => { void loadPrinterSettings().then(setSettings); void outputRequest<{ printers: string[] }>('/output-devices').then(value => { setPrinters(value.printers); setStatus('Ayarlar bu RADAZ serverinə qoşulan cihazlar üçün ortaqdır.'); }).catch(error => setStatus(String(error))); }, []);
  const save = async () => { setBusy(true); try { setSettings(await savePrinterSettings(settings)); setStatus('Printer ayarları saxlanıldı'); } catch(error) { setStatus(String(error)); } finally { setBusy(false); } };
  const test = async () => { setBusy(true); try { const value = await outputRequest<{message:string}>('/printer-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)}); setStatus(value.message); } catch(error) { setStatus(String(error)); } finally { setBusy(false); } };
  return <main className="output-settings-page"><OutputPageHeader kind="settings"/><form onSubmit={event => { event.preventDefault(); void save(); }}>
    <section><h2><Printer size={20}/> Adi printer</h2><p>Çap zamanı brauzerin pəncərəsində printer, nüsxə sayı və kağız seçilir. Telefonda və planşetdə həmin cihazın çap xidməti istifadə olunur.</p><label>Standart kağız<select value={settings.paperSize} onChange={e => setSettings({...settings,paperSize:e.target.value})}><option>A4</option><option>A3</option><option>Letter</option></select></label><p>RADAZ kompüterində: {printers.join(', ') || 'Printer siyahısı əlçatan deyil'}</p></section>
    <section><h2><Radio size={20}/> DICOM printer</h2><div className="output-fields">
      <label>Printer IP / host<input placeholder="192.168.1.50" value={settings.host} onChange={e => setSettings({...settings,host:e.target.value})}/></label>
      <label>Port<input required type="number" min="1" max="65535" value={settings.port} onChange={e => setSettings({...settings,port:e.target.value})}/></label>
      <label>Printer AE Title<input required maxLength={16} value={settings.aeTitle} onChange={e => setSettings({...settings,aeTitle:e.target.value.toUpperCase()})}/></label>
      <label>RADAZ AE Title<input required maxLength={16} value={settings.callingAe} onChange={e => setSettings({...settings,callingAe:e.target.value.toUpperCase()})}/></label>
      <label>Media<select value={settings.mediumType} onChange={e => setSettings({...settings,mediumType:e.target.value})}><option>BLUE FILM</option><option>CLEAR FILM</option><option>PAPER</option></select></label>
      <label>Nüsxə sayı<input type="number" min="1" max="99" value={settings.copies} onChange={e => setSettings({...settings,copies:+e.target.value})}/></label>
      <label>Plyonka ölçüsü<select value={settings.filmSize} onChange={e => setSettings({...settings,filmSize:e.target.value})}>{['8INX10IN','10INX12IN','11INX14IN','14INX17IN','A4','A3'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Standart bölgü<select value={settings.layout} onChange={e => setSettings({...settings,layout:e.target.value})}>{['1,1','1,2','2,2','2,3','2,4','3,3','3,4','4,4'].map(value => <option key={value} value={value}>{value.replace(',',' × ')}</option>)}</select></label>
      <label>İstiqamət<select value={settings.orientation} onChange={e => setSettings({...settings,orientation:e.target.value as 'PORTRAIT'|'LANDSCAPE'})}><option value="PORTRAIT">Portret</option><option value="LANDSCAPE">Landşaft</option></select></label>
    </div><button type="button" disabled={busy || !settings.host} onClick={() => void test()}>Bağlantını yoxla (çap etmir)</button></section>
    <p role="status">{status}</p><button type="submit" className="output-primary" disabled={busy}>{busy ? 'Gözləyin…' : 'Ayarları yadda saxla'}</button>
  </form></main>;
}
