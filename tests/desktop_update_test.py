"""No real releases or clinical data: validate updater failures and atomic activation."""
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile
from urllib.error import HTTPError, URLError

spec = importlib.util.spec_from_file_location('desktop', Path(__file__).resolve().parents[1] / 'bridge/radaz_desktop.py')
desktop = importlib.util.module_from_spec(spec); spec.loader.exec_module(desktop)

class DesktopUpdates(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)
        desktop.atomic_json(self.root / 'active.json', {'version':'0.2.8'})
        self.target = '0.2.9'
        self.files = {
            'public/product.json':json.dumps({'name':'RADAZ','version':self.target,'repository':desktop.REPOSITORY,'licenseRequired':True}).encode(),
            'desktop.json':json.dumps({'schema':1,'version':self.target,'architecture':'x64'}).encode(),
            'dist/server/radaz-build.json':json.dumps({'product':{'version':self.target},'buildId':'synthetic'}).encode(),
            **{name:b'synthetic' for name in ['runtime/node/node.exe','runtime/python/python.exe','dist/runtime/web-server.mjs','bridge/radaz_desktop.py','installer/launcher.ps1']},
        }
        self.archive = self.root / 'test.zip'

    def tearDown(self): self.temp.cleanup()

    def package(self, extras=None):
        files = {**self.files, **(extras or {})}
        with ZipFile(self.archive, 'w') as package:
            for name,data in files.items(): package.writestr(name,data)
            package.writestr('SHA256SUMS.json', json.dumps({name:hashlib.sha256(data).hexdigest() for name,data in files.items()}))
        return hashlib.sha256(self.archive.read_bytes()).hexdigest(), self.archive.stat().st_size

    def stage(self, extras=None):
        digest,size = self.package(extras)
        desktop.stage_package(self.root,self.archive,self.target,digest,size)

    def test_download_stages_without_changing_active_installation(self):
        self.stage()
        self.assertEqual(desktop.read_json(self.root/'active.json')['version'],'0.2.8')
        self.assertEqual(desktop.read_json(self.root/'pending.json')['version'],'0.2.9')
        self.assertEqual(desktop.read_json(self.root/'update-state.json')['state'],'ready')
        desktop.validate_directory(self.root/'versions/0.2.9','0.2.9')

    def test_staging_reports_real_extraction_progress_and_completion(self):
        updates=[]
        original=desktop.state
        def record(*args, **kwargs):
            original(*args, **kwargs)
            updates.append(desktop.read_json(self.root/'update-state.json'))
        with patch.object(desktop,'state',side_effect=record): self.stage()
        self.assertEqual(updates[0]['state'],'verifying')
        installing=[entry for entry in updates if entry['state']=='installing']
        self.assertTrue(installing)
        self.assertEqual(installing[-1]['progress']['done'],installing[-1]['progress']['total'])
        self.assertEqual(updates[-1]['state'],'ready')
        self.assertEqual(updates[-1]['progress'],{'done':1,'total':1,'unit':'yeniləmə'})

    def test_corrupt_download_preserves_active_and_does_not_stage(self):
        digest,size=self.package()
        with self.assertRaisesRegex(ValueError,'SHA-256'):
            desktop.stage_package(self.root,self.archive,self.target,'0'*64,size)
        self.assertFalse((self.root/'pending.json').exists())
        self.assertEqual(desktop.read_json(self.root/'active.json')['version'],'0.2.8')

    def test_rejects_zip_slip_windows_alias_and_case_collisions(self):
        for name in ('../escape','/absolute','runtime\\escape','runtime/C:stream','runtime/NUL','runtime/node/NODE.exe'):
            with self.subTest(name=name), self.assertRaises(ValueError): self.stage({name:b'bad'})
        self.assertFalse((self.root/'pending.json').exists())

    def test_missing_runtime_and_mismatched_build_are_rejected(self):
        del self.files['runtime/node/node.exe']
        with self.assertRaisesRegex(ValueError,'missing'): self.stage()
        self.files['runtime/node/node.exe']=b'node'
        self.files['dist/server/radaz-build.json']=b'{"product":{"version":"9.0.0"}}'
        with self.assertRaisesRegex(ValueError,'Build version'): self.stage()

    def test_only_new_complete_release_on_fixed_repository_is_accepted(self):
        asset={'name':'RADAZ-0.2.9-Windows-x64.zip','state':'uploaded','size':123,'digest':'sha256:'+'a'*64,
               'browser_download_url':f'https://github.com/{desktop.UPDATE_REPOSITORY}/releases/download/v0.2.9/RADAZ-0.2.9-Windows-x64.zip'}
        release={'tag_name':'v0.2.9','draft':False,'prerelease':False,'assets':[asset]}
        self.assertEqual(desktop.select_asset(release,'0.2.8')[0],'0.2.9')
        self.assertIsNone(desktop.select_asset(release,'0.2.9'))
        for mutation in ({'draft':True},{'prerelease':True},{'assets':[]},{'assets':[{**asset,'digest':None}]},{'assets':[{**asset,'browser_download_url':'https://example.com/payload.zip'}]}):
            with self.subTest(mutation=mutation),self.assertRaises(ValueError): desktop.select_asset({**release,**mutation},'0.2.8')

    def test_successful_launch_switches_pointer_only_after_health_check(self):
        self.stage()
        def start(root,target):
            self.assertEqual(desktop.read_json(root/'active.json')['version'],'0.2.8')
            return 'synthetic'
        with patch.object(desktop,'open_version',side_effect=start),patch.object(desktop,'run_hidden'):
            desktop.launch(self.root,no_browser=True)
        self.assertEqual(desktop.read_json(self.root/'active.json'),{'version':'0.2.9','previousVersion':'0.2.8'})
        self.assertFalse((self.root/'pending.json').exists())

    def test_update_feed_is_separate_from_legacy_product_identity(self):
        self.assertNotEqual(desktop.UPDATE_REPOSITORY, desktop.REPOSITORY)
        with patch.object(desktop, 'get_json', return_value={'tag_name':'v0.2.8'}) as request:
            desktop.check_update(self.root)
        self.assertIn(desktop.UPDATE_REPOSITORY, request.call_args.args[0])
        self.assertEqual(desktop.read_json(self.root/'update-state.json')['state'], 'current')
        self.stage()  # Existing installations still validate the original product identity.

    def test_feed_failures_are_not_reported_as_current(self):
        self.assertIn('404', desktop.update_error_message(HTTPError('https://api.github.com',404,'missing',{},None)))
        self.assertIn('GitHub', desktop.update_error_message(HTTPError('https://api.github.com',403,'limited',{},None)))
        self.assertIn('İnternet', desktop.update_error_message(URLError('offline')))

    def test_failed_health_check_rolls_back_and_does_not_retry_broken_release(self):
        self.stage()
        with patch.object(desktop,'open_version',side_effect=[RuntimeError('bad runtime'),'old-build']) as start,patch.object(desktop,'run_hidden'):
            desktop.launch(self.root,no_browser=True)
        self.assertEqual([call.args[1] for call in start.call_args_list],['0.2.9','0.2.8'])
        self.assertEqual(desktop.read_json(self.root/'active.json')['version'],'0.2.8')
        self.assertEqual(desktop.read_json(self.root/'failed-update.json')['version'],'0.2.9')

    def test_receiving_archive_defers_update_instead_of_marking_it_broken(self):
        self.stage()
        with patch.object(desktop,'open_version',side_effect=[desktop.ArchiveBusy(),'old-build']),patch.object(desktop,'run_hidden'):
            desktop.launch(self.root,no_browser=True)
        self.assertEqual(desktop.read_json(self.root/'active.json')['version'],'0.2.8')
        self.assertTrue((self.root/'pending.json').exists())
        self.assertFalse((self.root/'failed-update.json').exists())

if __name__=='__main__': unittest.main()
