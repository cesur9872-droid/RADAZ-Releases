'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Database, Settings2, X } from 'lucide-react';
import { configureReceiver, receiverStatus, type ArchiveReceiverStatus } from '@/lib/disk-archive';

export function ArchiveReceiverPanel() {
  const [status, setStatus] = useState<ArchiveReceiverStatus | null>(null);
  const [open, setOpen] = useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  const [aeTitle, setAeTitle] = useState('RADAZ_ARCHIVE');
  const [port, setPort] = useState('11113');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    const refresh = () => void receiverStatus().then(value => {
      if (disposed) return;
      setStatus(value); setError('');
      if (!open) { setAeTitle(value.aeTitle); setPort(String(value.port)); }
    }).catch(reason => { if (!disposed) { setStatus(null); setError(reason instanceof Error ? reason.message : String(reason)); } });
    refresh(); const timer = setInterval(refresh, 10000);
    return () => { disposed = true; clearInterval(timer); };
  }, [open]);
  const save = async (enabled: boolean) => {
    setBusy(true); setError('');
    try { const value = await configureReceiver({ aeTitle: aeTitle.trim(), port: Number(port), enabled }); setStatus(value); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  return <><button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><Settings2 size={18}/><span>Qəbul ayarları</span></button>
   {open && createPortal(<dialog ref={dialog} className="product-dialog receiver-dialog" aria-label="Qəbul ayarları" onCancel={()=>setOpen(false)} onClick={event=>{if(event.target===dialog.current)setOpen(false);}}>
    <header><Database size={24}/><h2>Qəbul ayarları</h2><button type="button" aria-label="Qəbul ayarlarını bağla" onClick={()=>setOpen(false)}><X size={20}/></button></header><div className="product-dialog-body"><section className="archive-receiver" aria-label="Daimi DICOM arxivi">
    <div className="receiver-summary"><Database size={18}/><strong>{status?.running ? 'DICOM qəbul aktivdir' : status ? 'DICOM qəbul dayandırılıb' : 'Disk arxivi bağlı deyil'}</strong>
      {status && <span>AE: <b>{status.aeTitle}</b> · IP: <b>{status.addresses.join(', ') || '127.0.0.1'}</b> · Port: <b>{status.port}</b> · {status.instanceCount} fayl</span>}
    </div>
    <div className="receiver-settings">
      <p>Rentgen, KT və ya PACS cihazında bu kompüteri DICOM göndərmə ünvanı kimi əlavə edin. C-ECHO ilə bağlantını yoxlayın, sonra C-STORE ilə göndərin. Müayinələr siyahıda avtomatik görünür.</p>
      <div className="receiver-fields"><label>AE Title<input aria-label="Lokal arxiv AE Title" value={aeTitle} maxLength={16} onChange={event => setAeTitle(event.target.value)}/></label><label>DICOM port<input aria-label="Lokal arxiv DICOM port" type="number" min="1024" max="65535" value={port} onChange={event => setPort(event.target.value)}/></label>
        <button disabled={busy || !status} onClick={() => void save(true)}>{busy ? 'Saxlanılır…' : 'Saxla və qəbulu başlat'}</button>
        <button disabled={busy || !status?.running} onClick={() => void save(false)}>Qəbulu dayandır</button>
      </div>
      {status && <><p>Baza: <code>{status.databasePath}</code><br/>DICOM faylları: <code>{status.storagePath}</code></p>
        <p>Telefon / planşet: {status.addresses.map(address => <a key={address} href={`http://${address}:5173/`} target="_blank" rel="noreferrer">http://{address}:5173/ </a>)} · Eyni lokal şəbəkəyə qoşulun.</p>
        <p>Windows Firewall üçün yalnız etibarlı lokal şəbəkədə TCP {status.port} (DICOM) və 5173 (viewer) portlarına icazə verilməlidir. Bazanı və instances qovluğunu birlikdə ehtiyat nüsxələyin.</p></>}
    </div>
    {(error || status?.error) && <p className="receiver-error" role="status">{error || status?.error}</p>}
  </section></div><footer><button type="button" onClick={()=>setOpen(false)}>Bağla</button></footer></dialog>,document.body)}</>;
}
