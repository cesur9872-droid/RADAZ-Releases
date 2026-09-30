import base64
import json
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'bridge'))
from radaz_product import ProductService,verify_key

class Licenses(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();cls.root=Path(cls.temp.name);cls.admin=cls.root/'admin';cls.public=cls.root/'public.json';cls.device='A'*64
        cls.cli('init','--public',str(cls.public))
        cls.license=cls.cli('create','--customer','Synthetic Test','--seats','1','--period','monthly').stdout.strip()
        cls.cli('activate','--license',cls.license,'--device',cls.device,'--out',str(cls.root/'key.txt'))
        cls.key=(cls.root/'key.txt').read_text().strip();cls.pub=json.loads(cls.public.read_text())
    @classmethod
    def tearDownClass(cls): cls.temp.cleanup()
    @classmethod
    def cli(cls,*args,check=True):
        return subprocess.run(['node',str(ROOT/'scripts/license-admin.mjs'),*args,'--dir',str(cls.admin)],capture_output=True,text=True,check=check)
    def test_valid_signature(self):
        self.assertEqual(verify_key(self.key,self.pub,self.device)['customer'],'Synthetic Test')
    def test_tamper_rejected(self):
        prefix,payload,sig=self.key.split('.');claims=json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)));claims['seats']=999
        tampered=base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip('=')
        with self.assertRaises(ValueError):verify_key('.'.join((prefix,tampered,sig)),self.pub,self.device)
    def test_device_rejected(self):
        with self.assertRaisesRegex(ValueError,'kompüter'):verify_key(self.key,self.pub,'B'*64)
    def test_expiry(self):
        claims=verify_key(self.key,self.pub,self.device)
        with self.assertRaisesRegex(ValueError,'müddəti'):verify_key(self.key,self.pub,self.device,claims['expiresAt'])
    def test_future_issue(self):
        claims=verify_key(self.key,self.pub,self.device)
        with self.assertRaises(ValueError):verify_key(self.key,self.pub,self.device,claims['issuedAt']-301)
    def test_seats(self):
        result=self.cli('activate','--license',self.license,'--device','B'*64,'--out',str(self.root/'second.txt'),check=False)
        self.assertNotEqual(result.returncode,0);self.assertIn('Seat limit reached',result.stderr);self.assertFalse((self.root/'second.txt').exists())
    def test_reissue_same_seat(self):
        self.cli('activate','--license',self.license,'--device',self.device,'--out',str(self.root/'again.txt'))
        self.assertEqual(verify_key((self.root/'again.txt').read_text().strip(),self.pub,self.device)['licenseId'],self.license)
    def test_renew_preserves_remaining_time(self):
        new_id=self.cli('create','--customer','Renewal Test','--seats','1','--period','monthly').stdout.strip()
        before=next(s for s in json.loads((self.admin/'subscriptions.json').read_text())['subscriptions'] if s['id']==new_id)
        self.cli('renew','--license',new_id)
        after=next(s for s in json.loads((self.admin/'subscriptions.json').read_text())['subscriptions'] if s['id']==new_id)
        self.assertGreaterEqual(after['expiresAt']-before['expiresAt'],28*86400)
        self.assertLessEqual(after['expiresAt']-before['expiresAt'],31*86400)
    def test_activation_persists_and_rollback(self):
        data=self.root/'state';data.mkdir(exist_ok=True);config=self.root/'config.json';config.write_text(json.dumps({'licenseRequired':True}))
        service=ProductService(data,config,self.public,self.device);self.assertFalse(service.allowed());self.assertTrue(service.activate(self.key)['valid'])
        loaded=ProductService(data,config,self.public,self.device);self.assertTrue(loaded.allowed())
        with patch('radaz_product.time.time',return_value=time.time()-1000):self.assertFalse(loaded.allowed())
    def test_invalid_key_not_saved(self):
        data=self.root/'invalid';data.mkdir(exist_ok=True);config=self.root/'config2.json';config.write_text(json.dumps({'licenseRequired':True}))
        service=ProductService(data,config,self.public,self.device)
        with self.assertRaises(ValueError):service.activate('bad')
        self.assertFalse((data/'product/license.json').exists())
    def test_http_guard_and_activation(self):
        from radaz_archive import Archive,handler_for
        from http.server import ThreadingHTTPServer
        from threading import Thread
        from urllib.request import Request,urlopen
        from urllib.error import HTTPError
        data=self.root/'http';data.mkdir(exist_ok=True);config=self.root/'http-config.json';config.write_text(json.dumps({'licenseRequired':True}))
        product=ProductService(data,config,self.public,self.device)
        with patch('radaz_archive.ProductService',return_value=product): server=ThreadingHTTPServer(('127.0.0.1',0),handler_for(Archive(data)))
        thread=Thread(target=server.serve_forever,daemon=True);thread.start();base=f'http://127.0.0.1:{server.server_port}'
        try:
            self.assertFalse(json.load(urlopen(base+'/license'))['valid'])
            self.assertEqual(urlopen(base+'/studies').status,200)
            self.assertEqual(urlopen(base+'/status').status,200)
            self.assertEqual(json.load(urlopen(base+'/billing/catalog'))['monthly'],10)
            request=Request(base+'/print',data=b'{}',headers={'Content-Type':'application/json'})
            with self.assertRaises(HTTPError) as error:urlopen(request)
            self.assertEqual(error.exception.code,402)
            request=Request(base+'/license/activate',data=json.dumps({'key':self.key}).encode(),headers={'Content-Type':'application/json'})
            self.assertTrue(json.load(urlopen(request))['valid'])
            self.assertEqual(urlopen(base+'/studies').status,200)
            claims=verify_key(self.key,self.pub,self.device)
            with patch('radaz_product.time.time',return_value=claims['expiresAt']+1):
                self.assertEqual(urlopen(base+'/studies').status,200)
                request=Request(base+'/video',data=b'empty',headers={'Content-Type':'application/zip'})
                with self.assertRaises(HTTPError) as error:urlopen(request)
                self.assertEqual(error.exception.code,402)
        finally:server.shutdown();server.server_close();thread.join()

if __name__=='__main__':unittest.main()
