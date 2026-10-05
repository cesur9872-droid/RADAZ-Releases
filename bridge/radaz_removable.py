"""Optical media sessions. Read from the disc; never copy into the archive or TEMP.

Only the Windows drive enumerator can introduce roots. HTTP callers receive opaque
session/file IDs, never a filesystem path. All state is disposable RAM metadata.
"""
import ctypes
import os
import re
import time
import uuid
import warnings
from pathlib import Path
from threading import Event, RLock, Thread

import pydicom

UID = re.compile(r'\d+(?:\.\d+)+\Z')
MAX_FILE = 256 * 1024 * 1024
MAX_FILES = 20000


def optical_drives():
    if os.name != 'nt':
        return {}
    kernel = ctypes.windll.kernel32
    # Empty drives must never open Windows' "insert a disc" dialog.
    previous = ctypes.c_ulong()
    kernel.SetThreadErrorMode(0x0001 | 0x8000, ctypes.byref(previous))
    try:
        mask = kernel.GetLogicalDrives()
        found = {}
        for index in range(26):
            if not mask & (1 << index):
                continue
            root = f'{chr(65 + index)}:\\'
            if kernel.GetDriveTypeW(ctypes.c_wchar_p(root)) != 5:
                continue
            label = ctypes.create_unicode_buffer(261)
            serial = ctypes.c_ulong()
            if kernel.GetVolumeInformationW(ctypes.c_wchar_p(root), label, 261,
                    ctypes.byref(serial), None, None, None, 0):
                found[root] = (str(serial.value), label.value or 'CD/DVD')
        return found
    finally:
        kernel.SetThreadErrorMode(previous.value, None)


def inside(root, path):
    resolved = path.resolve()
    if not resolved.is_relative_to(root.resolve()) or path.is_symlink():
        raise ValueError('Media path escapes disc')
    return resolved


def walk_files(root):
    for folder, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if not (Path(folder) / d).is_symlink())
        for name in sorted(files):
            path = Path(folder) / name
            try:
                yield inside(root, path)
            except (ValueError, OSError):
                continue


def dicomdir_files(root, directory):
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        ds = pydicom.dcmread(directory)
    seen = set()
    for record in getattr(ds, 'DirectoryRecordSequence', []):
        reference = getattr(record, 'ReferencedFileID', None)
        if not reference:
            continue
        parts = str(reference).replace('/', '\\').split('\\') if isinstance(reference, str) else list(reference)
        if any(not p or p in ('.', '..') or ':' in p or '/' in p or '\\' in p for p in parts):
            continue
        path = directory.parent
        try:
            for part in parts:
                path = next((p for p in path.iterdir() if p.name.casefold() == str(part).casefold()), path / str(part))
            path = inside(root, path)
            if path.is_file() and path not in seen:
                seen.add(path)
                yield path
        except (OSError, ValueError):
            continue


def image_metadata(path):
    size = path.stat().st_size
    if not 128 <= size <= MAX_FILE:
        return None
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        # Pixel values stay on the CD. force=True also accepts raw/no-preamble DICOM.
        ds = pydicom.dcmread(path, force=True, defer_size=1024)
    def text(key):
        return str(getattr(ds, key, '')).strip()
    if any(not UID.fullmatch(text(key)) or len(text(key)) > 64 for key in
           ('SOPClassUID', 'SOPInstanceUID', 'StudyInstanceUID', 'SeriesInstanceUID')):
        return None
    rows, columns = int(getattr(ds, 'Rows', 0)), int(getattr(ds, 'Columns', 0))
    bits, samples = int(getattr(ds, 'BitsAllocated', 0)), int(getattr(ds, 'SamplesPerPixel', 0))
    if not rows or not columns or not samples or bits not in (1, 8, 16, 32, 64) or 'PixelData' not in ds:
        return None
    # Only small metadata travels during discovery; pixel buffers stay on the disc.
    tags = {}
    for tag in (0x00080016, 0x00080018, 0x00080020, 0x00080060, 0x00081030, 0x0008103e,
                0x00100010, 0x00100020, 0x00100030, 0x00180015, 0x00180050, 0x00180088,
                0x0020000d, 0x0020000e, 0x00200011, 0x00200013, 0x00200032, 0x00200037, 0x00200052,
                0x00280002, 0x00280004, 0x00280010, 0x00280011, 0x00280030, 0x00280100, 0x00280101,
                0x00280102, 0x00280103, 0x00281050, 0x00281051, 0x00281052, 0x00281053, 0x00281055):
        element = ds.get(tag)
        if element is not None:
            value = element.value
            tags[f'x{tag:08x}'] = '\\'.join(str(v) for v in value) if element.VM > 1 else str(value)
    tags['x00020010'] = str(getattr(ds.file_meta, 'TransferSyntaxUID', '1.2.840.10008.1.2'))
    return {'tags': tags, 'studyId': text('StudyInstanceUID'), 'seriesUID': text('SeriesInstanceUID'),
            'sopUID': text('SOPInstanceUID'), 'name': text('SeriesDescription') or 'Adsız seriya',
            'modality': text('Modality') or 'DICOM', 'patient': text('PatientName').replace('^', ' ') or 'Naməlum pasiyent',
            'patientId': text('PatientID') or '—', 'birth': text('PatientBirthDate'),
            'date': text('StudyDate'), 'number': text('SeriesNumber') or '—',
            'instance': int(getattr(ds, 'InstanceNumber', 0) or 0), 'size': size,
            'decodedBytes': rows * columns * 4}


