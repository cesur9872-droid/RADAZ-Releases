'use client';
import { OutputPageHeader } from '@/components/output-page-header';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Printer, Radio, Settings2 } from 'lucide-react';
import { getArchiveFiles } from '@/lib/local-archive';
import { bytesToBase64, readDicomPixels, type DicomPixelImage } from '@/lib/dicom-pixels';
import { printDicomFilm } from '@/lib/dicom-print';
import { defaultPrinter, loadPrinterSettings } from '@/lib/printer-settings';
import { readOutputJob } from '@/lib/output-jobs';

const layouts = ['1,1','1,2','2,2','2,3','2,4','3,3','3,4','4,4'];
const adjusted = (image: DicomPixelImage, level: number, width: number) => image.pixels.map(value => Math.max(0,Math.min(255,Math.round((value - level + width / 2) * 255 / width))));
function FilmImage({ image, level, width }: { image: DicomPixelImage; level: number; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    canvas.width = image.columns; canvas.height = image.rows;
    const ctx = canvas.getContext('2d')!, raster = ctx.createImageData(image.columns,image.rows), pixels = adjusted(image,level,width);
    for (let i=0;i<pixels.length;i++) { raster.data[i*4]=raster.data[i*4+1]=raster.data[i*4+2]=pixels[i]; raster.data[i*4+3]=255; }
    ctx.putImageData(raster,0,0);
  },[image,level,width]);
  return <canvas ref={ref}/>;
}

