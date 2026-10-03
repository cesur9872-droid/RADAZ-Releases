'use client';
import { ResizableTable, ResizableHeader } from '@/components/resizable-table';
import { SortHeader, useTableSort } from '@/components/table-sort';
import { openStudyInViewer, openStudiesInViewer, focusViewer, notifyViewerProgress } from '@/lib/viewer-session';

import { useEffect, useRef, useState } from 'react';
import { Activity, ExternalLink, Network, Plus, Search, Settings2, Trash2, Wifi, Download, Database, RefreshCw, X, Disc3 } from 'lucide-react';
import { queryRemoteSeries, queryRemoteStudies, retrieveRemoteStudy, type RemoteSeries, type RemoteStudy } from '@/lib/dicomweb';
import { echoDimse, getDimseBridgeVersion, queryDimseSeries, queryDimseStudies, retrieveDimseStudy } from '@/lib/pacs-bridge';
import { preparePacsTransferTab } from '@/lib/pacs-transfer-tab';
import { deleteLocalStudies, listArchiveStudies, recordStudyOpened, saveArchiveFiles } from '@/lib/local-archive';
import { AppHelpMenu } from '@/components/app-product';
import { useStudySelection } from '@/components/study-selection';
import { StudyFilterControls, localDate } from '@/components/study-filter-controls';

type PacsLocation = { id: string; host: string; port: string; aeTitle: string; description: string; dicomwebUrl: string };
const blank = (): PacsLocation => ({ id: '', host: '', port: '11112', aeTitle: '', description: '', dicomwebUrl: '' });
const date = (raw: string) => raw.length === 8 ? `${raw.slice(6,8)}.${raw.slice(4,6)}.${raw.slice(0,4)}` : '—';
const validAeTitle = (title: string) => /^[\x20-\x7E]{1,16}$/.test(title) && !title.includes('\\');
const modalityOptions = ['CR','DX','CT','MR','XA','MG','US','PT','NM','RF','RG','PX','ES','XC','GM','SC','OT','SR'];

