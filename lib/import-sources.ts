export async function expandSources(files: File[], onProgress: (message: string) => void): Promise<File[]> {
  const expanded: File[] = [];
  for (const [sourceIndex, file] of files.entries()) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      expanded.push(file);
      continue;
    }
    onProgress(`ZIP açılır: ${sourceIndex + 1} / ${files.length} · ${file.name}`);
    const JSZip = (await import('jszip')).default;
    const archive = await JSZip.loadAsync(file);
    const entries = Object.values(archive.files).filter(entry => !entry.dir);
    for (const [index, entry] of entries.entries()) {
      const data = await entry.async('uint8array');
      expanded.push(new File([new Uint8Array(data)], entry.name, { type: 'application/dicom' }));
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
  const entries = Array.from(items).filter(item => item.kind === 'file')
    .map(item => item.webkitGetAsEntry?.()).filter((entry): entry is FileSystemEntry => !!entry);
  return entries.length ? (await Promise.all(entries.map(readEntry))).flat() : Array.from(fallback);
}
