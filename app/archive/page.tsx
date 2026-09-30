'use client';
import { openStudyInViewer } from '@/lib/viewer-session';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, FolderOpen, FileArchive, Search, Trash2, ExternalLink, HardDriveDownload, RefreshCw, Settings2, Disc3 } from 'lucide-react';
import { deleteArchiveStudy, getArchiveFiles, listArchiveStudies, recordStudyOpened, saveArchiveFiles, type ArchiveStudy } from '@/lib/local-archive';
import { expandSources, filesFromDrop } from '@/lib/import-sources';
import { ArchiveReceiverPanel } from '@/components/archive-receiver-panel';
import { saveDiskFiles } from '@/lib/disk-archive';
import { StudyFilterControls } from '@/components/study-filter-controls';

const date = (raw: string) => raw?.length === 8 ? `${raw.slice(6,8)}.${raw.slice(4,6)}.${raw.slice(0,4)}` : '—';
const clock = (value: number | null) => value ? new Date(value).toLocaleString('az-AZ') : '—';
const size = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
const modalityOptions = ['CR','DX','CT','MR','XA','MG','US','PT','NM','RF','RG','PX','ES','XC','GM','SC','OT','SR'];

export default function ArchivePage() {
  const [studies, setStudies] = useState<ArchiveStudy[]>([]);
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modalities, setModalities] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Arxiv hazırlanır…');
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const entries = await listArchiveStudies();
    setStudies(entries);
    setSelected(current => entries.some(item => item.uid === current) ? current : entries[0]?.uid || '');
    return entries;
  }, []);
  useEffect(() => {
    document.title = 'RADAZ · Local arxiv';
    folderRef.current?.setAttribute('webkitdirectory', '');
    folderRef.current?.setAttribute('directory', '');
    void refresh().then(entries => setMessage(`${entries.length} müayinə arxivdədir`)).catch(error => setMessage(`Arxiv açıla bilmədi: ${String(error)}`));
    const timer = setInterval(() => { void refresh().catch(() => undefined); }, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const addFiles = async (sources: File[]) => {
    if (!sources.length || busy) return;
    setBusy(true);
    try {
      const files = await expandSources(sources, setMessage);
      setMessage(`${files.length} fayl arxivlənir…`);
      const added = await saveArchiveFiles(files, (done, total) => setMessage(`Arxivlənir: ${done} / ${total}`));
      const entries = await refresh();
      setMessage(added ? `${added} müayinə saxlanıldı · ${entries.length} müayinə arxivdədir` : 'Uyğun DICOM faylı tapılmadı');
    } catch (error) { setMessage(`İdxal alınmadı: ${error instanceof Error ? error.message : String(error)}`); }
    finally { setBusy(false); }
  };

  const filtered = useMemo(() => studies.filter(study => {
    const key = `${study.patient} ${study.patientId} ${study.date} ${date(study.date)} ${study.modality} ${study.description} ${study.accession}`.toLocaleLowerCase('az');
    const rawFrom = dateFrom.replaceAll('-', ''), rawTo = dateTo.replaceAll('-', '');
    const studyModalities = study.modality.toUpperCase().split(/[\\,\s]+/).filter(Boolean);
    return key.includes(search.toLocaleLowerCase('az').trim()) && (!rawFrom || study.date >= rawFrom) && (!rawTo || study.date <= rawTo)
      && (!modalities.length || modalities.some(item => studyModalities.includes(item)));
  }), [studies, search, dateFrom, dateTo, modalities]);
  const current = studies.find(item => item.uid === selected);
  const openStudy = async (uid: string) => {
    try {
      const destination = await openStudyInViewer(uid);
      await recordStudyOpened(uid);
      await refresh();
      setMessage(destination === 'existing' ? 'Müayinə açıq viewer-ə ötürüldü' : 'Viewer açıldı');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };
  const remove = async () => {
    if (!current || !window.confirm(`“${current.patient}” müayinəsinin ${current.imageCount} görüntüsü bu brauzerin arxivindən silinsin?`)) return;
    try { await deleteArchiveStudy(current.uid); await refresh(); setMessage('Müayinə local arxivdən silindi'); }
    catch (error) { setMessage(`Silmək alınmadı: ${String(error)}`); }
  };

  return <main className="archive-shell grouped-records" onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }} onDrop={event => { event.preventDefault(); void filesFromDrop(event.dataTransfer.items, event.dataTransfer.files).then(addFiles).catch(error => setMessage(String(error))); }}>
    <header className="records-header records-unified-header archive-unified-header">
      <div className="records-summary records-filterbar records-header-filters"><span className="status-led"/><span className="records-count">{filtered.length}/{studies.length} müayinə</span><StudyFilterControls from={dateFrom} to={dateTo} modalities={modalities} options={modalityOptions} onFromChange={setDateFrom} onToChange={setDateTo} onModalitiesChange={setModalities}/><label className="records-search"><Search size={16}/><input aria-label="Bütün müayinələrdə axtar" placeholder="Pasiyent, ID, təsvir…" value={search} onChange={event => setSearch(event.currentTarget.value)}/></label></div>
      <div className="records-header-actions labeled-header-actions">
        <div className="record-action-group"><div className="toolbar-group" role="group" aria-label="DICOM import">        <button title="DICOM qovluğu əlavə et" aria-label="DICOM qovluğu əlavə et" disabled={busy} onClick={() => folderRef.current?.click()}><FolderOpen size={18}/><span>Qovluq</span></button>        <button title="ZIP arxivi əlavə et" aria-label="ZIP arxivi əlavə et" disabled={busy} onClick={() => zipRef.current?.click()}><FileArchive size={18}/><span>ZIP</span></button>        <button title="DICOM faylları əlavə et" aria-label="DICOM faylları əlavə et" disabled={busy} onClick={() => filesRef.current?.click()}><HardDriveDownload size={18}/><span>DICOM</span></button></div></div>
        <div className="record-action-group"><div className="toolbar-group" role="group" aria-label="Müayinə">        <button title="Siyahını yenilə" aria-label="Siyahını yenilə" onClick={() => { void refresh(); }}><RefreshCw size={18}/><span>Yenilə</span></button>        <button title="Seçilmiş müayinəni CD üçün hazırla" aria-label="CD üçün hazırla" disabled={!current || busy} onClick={() => current && window.open(`/media?study=${encodeURIComponent(current.uid)}`, '_blank')}><Disc3 size={18}/><span>CD / DVD</span></button>                <button title="Seçilmiş müayinəni sil" aria-label="Seçilmiş müayinəni sil" disabled={!current || busy || current.storage === 'disk'} onClick={() => { void remove(); }}><Trash2 size={18}/><span>Sil</span></button></div></div>
      </div>
      <input hidden ref={folderRef} type="file" multiple onChange={event => { const files=Array.from(event.currentTarget.files||[]); event.currentTarget.value=''; void addFiles(files); }}/>
      <input hidden ref={zipRef} type="file" multiple accept=".zip,application/zip" onChange={event => { const files=Array.from(event.currentTarget.files||[]); event.currentTarget.value=''; void addFiles(files); }}/>
      <input hidden ref={filesRef} type="file" multiple onChange={event => { const files=Array.from(event.currentTarget.files||[]); event.currentTarget.value=''; void addFiles(files); }}/>
    </header>
    <ArchiveReceiverPanel/>
    <div className="records-upper">
      <table className="records-table" aria-label="Arxiv müayinələri"><thead><tr><th>Aç</th><th>Müayinə tarixi</th><th>Pasiyent</th><th>Doğum tarixi</th><th>Pasiyent ID</th><th>Müayinə</th><th>Təsvir</th><th>Accession</th><th>Seriya</th><th>Görüntü</th><th>Göndərən həkim</th></tr></thead><tbody>
        {filtered.map(study => <tr key={study.uid} className={selected === study.uid ? 'selected' : ''} onClick={() => setSelected(study.uid)} onDoubleClick={() => { void openStudy(study.uid); }} title="İki dəfə klikləyib viewer-də açın"><td><button className="record-open-button" aria-label="Müayinəni viewer-də aç" onClick={event => { event.stopPropagation(); setSelected(study.uid); void openStudy(study.uid); }}><ExternalLink size={16}/></button></td><td>{date(study.date)} {study.time && `${study.time.slice(0,2)}:${study.time.slice(2,4)}`}</td><td>{study.patient}<small className="archive-storage-label">{study.storage === 'disk' ? 'Disk / SQLite' : 'Brauzer'}</small></td><td>{date(study.birth)}</td><td title={study.patientId}>{study.patientId || '—'}</td><td>{study.modality}</td><td title={study.description}>{study.description || '—'}</td><td>{study.accession || '—'}</td><td>{study.series.length}</td><td>{study.imageCount}</td><td>{study.referring || '—'}</td></tr>)}
      </tbody></table>
      {!filtered.length && <div className="records-empty">{studies.length ? 'Seçilmiş tarix və müayinə filtrlərinə uyğun nəticə tapılmadı' : 'Arxiv boşdur. Qovluq, ZIP və ya DICOM faylları əlavə edin.'}</div>}
    </div>
    <div className="records-lower"><div className="records-section-title"><strong>Seriyalar</strong><span>{current?.patient || 'Müayinə seçin'}</span><div className="records-section-actions"><button disabled={!current || busy || current.storage === 'disk'} onClick={() => {
        if (!current) return; setBusy(true);
        void getArchiveFiles(current.uid).then(files => saveDiskFiles(files)).then(refresh).then(() => setMessage('Müayinə daimi disk arxivinə köçürüldü')).catch(error => setMessage(String(error))).finally(() => setBusy(false));
      }}><HardDriveDownload size={15}/> Diskə saxla</button><button disabled={!current} onClick={() => current && void openStudy(current.uid)}><ExternalLink size={15}/> Viewer</button></div></div>
      <div className="records-series-scroll"><table className="records-table" aria-label="Seçilmiş müayinənin seriyaları"><thead><tr><th>Aç</th><th>#</th><th>Əlavə olunub</th><th>Seriya nömrəsi</th><th>Modallıq</th><th>Təsvir</th><th>Protokol</th><th>Görüntü sayı</th><th>Son açılma</th></tr></thead><tbody>{current?.series.map((series,index) => <tr key={series.uid} onDoubleClick={() => void openStudy(current.uid)}><td><button className="record-open-button" aria-label={`${series.description || 'Seriya'} viewer-də aç`} onClick={() => void openStudy(current.uid)}><ExternalLink size={16}/></button></td><td>{index+1}</td><td>{clock(series.addedAt)}</td><td>{series.number}</td><td>{series.modality}</td><td>{series.description}</td><td>{series.protocol || '—'}</td><td>{series.imageCount}</td><td>{clock(current.openedAt)}</td></tr>)}</tbody></table></div>
    </div>
    <footer className="records-status" role="status">{busy && <span className="records-spinner"/>}{message}</footer>
  </main>;
}