class RemovableMedia:
    def __init__(self, drives=optical_drives, interval=1, lease_seconds=120):
        self.drives, self.interval, self.lease_seconds = drives, interval, lease_seconds
        self.lock, self.stop = RLock(), Event()
        self.clients, self.sessions = {}, {}
        self.thread = None

    def watch(self, client):
        if not isinstance(client, str) or not re.fullmatch(r'[a-zA-Z0-9-]{16,80}', client):
            raise ValueError('Invalid media client')
        with self.lock:
            self.clients[client] = time.monotonic()
            if self.thread is None:
                self.thread = Thread(target=self._watch, daemon=True)
                self.thread.start()
        return self.snapshot()

    def unwatch(self, client):
        with self.lock:
            self.clients.pop(client, None)
            if not self.clients:
                self._clear()

    def _clear(self):
        for session in self.sessions.values():
            session['cancel'].set()
            session['files'].clear()
            session['paths'].clear()
        self.sessions.clear()

    def close(self):
        self.stop.set()
        with self.lock:
            self._clear()
            self.clients.clear()
        if self.thread:
            self.thread.join(timeout=3)

    def _watch(self):
        while not self.stop.is_set():
            try:
                self.poll()
            except OSError:
                pass
            self.stop.wait(self.interval)

    def poll(self):
        with self.lock:
            now = time.monotonic()
            self.clients = {key: seen for key, seen in self.clients.items() if now - seen < self.lease_seconds}
            if not self.clients:
                self._clear()
                return
        drives = self.drives()
        with self.lock:
            if not self.clients or self.stop.is_set():
                return
            for sid, session in list(self.sessions.items()):
                if drives.get(str(session['root'])) != session['identity']:
                    session['cancel'].set()
                    session['files'].clear()
                    session['paths'].clear()
                    del self.sessions[sid]
            existing = {str(s['root']) for s in self.sessions.values()}
            for root, identity in drives.items():
                if root in existing:
                    continue
                sid = uuid.uuid4().hex
                session = {'id': sid, 'root': root, 'identity': identity, 'label': identity[1],
                           'stage': 'scanning', 'scanned': 0, 'files': [], 'paths': {},
                           'cancel': Event(), 'error': '', 'dicomdir': False}
                self.sessions[sid] = session
                Thread(target=self._scan, args=(session,), daemon=True).start()

    def _scan(self, session):
        root = Path(session['root'])
        seen_paths, seen_sops = set(), set()
        def add(path):
            if session['cancel'].is_set():
                return
            if path in seen_paths:
                return
            seen_paths.add(path)
            item = None
            try:
                item = image_metadata(path)
            except Exception:
                pass  # Non-DICOM/corrupt files must not stop the disc scan.
            with self.lock:
                if session['cancel'].is_set():
                    return
                session['scanned'] += 1
                if not item or item['sopUID'] in seen_sops:
                    return
                if len(session['files']) >= MAX_FILES:
                    raise ValueError('Diskdə 20000-dən çox görüntü var')
                seen_sops.add(item['sopUID'])
                fid = uuid.uuid4().hex
                session['paths'][fid] = path
                session['files'].append({'id': fid, **item})
        try:
            # Standard discs place DICOMDIR at their root. Also support nested media sets.
            directories = [p for p in root.iterdir() if p.name.upper() == 'DICOMDIR' and p.is_file()]
            if not directories:
                for path in walk_files(root):
                    if session['cancel'].is_set():
                        return
                    if path.name.upper() == 'DICOMDIR':
                        directories.append(path)
                        break
                    add(path)  # First images are published even during fallback discovery.
            for directory in directories:
                try:
                    for path in dicomdir_files(root, directory):
                        if session['cancel'].is_set():
                            return
                        session['dicomdir'] = True
                        add(path)
                except (OSError, ValueError, AttributeError):
                    continue
            # Also recover unindexed files or broken references; never rely on suffixes.
            for path in walk_files(root):
                if session['cancel'].is_set():
                    return
                if path.name.upper() != 'DICOMDIR':
                    add(path)
            with self.lock:
                if not session['cancel'].is_set():
                    session['stage'] = 'ready'
        except (OSError, ValueError) as error:
            with self.lock:
                if not session['cancel'].is_set():
                    session['stage'] = 'error'
                    session['error'] = str(error)
        finally:
            seen_paths.clear()
            seen_sops.clear()

    def snapshot(self):
        with self.lock:
            return {'sessions': [{key: s[key] for key in ('id', 'label', 'stage', 'scanned', 'error', 'dicomdir')} |
                                 {'total': len(s['files'])} for s in self.sessions.values()]}

    def entries(self, sid, after=0):
        with self.lock:
            s = self.sessions.get(sid)
            if not s:
                raise FileNotFoundError('CD/DVD çıxarılıb')
            after = max(0, int(after))
            items = s['files'][after:after + 64]
            return {'items': items, 'next': after + len(items)}

    def open_file(self, sid, fid):
        with self.lock:
            s = self.sessions.get(sid)
            if not s or fid not in s['paths'] or s['cancel'].is_set():
                raise FileNotFoundError('CD/DVD çıxarılıb')
            root, path, identity = s['root'], s['paths'][fid], s['identity']
        if self.drives().get(root) != identity:
            self.poll()
            raise FileNotFoundError('CD/DVD çıxarılıb')
        path = inside(Path(root), path)
        stream = path.open('rb')
        size = os.fstat(stream.fileno()).st_size
        if size > MAX_FILE:
            stream.close()
            raise ValueError('DICOM faylı çox böyükdür')
        return stream, size
