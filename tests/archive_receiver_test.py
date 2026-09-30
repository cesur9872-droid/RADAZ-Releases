"""Exercise the real DIMSE and HTTP protocols with isolated synthetic data."""
import io
import json
import socket
import sys
import tempfile
import unittest
from pathlib import Path
from threading import Thread
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
from radaz_archive import Archive, handler_for
from radaz_product import ProductService
from pydicom import dcmread
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid
from pynetdicom import AE
from pynetdicom.sop_class import ComputedRadiographyImageStorage, Verification


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def image():
    ds = Dataset()
    ds.SOPClassUID = ComputedRadiographyImageStorage
    ds.SOPInstanceUID = generate_uid(); ds.StudyInstanceUID = generate_uid(); ds.SeriesInstanceUID = generate_uid()
    ds.PatientName = 'RADAZ^SYNTHETIC'; ds.PatientID = 'TEST'; ds.Modality = 'CR'
    ds.Rows = 2; ds.Columns = 3; ds.SamplesPerPixel = 1; ds.PhotometricInterpretation = 'MONOCHROME1'
    ds.BitsAllocated = 16; ds.BitsStored = 12; ds.HighBit = 11; ds.PixelRepresentation = 0
    ds.PixelData = bytes([0,0,1,0,2,0,0,4,255,7,255,15])
    ds.file_meta = FileMetaDataset(); ds.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    return ds


class ReceiverTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.archive = Archive(self.root, bind='127.0.0.1')
        self.port = free_port()
        self.archive.configure({'aeTitle':'RADAZ_TEST','port':self.port,'enabled':True})
        self.ds = image()
        product = ProductService(self.root, device='A'*64, trial_root=self.root/'trial')
        with patch('radaz_archive.ProductService', return_value=product):
            self.http = ThreadingHTTPServer(('127.0.0.1',0),handler_for(self.archive))
        self.thread = Thread(target=self.http.serve_forever, daemon=True); self.thread.start()
        self.url = f'http://127.0.0.1:{self.http.server_port}'

    def tearDown(self):
        self.http.shutdown(); self.http.server_close(); self.thread.join()
        self.archive.stop(); self.temp.cleanup()

    def association(self, called='RADAZ_TEST'):
        ae = AE(ae_title='RADAZ_TEST_SCU')
        ae.add_requested_context(ComputedRadiographyImageStorage, ExplicitVRLittleEndian)
        ae.add_requested_context(Verification)
        return ae.associate('127.0.0.1', self.port, ae_title=called)

    def test_echo_store_duplicate_restart_pixels_and_http(self):
        assoc = self.association(); self.assertTrue(assoc.is_established)
        self.assertEqual(assoc.send_c_echo().Status, 0)
        self.assertEqual(assoc.send_c_store(self.ds).Status, 0)
        self.assertEqual(assoc.send_c_store(self.ds).Status, 0)
        assoc.release()
        self.assertEqual(self.archive.status()['instanceCount'], 1)
        self.archive.stop()
        self.archive = Archive(self.root, bind='127.0.0.1'); self.archive.start()
        self.assertEqual(self.archive.config['port'],self.port)
        studies = self.archive.studies(); self.assertEqual(len(studies), 1)
        self.assertEqual(studies[0]['imageCount'], 1)
        with urlopen(self.url + '/file/' + str(self.ds.SOPInstanceUID)) as response:
            saved = dcmread(io.BytesIO(response.read()))
        self.assertEqual(saved.PixelData, self.ds.PixelData)
        self.assertEqual(saved.file_meta.TransferSyntaxUID, ExplicitVRLittleEndian)
        with urlopen(self.url + '/studies') as response:
            self.assertEqual(json.load(response)[0]['storage'], 'disk')

    def test_wrong_called_ae_rejected(self):
        assoc = self.association('NOT_RADAZ'); self.assertFalse(assoc.is_established)

    def test_cd_import_then_cstore_same_dataset(self):
        stream=io.BytesIO(); self.ds.save_as(stream,enforce_file_format=True)
        self.archive.store(stream.getvalue(), self.ds)
        assoc=self.association()
        self.assertEqual(assoc.send_c_store(self.ds).Status,0)
        assoc.release()
        self.assertEqual(self.archive.status()['instanceCount'],1)

    def test_storage_failure_never_acknowledges_success(self):
        def fail(*_): raise OSError('simulated full disk')
        self.archive.store = fail
        assoc = self.association()
        self.assertEqual(assoc.send_c_store(self.ds).Status,0xA700)
        assoc.release(); self.assertEqual(self.archive.status()['instanceCount'],0)

    def test_uid_collision_preserves_original(self):
        assoc = self.association(); self.assertEqual(assoc.send_c_store(self.ds).Status,0)
        self.ds.PixelData = bytes(12)
        self.assertEqual(assoc.send_c_store(self.ds).Status,0xA900)
        assoc.release(); self.assertEqual(self.archive.status()['instanceCount'],1)

    def test_failed_reconfiguration_restores_listener(self):
        with socket.socket() as occupied:
            occupied.bind(('127.0.0.1',0)); occupied.listen()
            with self.assertRaises(OSError):
                self.archive.configure({'aeTitle':'NEW_AE','port':occupied.getsockname()[1],'enabled':True})
        assoc=self.association(); self.assertTrue(assoc.is_established); assoc.release()
        self.assertEqual(self.archive.config['aeTitle'],'RADAZ_TEST')

    def test_http_import_and_untrusted_origin(self):
        stream=io.BytesIO(); self.ds.save_as(stream,enforce_file_format=True)
        request=Request(self.url+'/import',stream.getvalue(),headers={'Content-Type':'application/dicom'})
        with urlopen(request) as response: self.assertEqual(response.status,200)
        self.assertEqual(self.archive.status()['instanceCount'],1)
        with self.assertRaises(HTTPError) as error:
            urlopen(Request(self.url+'/status',headers={'Origin':'https://untrusted.example'}))
        self.assertEqual(error.exception.code,403)


if __name__ == '__main__':
    unittest.main(verbosity=2)