export default function PrintPage() {
  useEffect(() => { document.title = 'RADAZ · Çap'; }, []);
  const [images,setImages] = useState<DicomPixelImage[]>([]), [title,setTitle] = useState('Görüntülər');
  const [printer,setPrinter] = useState(defaultPrinter), [layout,setLayout] = useState('2,2'), [filmSize,setFilmSize] = useState('14INX17IN');
  const [paper,setPaper] = useState('A4'), [orientation,setOrientation] = useState<'PORTRAIT'|'LANDSCAPE'>('PORTRAIT');
  const [page,setPage] = useState(0), [scope,setScope] = useState('all'), [copies,setCopies] = useState(1);
  const [level,setLevel] = useState(127.5), [width,setWidth] = useState(255), [status,setStatus] = useState('Görüntülər hazırlanır…'), [busy,setBusy] = useState(false);
  const [columns,rows] = layout.split(',').map(Number), perPage = columns * rows, pageCount = Math.max(1,Math.ceil(images.length/perPage));
  const pages = Array.from({length:pageCount},(_,index) => images.slice(index*perPage,(index+1)*perPage));
  useEffect(() => {
    let disposed = false;
    void loadPrinterSettings().then(value => { if(disposed)return; setPrinter(value);setLayout(value.layout);setFilmSize(value.filmSize);setOrientation(value.orientation);setPaper(value.paperSize);setCopies(value.copies); });
    void (async () => {
      const query = new URLSearchParams(location.search), jobId = query.get('job');
      const decoded: DicomPixelImage[] = []; let skipped=0;
      if (jobId) {
        const job = await readOutputJob(jobId);
        if (!job?.frames?.length) throw new Error('Çap siyahısı tapılmadı. Viewer-də görüntüləri yenidən seçin.');
        if(!disposed)setTitle(job.title);
        for (const frame of job.frames) {
          const bitmap = await createImageBitmap(frame.blob), canvas = document.createElement('canvas');
          // Keep printer rasters within Basic Grayscale Print's configured limits.
          const scale = Math.min(1,4096/Math.max(bitmap.width,bitmap.height));
          canvas.width = Math.max(1,Math.round(bitmap.width*scale)); canvas.height = Math.max(1,Math.round(bitmap.height*scale));
          const ctx = canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
          const rgba = ctx.getImageData(0,0,canvas.width,canvas.height).data,pixels = new Uint8Array(canvas.width*canvas.height);
          for(let i=0;i<pixels.length;i++)pixels[i]=Math.round(.299*rgba[i*4]+.587*rgba[i*4+1]+.114*rgba[i*4+2]);
          decoded.push({name:frame.name,rows:canvas.height,columns:canvas.width,pixels,windowCenter:127.5,windowWidth:255,photometric:'MONOCHROME2'});
        }
      } else {
        const uid = query.get('study'); if(!uid)throw new Error('Çap üçün viewer-də görüntü və ya arxivdə müayinə seçin.');
        const files = await getArchiveFiles(uid);
        for(const file of files) { try { const image=await readDicomPixels(file);if(image)decoded.push(image);else skipped++; }catch { skipped++; } }
      }
      if(!disposed){setImages(decoded);setStatus(`${decoded.length} görüntü hazırdır${skipped ? ` · ${skipped} görüntü açıla bilmədi` : ''}`);}
    })().catch(error => { if(!disposed)setStatus(error instanceof Error ? error.message : String(error)); });
    return () => { disposed=true; };
  },[]);
  useEffect(() => setPage(value => Math.min(value,pageCount-1)),[pageCount]);
  const send = async () => {
    setBusy(true); let sent=0;
    const indices = scope==='all' ? pages.map((_,i)=>i) : [page];
    try {
      for(const index of indices) {
        setPage(index);setStatus(`DICOM printer: plyonka ${index+1} / ${pageCount} göndərilir…`);
        const result = await printDicomFilm({...printer,copies},{filmSize,orientation,layout,images:pages[index].map(image=>({rows:image.rows,columns:image.columns,pixels:bytesToBase64(adjusted(image,level,width))}))});
        sent++;setStatus(result.message);
      }
      setStatus(`${sent} plyonkanın çap əmri printer tərəfindən qəbul edildi · hərəsindən ${copies} nüsxə`);
    } catch(error){setScope('page');setStatus(`${sent} plyonka qəbul edildi. Cari plyonkada dayandırıldı: ${error instanceof Error ? error.message : String(error)}`);}
    finally{setBusy(false);}
  };
  const ratio = ({'8INX10IN':8/10,'10INX12IN':10/12,'11INX14IN':11/14,'14INX17IN':14/17,A4:210/297,A3:297/420}[filmSize] || 14/17);
  return <main className="print-shell print-output-shell">
    <style>{`@media print { @page { size: ${paper} ${orientation==='PORTRAIT'?'portrait':'landscape'}; margin: 5mm; } }`}</style>
    <OutputPageHeader kind="print">{title} · {images.length} görüntü</OutputPageHeader>
    <aside className="print-controls"><label>Çap ediləcək səhifələr<select disabled={busy} value={scope} onChange={e=>setScope(e.target.value)}><option value="all">Bütün seçilmiş görüntülər</option><option value="page">Yalnız cari plyonka</option></select></label>
      <label>Bölgü<select disabled={busy} value={layout} onChange={e=>{setLayout(e.target.value);setPage(0);}}>{layouts.map(value=><option key={value} value={value}>{value.replace(',',' × ')} · {value.split(',').map(Number).reduce((a,b)=>a*b)} görüntü</option>)}</select></label>
      <label>DICOM plyonka ölçüsü<select disabled={busy} value={filmSize} onChange={e=>setFilmSize(e.target.value)}>{['8INX10IN','10INX12IN','11INX14IN','14INX17IN','A4','A3'].map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Adi printer kağızı<select value={paper} onChange={e=>setPaper(e.target.value)}><option>A4</option><option>A3</option><option>Letter</option></select></label>
      <label>İstiqamət<select disabled={busy} value={orientation} onChange={e=>setOrientation(e.target.value as 'PORTRAIT'|'LANDSCAPE')}><option value="PORTRAIT">Portret</option><option value="LANDSCAPE">Landşaft</option></select></label>
      <label>DICOM nüsxə sayı<input disabled={busy} type="number" min="1" max="99" value={copies} onChange={e=>setCopies(Math.max(1,Math.min(99,+e.target.value || 1)))}/></label>
      <label>Parlaqlıq<input disabled={busy} type="range" min="0" max="255" step="0.5" value={level} onChange={e=>setLevel(+e.target.value)}/></label><label>Kontrast<input disabled={busy} type="range" min="1" max="510" value={width} onChange={e=>setWidth(+e.target.value)}/></label>
      <button className="print-settings-toggle" disabled={busy} onClick={()=>{setLevel(127.5);setWidth(255);}}>Görünüşü bərpa et</button>
      <div className="print-pages"><button aria-label="Əvvəlki plyonka" disabled={page===0||busy} onClick={()=>setPage(value=>value-1)}><ChevronLeft size={18}/></button><span>{page+1} / {pageCount}</span><button aria-label="Sonrakı plyonka" disabled={page+1>=pageCount||busy} onClick={()=>setPage(value=>value+1)}><ChevronRight size={18}/></button></div>
      <button className="print-action" disabled={!images.length||busy} onClick={()=>window.print()}><Printer size={17}/> Adi printer / PDF</button>
      <button className="print-action dicom" disabled={!images.length||busy||!printer.host} onClick={()=>void send()}><Radio size={17}/> DICOM printerə göndər</button>
      {!printer.host&&<p className="output-note">DICOM çap üçün printerin IP, port və AE Title ayarlarını daxil edin.</p>}
      <a className="print-settings-toggle" href="/printer-settings" target="_blank" rel="noreferrer"><Settings2 size={17}/> Printer ayarları</a>
      <button className="output-link" disabled={busy} onClick={()=>void loadPrinterSettings().then(value=>{setPrinter(value);setStatus('Printer ayarları yeniləndi');})}>Ayarları yenilə</button>
    </aside>
    <div className="print-sheets">{pages.map((frames,index)=><section key={index} data-print-page={index+1} className={`film-preview print-sheet ${index===page?'is-preview':''} ${scope==='page'&&index!==page?'skip-print':''}`} style={{'--film-columns':columns,'--film-rows':rows,aspectRatio:orientation==='PORTRAIT'?ratio:1/ratio} as React.CSSProperties}>{frames.map((image,i)=><div className="film-cell" key={i}><FilmImage image={image} level={level} width={width}/><span>{index*perPage+i+1}</span></div>)}</section>)}</div>
    <footer className="print-status" role="status">{busy&&<i/>}{status}</footer>
  </main>;
}
