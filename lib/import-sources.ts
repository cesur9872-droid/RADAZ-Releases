export async function expandSources(files: File[], onProgress: (message: string) => void): Promise<File[]> {
  const expanded: File[] = [];
  const maxFiles = 20000, maxBytes = 1536 * 1024 * 1024;
  let totalBytes = 0;
  const append = (file: File) => {
    totalBytes += file.size;
    if (expanded.length >= maxFiles || totalBytes > maxBytes) throw new Error('Import həddi: 20000 fayl və ya 1.5 GB. Mənbələri hissə-hissə əlavə edin.');
    expanded.push(file);
  };
  for (const [sourceIndex, file] of files.entries()) {
    if (file.name.toLowerCase().endsWith('.rar')) {
      onProgress(`RAR açılır: ${sourceIndex + 1} / ${files.length} · ${file.name}`);
      try {
        const { createExtractorFromData } = await import('node-unrar-js');
        const response = await fetch('/dicom-codecs/unrar.wasm');
        if (!response.ok) throw new Error('RAR modulu yüklənmədi. RADAZ Setup-ı yeniləyin.');
        const extractor = await createExtractorFromData({ data: await file.arrayBuffer(), wasmBinary: await response.arrayBuffer() });
        const listing = extractor.getFileList();
        const headers = [...listing.fileHeaders];
        if (listing.arcHeader.flags.volume) throw new Error('Çoxhissəli RAR dəstəklənmir. Faylları əvvəlcə bir qovluğa çıxarın.');
        if (listing.arcHeader.flags.headerEncrypted || headers.some(entry => entry.flags.encrypted)) throw new Error('Şifrəli RAR faylını əvvəlcə açıb qovluğunu import edin.');
        const entries = headers.filter(entry => !entry.flags.directory);
        if (entries.length + expanded.length > maxFiles || entries.reduce((sum, entry) => sum + entry.unpSize, totalBytes) > maxBytes) throw new Error('RAR çox böyükdür. Faylları hissə-hissə import edin.');
        for (const entry of extractor.extract({ files: header => !header.flags.directory }).files) {
          if (entry.extraction) append(new File([new Uint8Array(entry.extraction)], entry.fileHeader.name, { type: 'application/dicom' }));
        }
      } catch (error) {
        const reason = (error as { reason?: string }).reason;
        if (reason === 'ERAR_MISSING_PASSWORD' || reason === 'ERAR_BAD_PASSWORD') throw new Error('Şifrəli RAR faylını əvvəlcə açıb qovluğunu import edin.');
        throw new Error(`RAR açıla bilmədi (${file.name}): ${error instanceof Error ? error.message : String(error)}`);
      }
      continue;
    }
    if (!file.name.toLowerCase().endsWith('.zip')) {
      append(file);
      continue;
    }
    onProgress(`ZIP açılır: ${sourceIndex + 1} / ${files.length} · ${file.name}`);
    const JSZip = (await import('jszip')).default;
    const archive = await JSZip.loadAsync(file);
    const entries = Object.values(archive.files).filter(entry => !entry.dir);
    for (const [index, entry] of entries.entries()) {
      const data = await entry.async('uint8array');
      append(new File([new Uint8Array(data)], entry.name, { type: 'application/dicom' }));
      if (index && index % 25 === 0) onProgress(`ZIP açılır: ${file.name} · ${index + 1} / ${entries.length}`);
    }
  }
  return expanded;
}

async function readEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return [await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))];
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const children: FileSystemEntry[] = [];
  // Chromium may return a directory in chunks of 100 entries.
  while (true) {
    const chunk = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (!chunk.length) break;
    children.push(...chunk);
  }
  return (await Promise.all(children.map(readEntry))).flat();
}

export async function filesFromDrop(items: DataTransferItemList, fallback: FileList): Promise<File[]> {
  // Capture entries and files during the drop event; browsers protect them later.
  const sources = Array.from(items).filter(item => item.kind === 'file')
    .map(item => ({ entry: item.webkitGetAsEntry?.(), file: item.getAsFile() }));
  const backup = Array.from(fallback);
  if (!sources.length) return backup;
  return (await Promise.all(sources.map(source => source.entry ? readEntry(source.entry) : Promise.resolve(source.file ? [source.file] : [])))).flat();
}