export default function PacsPage() {
  const [locations, setLocations] = useState<PacsLocation[]>([]);
  const [selected, setSelected] = useState('');
  const [editor, setEditor] = useState<PacsLocation>(blank);
  const [aeTitle, setAeTitle] = useState('RADAZ');
  const [listenerPort, setListenerPort] = useState('11112');
  const [draftAeTitle, setDraftAeTitle] = useState('RADAZ');
  const [draftListenerPort, setDraftListenerPort] = useState('11112');
  const [configOpen, setConfigOpen] = useState(false);
  const [configStatus, setConfigStatus] = useState('');
  const modalRef = useRef<HTMLDialogElement>(null);
  const [token, setToken] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('PACS konfiqurasiyasını yükləyin');
  const [busy, setBusy] = useState(false);
  const studyQuery = useRef(0), openingStudy = useRef(false);
  const [patient, setPatient] = useState('');
  const [dateFrom, setDateFrom] = useState(localDate);
  const [dateTo, setDateTo] = useState(localDate);
  const [modalities, setModalities] = useState<string[]>([]);
  const [studies, setStudies] = useState<RemoteStudy[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [dimseReady, setDimseReady] = useState('');
  const [bridgeVersion, setBridgeVersion] = useState<number | null>(null);
  const [study, setStudy] = useState('');
  const [series, setSeries] = useState<RemoteSeries[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const location = locations.find(item => item.id === selected);
  const visibleStudies = studies.filter(item => (!dateFrom || item.date >= dateFrom.replaceAll('-', '')) && (!dateTo || item.date <= dateTo.replaceAll('-', '')) && (!modalities.length || modalities.some(modality => item.modality.split(/[\\/,\s]+/).includes(modality))));
  const selection = useStudySelection(visibleStudies.map(item => item.uid));
  const activeStudy = visibleStudies.find(item => item.uid === study);
  const studySort=useTableSort(visibleStudies,{date:r=>r.date,patient:r=>r.patient,patientId:r=>r.patientId,modality:r=>r.modality,description:r=>r.description,seriesCount:r=>r.seriesCount,instanceCount:r=>r.instanceCount},{key:'date',direction:'desc'});
  const seriesSort=useTableSort(series,{number:r=>r.number,modality:r=>r.modality,description:r=>r.description,instanceCount:r=>r.instanceCount},{key:'number',direction:'asc'});
  const nodeSort=useTableSort(locations,{host:r=>r.host,port:r=>Number(r.port),aeTitle:r=>r.aeTitle,description:r=>r.description,dicomwebUrl:r=>r.dicomwebUrl},{key:'description',direction:'asc'});
  const canSearch = !!location && (!!location.dicomwebUrl || !!(location.host && location.aeTitle));

  useEffect(() => {
    document.title = 'RADAZ · PACS müayinələri';
    try {
      const saved = JSON.parse(localStorage.getItem('radaz-pacs-config-v1') || '{}');
      if (Array.isArray(saved.locations)) {
        const valid = saved.locations.filter((item: PacsLocation) => item && typeof item.id === 'string' && typeof item.dicomwebUrl === 'string');
        setLocations(valid); setSelected(valid.some((item: PacsLocation) => item.id === saved.selected) ? saved.selected : valid[0]?.id || '');
      }
      if (typeof saved.aeTitle === 'string') setAeTitle(saved.aeTitle);
      if (typeof saved.listenerPort === 'string') setListenerPort(saved.listenerPort);
      setStatus('Konfiqurasiya bu brauzerdə saxlanılır');
    } catch { setStatus('Saxlanılmış PACS konfiqurasiyası oxunmadı'); }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem('radaz-pacs-config-v1', JSON.stringify({ locations, selected, aeTitle, listenerPort }));
  }, [loaded, locations, selected, aeTitle, listenerPort]);
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    if (configOpen && !modal.open) modal.showModal();
    if (!configOpen && modal.open) modal.close();
  }, [configOpen]);

  const openConfig = () => {
    setDraftAeTitle(aeTitle); setDraftListenerPort(listenerPort);
    setEditor(location || blank()); setConfigStatus(''); setConfigOpen(true);
  };
  const choose = (item: PacsLocation) => {
    selection.clear();
    setSelected(item.id); setEditor(item); setStudies([]); setSeries([]); setStudy(''); setHasSearched(false); setSearchError(''); setDimseReady(''); setBridgeVersion(null);
  };
  const save = () => {
    const next = { ...editor, host: editor.host.trim(), port: editor.port.trim(),
      aeTitle: editor.aeTitle.trim().toUpperCase(), description: editor.description.trim(), dicomwebUrl: editor.dicomwebUrl.trim().replace(/\/$/, '') };
    if (!next.host && !next.aeTitle && !next.description && !next.dicomwebUrl) { setConfigStatus('PACS üçün IP/host, AE title və ya təsvir daxil edin'); return false; }
    if (!/^[1-9]\d{0,4}$/.test(next.port) || Number(next.port) > 65535) { setConfigStatus('PACS portu 1–65535 arası olmalıdır'); return false; }
    if (next.aeTitle && !validAeTitle(next.aeTitle)) { setConfigStatus('AE Title 1–16 ASCII simvol olmalıdır'); return false; }
    if (next.dicomwebUrl) {
      try {
        const url = new URL(next.dicomwebUrl);
        if (url.protocol !== 'https:' && !(window.location.protocol === 'http:' && url.protocol === 'http:'))
          throw new Error('DICOMweb üçün HTTPS ünvanı daxil edin');
        if (url.username || url.password) throw new Error('Şifrəni URL-də yazmayın; Bearer token sahəsindən istifadə edin');
      } catch (error) { setConfigStatus(error instanceof Error && error.message !== 'Invalid URL' ? error.message : 'DICOMweb URL düzgün deyil'); return false; }
    }
    next.id ||= Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    setLocations(current => current.some(item => item.id === next.id) ? current.map(item => item.id === next.id ? next : item) : [...current, next]);
    setSelected(next.id); setEditor(next); setStudies([]); setSeries([]); setStudy(''); setChecked([]); setHasSearched(false); setSearchError(''); setDimseReady(''); setBridgeVersion(null);
    setConfigStatus('PACS ünvanı yadda saxlanıldı'); setStatus('PACS ünvanı yadda saxlanıldı');
    return true;
  };
  const saveConfig = () => {
    const nextAe = draftAeTitle.trim().toUpperCase(), nextPort = draftListenerPort.trim();
    if (!validAeTitle(nextAe)) { setConfigStatus('Mənim AE Title 1–16 ASCII simvol olmalıdır'); return; }
    if (!/^[1-9]\d{0,4}$/.test(nextPort) || Number(nextPort) > 65535) { setConfigStatus('Listener port 1–65535 arası olmalıdır'); return; }
    const existing = locations.find(item => item.id === editor.id);
    const addressEdited = existing
      ? editor.host !== existing.host || editor.port !== existing.port || editor.aeTitle !== existing.aeTitle || editor.description !== existing.description || editor.dicomwebUrl !== existing.dicomwebUrl
      : editor.host.trim() || editor.aeTitle.trim() || editor.description.trim() || editor.dicomwebUrl.trim() || editor.port !== blank().port;
    if (addressEdited && !save()) return;
    setAeTitle(nextAe); setListenerPort(nextPort);
    setStatus('PACS konfiqurasiyası bu brauzerdə yadda saxlanıldı');
    setConfigOpen(false);
  };
  const remove = () => {
    const target = locations.find(item => item.id === editor.id);
    if (!target || !window.confirm(`“${target.description || target.host || target.dicomwebUrl}” PACS ünvanı silinsin?`)) return;
    setLocations(current => current.filter(item => item.id !== target.id));
    if (selected === target.id) { setSelected(''); setStudies([]); setSeries([]); setStudy(''); setHasSearched(false); setSearchError(''); setDimseReady(''); setBridgeVersion(null); }
    setEditor(blank()); setConfigStatus('PACS ünvanı silindi'); setStatus('PACS ünvanı silindi');
  };
  const test = async (target = location, caller = aeTitle) => {
    if (!target || (!target.dicomwebUrl && (!target.host || !target.aeTitle))) { setStatus('PACS IP, port və AE Title daxil edin'); setConfigStatus('PACS IP, port və AE Title daxil edin'); return; }
    setBusy(true); setStatus(target.dicomwebUrl ? 'DICOMweb QIDO-RS əlaqəsi yoxlanır…' : 'PACS C-ECHO əlaqəsi yoxlanır…'); setConfigStatus('PACS əlaqəsi yoxlanır…');
    try {
      let message = 'PACS C-ECHO əlaqəsi işləyir';
      if (target.dicomwebUrl) {
        const results = await queryRemoteStudies(target.dicomwebUrl, token);
        setStudies(results);
        message = `DICOMweb əlaqəsi işləyir · ${results.length} müayinə qaytarıldı`;
      } else {
        await echoDimse(target, caller);
        setBridgeVersion(await getDimseBridgeVersion());
        setDimseReady(target.id);
      }
      setStatus(message); setConfigStatus(message);
    }
    catch (error) { const message = error instanceof Error ? error.message : String(error); setDimseReady(''); setStatus(message); setConfigStatus(message); }
    finally { setBusy(false); }
  };
  const search = async () => {
    if (!location || !canSearch) { setStatus('PACS serverinin IP, port və AE Title məlumatlarını tamamlayın'); return; }
    setBusy(true); setStatus('PACS müayinələri axtarılır…'); setSearchError('');
    selection.clear();
    setStudies([]); setStudy(''); setSeries([]); setChecked([]); setHasSearched(false);
    try {
      const response = location.dicomwebUrl
        ? { items: await queryRemoteStudies(location.dicomwebUrl, token, patient, dateFrom, dateTo, modalities), truncated: false }
        : await queryDimseStudies(location, aeTitle, patient, dateFrom && dateFrom === dateTo ? dateFrom : '');
      if (!location.dicomwebUrl) {
        setDimseReady(location.id);
        setBridgeVersion(await getDimseBridgeVersion().catch(() => 0));
      }
      const fromRaw = dateFrom.replaceAll('-', ''), toRaw = dateTo.replaceAll('-', '');
      const filtered = response.items.filter(item => {
        const itemModalities = item.modality.toUpperCase().split(/[\\,\s]+/).filter(Boolean);
        return (!fromRaw || item.date >= fromRaw) && (!toRaw || item.date <= toRaw)
          && (!modalities.length || modalities.some(modality => itemModalities.includes(modality)));
      });
      setStudies(filtered); setHasSearched(true);
      setStatus(`${filtered.length} müayinə tapıldı${response.truncated ? ' · ilk 200 nəticə, filtri dəqiqləşdirin' : ''}`);
    }
    catch (error) { const message = error instanceof Error ? error.message : String(error); if (!location.dicomwebUrl) setDimseReady(''); setStatus(message); setSearchError(message); }
    finally { setBusy(false); }
  };
  const chooseStudy = async (item: RemoteStudy, open = false) => {
    if(open&&selection.checked.length){await openSelectedStudies(true);return;}
    if (openingStudy.current || (busy && !open)) return;
    const query = ++studyQuery.current;
    if (open) openingStudy.current = true;
    const reservedViewer = open ? focusViewer() : undefined;
    setStudy(item.uid); setSeries([]); setChecked([]); setBusy(true); setStatus('PACS seriyaları oxunur…');
    try {
      const response = location!.dicomwebUrl
        ? { items: await queryRemoteSeries(location!.dicomwebUrl, token, item.uid), truncated: false }
        : await queryDimseSeries(location!, aeTitle, item.uid);
      if (query !== studyQuery.current) return;
      setSeries(response.items); setChecked(response.items.map(series => series.uid));
      setStatus(`${response.items.length} seriya tapıldı${response.truncated ? ' · ilk 200 seriya' : ''}`);
      if (open) await retrieve('viewer', undefined, item, response.items, reservedViewer);
    }
    catch (error) { if (query === studyQuery.current) setStatus(error instanceof Error ? error.message : String(error)); }
    finally { if (query === studyQuery.current) setBusy(false); if (open) openingStudy.current = false; }
  };
  const retrieve = async (destination: 'viewer' | 'media' = 'viewer', onlySeries?: string, selectedStudy = activeStudy, selectedSeries?: RemoteSeries[], reservedViewer?: Window | null) => {
    if(destination==='viewer'&&!onlySeries&&!selectedSeries&&selection.checked.length){await openSelectedStudies();return;}
    if ((busy && !selectedSeries) || !location || !selectedStudy || (!selectedSeries && !onlySeries && !checked.length)) return;
    // Open synchronously so browsers allow the private viewer tab after a long download.
    const viewer = destination === 'viewer' ? (reservedViewer === undefined ? focusViewer() : reservedViewer) : window.open('about:blank', '_blank');
    const updateTab = preparePacsTransferTab(destination === 'media' ? viewer : null);
    const report = (message: string) => { setStatus(message); updateTab(message); };
    notifyViewerProgress(destination === 'viewer' ? viewer : null, {label:'PACS yüklənir',done:0,total:0});
    const progress = (done:number,total:number,label='PACS yüklənir') => { report(`${label}: ${done} / ${total}`); if(destination === 'viewer')notifyViewerProgress(viewer,{label,done,total}); };
    setBusy(true);
    try {
      if (!location.dicomwebUrl) {
        const version = await getDimseBridgeVersion();
        setBridgeVersion(version);
        if (version < 3) throw new Error('Görüntü endirmək üçün köhnə RADAZ PACS körpüsünü bağlayın, yeni v4 ZIP-ni endirib başladın. Köhnə körpü axtarış aparır, amma görüntü göndərə bilmir.');
      }
      const chosen = selectedSeries || series.filter(item => onlySeries ? item.uid === onlySeries : checked.includes(item.uid));
      if (!chosen.length) throw new Error('Müayinədə açılacaq seriya tapılmadı');
      if (!location.dicomwebUrl && chosen.length > 30) throw new Error('Bir köçürmədə ən çox 30 seriya seçin.');
      const expected = chosen.reduce((total, item) => total + item.instanceCount, 0);
      if (!location.dicomwebUrl && expected > 800) throw new Error(`Seçilmiş seriyalarda ${expected} görüntü var. Bir köçürmədə ən çox 800 görüntü mümkündür; daha az seriya seçin.`);
      report(`${chosen.length} seriya endirilir… PACS cavabı gözlənilir.`);
      const files = location.dicomwebUrl
        ? await retrieveRemoteStudy(location.dicomwebUrl, token, selectedStudy.uid, chosen,
          (done, total) => progress(done,total))
        : await retrieveDimseStudy(location, aeTitle, listenerPort, selectedStudy.uid, chosen.map(item => item.uid),
          (done, total) => progress(done,total));
      const imported = await saveArchiveFiles(files, (done, total) => progress(done,total,'PACS arxivə yazılır'));
      if (!imported) throw new Error('PACS fayllarında oxuna bilən DICOM görüntüsü tapılmadı');
      await recordStudyOpened(selectedStudy.uid);
      const target = destination === 'media' ? `/media?study=${encodeURIComponent(selectedStudy.uid)}` : `/#archive-study=${encodeURIComponent(selectedStudy.uid)}`;
      if (destination === 'viewer') await openStudyInViewer(selectedStudy.uid, viewer);
      else if (viewer) viewer.location.href = target;
      setStatus(`${files.length} görüntü local arxivə saxlanıldı${viewer || destination === 'viewer' ? ' və seçilmiş modul açıldı' : '. Arxiv vərəqəsindən açın'}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateTab(message, true); if(destination === 'viewer')notifyViewerProgress(viewer,null,message);
      if (message.includes('yeni versiyasını') || message.includes('yeni v3')) setBridgeVersion(0);
      setStatus(`PACS idxalı alınmadı: ${message}`);
    }
    finally { setBusy(false); }
  };

  const openSelectedStudies = async (fromRow = false) => {
    if((busy&&!fromRow)||openingStudy.current||!location||!selection.checked.length)return;
    ++studyQuery.current; // Supersede the single-click series query on double-click.
    const targets=visibleStudies.filter(item=>selection.checked.includes(item.uid));
    const viewer=focusViewer();if(!viewer){setStatus('Viewer açıla bilmədi. Pop-up icazəsini yoxlayın.');return;}
    setBusy(true);openingStudy.current=true;
    try{
      if(!location.dicomwebUrl&&await getDimseBridgeVersion()<3)throw Error('PACS körpüsünü yeni versiyaya yeniləyin');
      for(const [index,item] of targets.entries()){
        const label=`PACS ${index+1}/${targets.length}`;
        const progress=(done:number,total:number)=>{setStatus(`${label}: ${done}/${total}`);notifyViewerProgress(viewer,{label,done,total});};
        progress(0,0);
        const entries=location.dicomwebUrl?await queryRemoteSeries(location.dicomwebUrl,token,item.uid):(await queryDimseSeries(location,aeTitle,item.uid)).items;
        if(!entries.length)throw Error(`${index+1}-ci müayinədə seriya tapılmadı`);
        if(!location.dicomwebUrl&&(entries.length>30||entries.reduce((n,s)=>n+s.instanceCount,0)>800))throw Error('Müayinə böyükdür. Seriyaları ayrıca seçib açın.');
        const files=location.dicomwebUrl?await retrieveRemoteStudy(location.dicomwebUrl,token,item.uid,entries,progress):
          await retrieveDimseStudy(location,aeTitle,listenerPort,item.uid,entries.map(s=>s.uid),progress);
        if(!await saveArchiveFiles(files,progress))throw Error(`${index+1}-ci müayinədə oxuna bilən DICOM tapılmadı`);
        await recordStudyOpened(item.uid);
      }
      await openStudiesInViewer(targets.map(item=>item.uid),viewer);
      setStatus(`${targets.length} seçilmiş müayinə Viewer-də açıldı`);
    }catch(error){const message=error instanceof Error?error.message:String(error);setStatus(message);notifyViewerProgress(viewer,null,message);}
    finally{setBusy(false);openingStudy.current=false;}
  };

  const removeCopies = async () => {
    const ids = selection.checked.length ? selection.checked : activeStudy ? [activeStudy.uid] : [];
    if (busy || !ids.length) return;
    setBusy(true);
    try {
      const copies = (await listArchiveStudies(true)).filter(item => ids.includes(item.uid));
      if (!copies.length) { setStatus('Seçilmiş müayinələrin bu kompüterdə endirilmiş nüsxəsi yoxdur'); return; }
      if (!window.confirm(`${copies.length} müayinənin bu kompüterdəki nüsxələri birdəfəlik silinsin? PACS serverindəki orijinallar saxlanılır.`)) return;
      setStatus(await deleteLocalStudies(copies)); selection.clear();
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };

  return <main className="pacs-shell grouped-records">
    <header className="records-header records-unified-header pacs-unified-header">
      <div className="pacs-query records-header-filters">
        <label className="pacs-server">PACS serveri <select aria-label="PACS serveri" value={location?.id || ''} onChange={event => { const target = locations.find(item => item.id === event.currentTarget.value); if (target) choose(target); }}><option value="">{locations.length ? 'Server seçin' : 'Konfiqurasiya əlavə edin'}</option>{locations.map(item => <option key={item.id} value={item.id}>{item.description || item.host || item.aeTitle || item.dicomwebUrl}</option>)}</select></label>
        <label className="pacs-patient">Pasiyent adı <input aria-label="PACS pasiyent axtarışı" placeholder="Ad və ya soyad" value={patient} onChange={event => setPatient(event.currentTarget.value)}/></label>
        <StudyFilterControls from={dateFrom} to={dateTo} modalities={modalities} options={modalityOptions} onFromChange={setDateFrom} onToChange={setDateTo} onModalitiesChange={setModalities}/>
        <button className="records-primary pacs-search-button" disabled={busy || !canSearch} onClick={() => { void search(); }}><Search size={16}/> Axtar</button>
        <button className="pacs-check-button" title="Əlaqəni yoxla" aria-label="PACS əlaqəsini yoxla" disabled={busy || !canSearch} onClick={() => { void test(); }}><RefreshCw size={16}/></button>
        <label className="pacs-token">Bearer token <input aria-label="PACS Bearer token" type="password" autoComplete="off" placeholder={location?.dicomwebUrl ? 'Yalnız bu vərəqədə istifadə edilir' : 'Yalnız DICOMweb üçün'} disabled={!location?.dicomwebUrl} value={token} onChange={event => setToken(event.currentTarget.value)}/></label>
      </div>
      <div className="records-header-actions"><button disabled={busy || !selection.checked.length} onClick={() => void openSelectedStudies()}><ExternalLink size={18}/><span>Seçilmişləri aç ({selection.checked.length})</span></button><button disabled={busy || (!selection.checked.length && !activeStudy)} onClick={() => void removeCopies()} title="Bu kompüterə endirilmiş nüsxələri sil"><Trash2 size={16}/><span>Lokal nüsxələri sil{selection.checked.length ? ` (${selection.checked.length})` : ''}</span></button><button type="button" title="PACS konfiqurasiyası" onClick={openConfig} aria-label="PACS konfiqurasiyasını aç"><Settings2 size={18}/><span>PACS ayarları</span></button><AppHelpMenu/></div>
    </header>
    <div className="pacs-content">
      <div className="pacs-browser"><div className="pacs-card-title"><Network size={19}/><div><strong>PACS müayinələri</strong><span>{location ? `${location.description || location.host || location.aeTitle || location.dicomwebUrl} · ${location.dicomwebUrl ? 'DICOMweb' : 'DICOM C-FIND'}` : 'Server seçin'}</span></div></div>
        {location && !location.dicomwebUrl && dimseReady !== location.id && <div className="pacs-connect-note">IP/port əlaqəsi üçün bu kompüterdə <a href="/radaz-pacs-bridge-v4.zip" download>RADAZ PACS körpüsünü endirin</a>, ZIP-i açıb <strong>start-radaz-pacs.cmd</strong> faylını başladın. Köhnə körpü işləyirsə bağlayıb yeni versiyanı açın. Chrome soruşsa, lokal şəbəkəyə icazə verin.</div>}
        {location && !location.dicomwebUrl && dimseReady === location.id && bridgeVersion !== null && bridgeVersion < 3 && <div className="pacs-connect-note">Axtarış işləyir, amma bu körpü görüntü endirmir. Köhnə körpünü bağlayın, <a href="/radaz-pacs-bridge-v4.zip" download>yeni v4 ZIP-ni endirin</a> və <strong>start-radaz-pacs.cmd</strong> faylını başladın.</div>}
        <div className="pacs-results"><ResizableTable storageKey="pacs-studies" className="records-table" aria-label="PACS müayinələri"><thead><tr><ResizableHeader column="select" label="Seç" minimum={24} className="study-check-column">{selection.all}</ResizableHeader><ResizableHeader column="open" label="Aç" className="study-open-column">Aç</ResizableHeader><SortHeader column="date" label="Tarix" {...studySort}/><SortHeader column="patient" label="Pasiyent" {...studySort}/><SortHeader column="patientId" label="Pasiyent ID" {...studySort}/><SortHeader column="modality" label="Modallıq" {...studySort}/><SortHeader column="description" label="Təsvir" {...studySort}/><SortHeader column="seriesCount" label="Seriya" {...studySort}/><SortHeader column="instanceCount" label="Görüntü" {...studySort}/></tr></thead><tbody>{studySort.rows.map(item => <tr key={item.uid} className={study === item.uid ? 'selected' : ''} onClick={() => { void chooseStudy(item); }} onDoubleClick={() => { void chooseStudy(item, true); }} title="İki dəfə klikləyib Viewer-də açın"><td onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}><input type="checkbox" aria-label={`${item.patient} müayinəsini seç`} checked={selection.checked.includes(item.uid)} onChange={event => selection.toggle(item.uid, event.currentTarget.checked)}/></td><td><button className="record-open-button" disabled={busy} aria-label={`${item.patient} müayinəsini viewer-də aç`} onClick={event => { event.stopPropagation(); void chooseStudy(item, true); }}><ExternalLink size={16}/></button></td><td>{date(item.date)}</td><td>{item.patient}</td><td>{item.patientId || '—'}</td><td>{item.modality}</td><td>{item.description || '—'}</td><td>{item.seriesCount}</td><td>{item.instanceCount}</td></tr>)}</tbody></ResizableTable>{!visibleStudies.length && <div className={`records-empty${searchError ? ' pacs-search-error' : ''}`} role={searchError ? 'alert' : undefined}>{searchError || (hasSearched ? 'Filtrə uyğun müayinə tapılmadı' : 'PACS ünvanını seçin və müayinə axtarın')}</div>}</div>
        <div className="pacs-series-title"><strong>{activeStudy ? `${activeStudy.patient} · seriyalar` : 'Seriyalar'}</strong><div className="pacs-series-actions"><button className="records-primary" disabled={busy || !activeStudy || !checked.length} onClick={() => { void retrieve('media'); }}><Disc3 size={16}/> CD / DVD</button><button className="records-primary" disabled={busy || !activeStudy || !checked.length} onClick={() => { void retrieve('viewer'); }}><Download size={16}/> Arxivə endir və aç</button></div></div>
        <div className="pacs-series-scroll"><ResizableTable storageKey="pacs-series" className="records-table" aria-label="PACS seriyaları"><thead><tr><ResizableHeader column="select" label="Seç" minimum={24}>Seç</ResizableHeader><ResizableHeader column="open" label="Aç">Aç</ResizableHeader><SortHeader column="number" label="#" {...seriesSort}/><SortHeader column="modality" label="Modallıq" {...seriesSort}/><SortHeader column="description" label="Təsvir" {...seriesSort}/><SortHeader column="instanceCount" label="Görüntü" {...seriesSort}/></tr></thead><tbody>{(activeStudy ? seriesSort.rows : []).map(item => <tr key={item.uid} onDoubleClick={() => void retrieve('viewer', item.uid)}><td><input type="checkbox" aria-label={`${item.description} seç`} checked={checked.includes(item.uid)} onChange={event => setChecked(current => event.currentTarget.checked ? [...current, item.uid] : current.filter(uid => uid !== item.uid))}/></td><td><button className="record-open-button" disabled={busy} aria-label={`${item.description || 'Seriya'} viewer-də aç`} onClick={() => void retrieve('viewer', item.uid)}><ExternalLink size={16}/></button></td><td>{item.number}</td><td>{item.modality}</td><td>{item.description}</td><td>{item.instanceCount}</td></tr>)}</tbody></ResizableTable></div>
      </div>
    </div>
    <dialog ref={modalRef} className="pacs-modal" aria-labelledby="pacs-modal-title" onCancel={() => setConfigOpen(false)} onClose={() => setConfigOpen(false)}>
      <div className="pacs-modal-inner">
        <div className="pacs-card-title"><Settings2 size={20}/><div><strong id="pacs-modal-title">PACS configuration</strong><span>Server ünvanları və əlaqə ayarları</span></div><button className="pacs-modal-close" type="button" aria-label="Konfiqurasiyanı bağla" onClick={() => setConfigOpen(false)}><X size={19}/></button></div>
        <div className="pacs-ae-row"><label>Mənim AE title <input aria-label="Mənim AE title" maxLength={16} value={draftAeTitle} onChange={event => setDraftAeTitle(event.currentTarget.value.toUpperCase())}/></label><label>Listener port <input aria-label="Listener port" type="number" min="1" max="65535" value={draftListenerPort} onChange={event => setDraftListenerPort(event.currentTarget.value)}/></label></div>
        {(!editor.id || dimseReady !== editor.id) && <p className="pacs-note">IP/port bağlantısı üçün <a href="/radaz-pacs-bridge-v4.zip" download>yerli PACS körpüsünü endirin</a> və başladın. Görüntü endirmədə əvvəl C-GET sınanır; PACS yalnız C-MOVE dəstəkləyirsə listener portu və çağıran AE PACS-də qeyd olunmalıdır.</p>}
        <div className="pacs-section-head"><strong>PACS ünvanları</strong><div><button type="button" aria-label="Yeni PACS ünvanı" onClick={() => { setEditor(blank()); setConfigStatus(''); }}><Plus size={17}/></button><button type="button" aria-label="Seçilmiş PACS ünvanını sil" disabled={!editor.id} onClick={remove}><Trash2 size={17}/></button><button type="button" aria-label="PACS əlaqəsini yoxla" disabled={!editor.id || busy} onClick={() => { void test(editor, draftAeTitle); }}><Wifi size={17}/></button></div></div>
        <div className="pacs-nodes-scroll"><ResizableTable storageKey="pacs-nodes" className="records-table" aria-label="PACS ünvanları"><thead><tr><SortHeader column="host" label="IP / host" {...nodeSort}/><SortHeader column="port" label="Port" {...nodeSort}/><SortHeader column="aeTitle" label="AE title" {...nodeSort}/><SortHeader column="description" label="Təsvir" {...nodeSort}/><SortHeader column="dicomwebUrl" label="DICOMweb URL" {...nodeSort}/></tr></thead><tbody>{nodeSort.rows.map(item => <tr key={item.id} className={editor.id === item.id ? 'selected' : ''} onClick={() => choose(item)}><td>{item.host || '—'}</td><td>{item.port}</td><td>{item.aeTitle || '—'}</td><td>{item.description || '—'}</td><td title={item.dicomwebUrl}>{item.dicomwebUrl || 'Əlavə olunmayıb'}</td></tr>)}</tbody></ResizableTable>{!locations.length && <div className="records-empty">PACS ünvanı əlavə edin</div>}</div>
        <div className="pacs-form-grid"><label>IP / host <input aria-label="PACS IP və ya host" placeholder="pacs.hospital.local" value={editor.host} onChange={event => setEditor({ ...editor, host: event.currentTarget.value })}/></label><label>Port <input aria-label="PACS portu" type="number" min="1" max="65535" value={editor.port} onChange={event => setEditor({ ...editor, port: event.currentTarget.value })}/></label><label>AE title <input aria-label="PACS AE title" maxLength={16} placeholder="PACS_AE" value={editor.aeTitle} onChange={event => setEditor({ ...editor, aeTitle: event.currentTarget.value })}/></label><label>Təsvir <input aria-label="PACS təsviri" placeholder="Mərkəzi PACS" value={editor.description} onChange={event => setEditor({ ...editor, description: event.currentTarget.value })}/></label><label className="pacs-url-field">DICOMweb HTTPS URL · istəyə bağlı <input aria-label="PACS DICOMweb URL" type="url" placeholder="https://pacs.example/dicom-web" value={editor.dicomwebUrl} onChange={event => setEditor({ ...editor, dicomwebUrl: event.currentTarget.value })}/></label><button type="button" className="records-primary" onClick={save}>{editor.id ? 'Ünvanı yenilə' : 'Ünvanı əlavə et'}</button></div>
        <div className="pacs-modal-footer"><span role="status">{configStatus || 'Server ünvanları və AE ayarları bu brauzerdə saxlanılır'}</span><button type="button" className="records-primary" onClick={saveConfig}>Yadda saxla və bağla</button></div>
      </div>
    </dialog>
    <footer className="records-status" role="status">{busy && <span className="records-spinner"/>}<span className="records-count">{selection.checked.length > 0 && `${selection.checked.length} seçilib · `}{visibleStudies.length} müayinə · {series.length} seriya</span><span>{status}</span></footer>
  </main>;
}
