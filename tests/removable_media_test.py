"""Optical import protocol, early discovery and eject tested with disposable media."""
import json
import sys
import tempfile
import time
import unittest
from pathlib import Path
from threading import Event, Thread
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
from radaz_archive import Archive, handler_for
from radaz_removable import RemovableMedia, image_metadata, optical_drives
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.sequence import Sequence
from pydicom.uid import ExplicitVRLittleEndian, ImplicitVRLittleEndian


def write_image(path, index=1, raw=False):
    ds = Dataset()
    ds.SOPClassUID = '1.2.840.10008.5.1.4.1.1.2'
    ds.SOPInstanceUID = f'2.25.101.{index}'
    ds.StudyInstanceUID = '2.25.102'; ds.SeriesInstanceUID = '2.25.103'
    ds.PatientName = 'RADAZ^MEDIA^TEST'; ds.PatientID = 'SYNTHETIC'
    ds.StudyDate = '20261003'; ds.Modality = 'CT'; ds.SeriesDescription = 'CD progressive CT'
    ds.SeriesNumber = 1; ds.InstanceNumber = index
    ds.Rows = 32; ds.Columns = 32; ds.SamplesPerPixel = 1; ds.PhotometricInterpretation = 'MONOCHROME2'
    ds.BitsAllocated = 16; ds.BitsStored = 12; ds.HighBit = 11; ds.PixelRepresentation = 0
    ds.PixelSpacing = [1, 1]; ds.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]
    ds.ImagePositionPatient = [0, 0, index]; ds.SliceThickness = 1; ds.FrameOfReferenceUID = '2.25.104'
    ds.WindowCenter = 512; ds.WindowWidth = 1024
    ds.PixelData = b''.join((x % 1024).to_bytes(2, 'little') for x in range(1024))
    path.parent.mkdir(parents=True, exist_ok=True)
    if raw:
        ds.save_as(path, implicit_vr=True, little_endian=True)
    else:
        ds.file_meta = FileMetaDataset(); ds.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
        ds.save_as(path, enforce_file_format=True)
    return ds


def wait_for(predicate, timeout=8):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        if predicate(): return
        time.sleep(.02)
    raise AssertionError('Timed out waiting for media state')


class MediaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='radaz-media-test-')
        self.root = Path(self.temp.name)
        self.disc = self.root / 'disc'; self.disc.mkdir()
        self.present = {str(self.disc): ('disc-serial', 'Synthetic CT')}
        self.media = RemovableMedia(lambda: dict(self.present), interval=.02, cache_parent=self.root)

    def tearDown(self):
        self.media.close(); self.temp.cleanup()

    def start(self):
        self.media.watch('test-client-0123456789')
        wait_for(lambda: self.media.snapshot()['sessions'])
        return self.media.snapshot()['sessions'][0]['id']

    def ready(self):
        wait_for(lambda: self.media.snapshot()['sessions'][0]['stage'] != 'scanning')
        return self.media.snapshot()['sessions'][0]

    def test_extensionless_raw_nested_duplicates_junk_and_local_cache(self):
        write_image(self.disc/'nested'/'IMAGE0001', 1)
        write_image(self.disc/'nested'/'raw.noextension', 2, raw=True)
        write_image(self.disc/'duplicate.dcm', 1)
        (self.disc/'readme.txt').write_text('Not DICOM' * 200)
        sid = self.start(); state = self.ready()
        self.assertEqual(state['total'], 2)
        items = self.media.entries(sid)['items']
        self.assertEqual({item['instance'] for item in items}, {1, 2})
        self.assertNotIn('path', items[0]); self.assertNotIn('root', state)
        stream, size = self.media.open_file(sid, items[0]['id'])
        with stream: self.assertEqual(len(stream.read()), size)
        cached = list(self.media.cache_root.rglob('*.dcm'))
        self.assertEqual(len(cached), 2)
        self.assertFalse(list(self.media.cache_root.rglob('*.part')))
        # Scrolling still succeeds without reading source bytes a second time.
        for source in self.disc.rglob('*'):
            if source.is_file(): source.write_bytes(b'no longer readable DICOM')
        stream, size = self.media.open_file(sid, items[0]['id'])
        with stream: self.assertEqual(len(stream.read()), size)
        self.present.clear(); self.media.poll()
        wait_for(lambda: list(self.media.cache_root.iterdir()) == [self.media.cache_root/'.owner'])

    def test_eject_during_copy_never_publishes_partial_and_removes_files(self):
        write_image(self.disc/'I0001')
        started, resume = Event(), Event()
        original = self.media._copy
        def blocked(session, source, fid, size):
            (session['cache']/'blocked.part').write_bytes(b'partial')
            started.set(); resume.wait(5)
            if session['cancel'].is_set(): return None
            return original(session, source, fid, size)
        with patch.object(self.media, '_copy', side_effect=blocked):
            sid = self.start(); self.assertTrue(started.wait(5))
            self.assertEqual(self.media.entries(sid)['items'], [])
            self.present.clear(); self.media.poll(); resume.set()
            wait_for(lambda: list(self.media.cache_root.iterdir()) == [self.media.cache_root/'.owner'])
            self.assertEqual(self.media.snapshot()['sessions'], [])

    def test_copy_error_is_visible_and_does_not_publish_unreadable_image(self):
        write_image(self.disc/'I0001')
        with patch.object(self.media, '_copy', side_effect=OSError('Temporary disk is full')):
            sid = self.start(); state = self.ready()
            self.assertEqual(state['stage'], 'error')
            self.assertIn('disk is full', state['error'])
            self.assertEqual(self.media.entries(sid)['items'], [])

    def test_dicomdir_references_first_and_path_escape_ignored(self):
        write_image(self.disc/'images'/'first', 2)
        write_image(self.disc/'aaa.dcm', 1)
        outside = self.root/'outside.dcm'; write_image(outside, 3)
        ds = Dataset(); ds.file_meta = FileMetaDataset()
        ds.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
        ds.file_meta.MediaStorageSOPClassUID = '1.2.840.10008.1.3.10'
        ds.file_meta.MediaStorageSOPInstanceUID = '2.25.999'
        record = Dataset(); record.ReferencedFileID = ['IMAGES', 'FIRST']
        bad = Dataset(); bad.ReferencedFileID = ['..', 'outside.dcm']
        ds.DirectoryRecordSequence = Sequence([record, bad]); ds.save_as(self.disc/'DICOMDIR', enforce_file_format=True)
        sid = self.start(); state = self.ready()
        self.assertTrue(state['dicomdir']); self.assertEqual(state['total'], 2)
        self.assertEqual(self.media.entries(sid)['items'][0]['instance'], 2)

    def test_first_instance_visible_before_700_image_scan_finishes_and_eject_cancels(self):
        for index in range(1, 701): write_image(self.disc/f'I{index:04}', index)
        first = Event(); resume = Event()
        def slow(path):
            result = image_metadata(path)
            if path.name == 'I0002': first.set(); resume.wait(5)
            return result
        with patch('radaz_removable.image_metadata', side_effect=slow):
            sid = self.start()
            self.assertTrue(first.wait(5))
            state = self.media.snapshot()['sessions'][0]
            self.assertEqual(state['total'], 1); self.assertEqual(state['stage'], 'scanning')
            item = self.media.entries(sid)['items'][0]
            self.present.clear(); self.media.poll()
            self.assertEqual(self.media.snapshot()['sessions'], [])
            resume.set(); time.sleep(.05)
            with self.assertRaises(FileNotFoundError): self.media.open_file(sid, item['id'])
            self.assertEqual(self.media.snapshot()['sessions'], [])

    def test_eject_reinsert_same_letter_has_new_session_and_stale_ids_fail(self):
        write_image(self.disc/'I0001')
        sid = self.start(); self.ready()
        fid = self.media.entries(sid)['items'][0]['id']
        self.present.clear(); self.media.poll()
        with self.assertRaises(FileNotFoundError): self.media.open_file(sid, fid)
        self.present[str(self.disc)] = ('other-serial', 'New CD'); self.media.poll()
        self.ready(); self.assertNotEqual(self.media.snapshot()['sessions'][0]['id'], sid)
        self.media.unwatch('test-client-0123456789')
        self.assertEqual(self.media.snapshot()['sessions'], [])
        wait_for(lambda: list(self.media.cache_root.iterdir()) == [self.media.cache_root/'.owner'])

    def test_restart_cleans_abandoned_cache_but_preserves_other_live_service(self):
        from radaz_removable import CACHE_MARKER
        abandoned = self.root/'radaz-cd-cache-abandoned'; abandoned.mkdir()
        (abandoned/'.owner').write_bytes(CACHE_MARKER)
        (abandoned/'old.dcm').write_bytes(b'disposable')
        live = self.media.cache_root
        other = RemovableMedia(lambda: {}, cache_parent=self.root)
        try:
            self.assertFalse(abandoned.exists())
            self.assertTrue(live.exists())
        finally: other.close()

    def test_http_import_does_not_write_archive_and_enforces_origin(self):
        write_image(self.disc/'FILE_WITHOUT_EXTENSION')
        archive = Archive(self.root/'archive', bind='127.0.0.1')
        http = ThreadingHTTPServer(('127.0.0.1', 0), handler_for(archive, self.media))
        thread = Thread(target=http.serve_forever, daemon=True); thread.start()
        url = f'http://127.0.0.1:{http.server_port}'
        try:
            body = json.dumps({'client': 'test-client-0123456789'}).encode()
            with self.assertRaises(HTTPError) as caught:
                urlopen(Request(url+'/removable/watch', data=body, headers={'Origin':'https://example.com', 'Content-Type':'application/json'}))
            self.assertEqual(caught.exception.code, 403)
            with urlopen(Request(url+'/removable/watch', data=body, headers={'Content-Type':'application/json'})) as response: json.load(response)
            wait_for(lambda: self.media.snapshot()['sessions']); state = self.ready(); sid = state['id']
            with urlopen(url+f'/removable/entries?session={sid}') as response: item = json.load(response)['items'][0]
            with urlopen(url+f'/removable/file/{sid}/{item["id"]}') as response:
                self.assertEqual(response.headers['Cache-Control'], 'no-store'); self.assertTrue(response.read())
            self.assertEqual(archive.status()['instanceCount'], 0)
            self.present.clear(); self.media.poll()
            with self.assertRaises(HTTPError) as caught: urlopen(url+f'/removable/file/{sid}/{item["id"]}')
            self.assertEqual(caught.exception.code, 410)
        finally:
            http.shutdown(); http.server_close(); thread.join(); archive.stop()


if __name__ == '__main__': unittest.main()
