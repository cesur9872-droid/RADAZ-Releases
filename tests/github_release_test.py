"""Release publication must never expose incomplete or changed assets."""
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('github_release', Path(__file__).resolve().parents[1] / 'scripts/github-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
VERSION = '0.2.4'
COMMIT = 'a' * 40


class FakeGitHub:
    def __init__(self, existing=None, latest=None, corrupt=False):
        self.existing, self.latest, self.corrupt = existing, latest, corrupt
        self.calls = []

    def request(self, path, method='GET', payload=None, missing=False, upload=None):
        self.calls.append((method, path, payload))
        if method == 'GET':
            return self.latest if path == '/releases/latest' else self.existing
        if method == 'POST' and path == '/releases':
            return {'id': 7, 'assets': [], **payload}
        if upload:
            digest = 'bad' if self.corrupt else 'sha256:' + hashlib.sha256(upload.read_bytes()).hexdigest()
            return {'state': 'uploaded', 'digest': digest}
        if method == 'PATCH':
            return {'html_url': 'https://github.com/example/radaz/releases/tag/v0.2.4', **payload}
        raise AssertionError(f'Unexpected API request: {method} {path}')


class Releases(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'outputs/releases').mkdir(parents=True)
        (self.root / 'releases').mkdir()
        (self.root / f'releases/{VERSION}.md').write_text('Synthetic release', encoding='utf-8')
        self.archive = self.root / f'outputs/releases/RADAZ-{VERSION}-Windows-preview.zip'
        files = {'public/product.json': json.dumps({'version': VERSION, 'licenseRequired': True}).encode(),
                 'package.json': json.dumps({'version': VERSION}).encode()}
        with ZipFile(self.archive, 'w') as package:
            for name, data in files.items():
                package.writestr(name, data)
            package.writestr('SHA256SUMS.json', json.dumps({name: hashlib.sha256(data).hexdigest() for name, data in files.items()}))
        self.checksum = self.archive.with_suffix('.zip.sha256')
        self.checksum.write_text(f'{hashlib.sha256(self.archive.read_bytes()).hexdigest()}  {self.archive.name}\n')

    def tearDown(self):
        self.temp.cleanup()

    def test_first_release_is_planned(self):
        self.assertTrue(release.release_plan(FakeGitHub(), VERSION))

    def test_published_version_is_skipped_and_not_overwritten(self):
        published = {'draft': False, 'prerelease': False, 'assets': [
            {'name': f.name, 'state': 'uploaded'} for f in (self.archive, self.checksum)]}
        api = FakeGitHub(existing=published)
        self.assertFalse(release.release_plan(api, VERSION))
        with self.assertRaisesRegex(ValueError, 'overwrite'):
            release.publish(api, self.root, VERSION, COMMIT)
        self.assertTrue(all(method == 'GET' for method, _, _ in api.calls))

    def test_cannot_regress_latest_version(self):
        with self.assertRaisesRegex(ValueError, 'greater'):
            release.release_plan(FakeGitHub(latest={'tag_name': 'v0.2.5'}), VERSION)

    def test_corrupt_package_is_rejected_before_network_write(self):
        self.archive.write_bytes(self.archive.read_bytes() + b'altered')
        api = FakeGitHub()
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            release.publish(api, self.root, VERSION, COMMIT)
        self.assertEqual(api.calls, [])

    def test_upload_failure_leaves_release_as_draft(self):
        api = FakeGitHub(corrupt=True)
        with self.assertRaisesRegex(ValueError, 'verification failed'):
            release.publish(api, self.root, VERSION, COMMIT)
        self.assertFalse(any(method == 'PATCH' for method, _, _ in api.calls))

    def test_both_assets_are_verified_before_publishing_latest(self):
        api = FakeGitHub()
        release.publish(api, self.root, VERSION, COMMIT)
        self.assertEqual([method for method, _, _ in api.calls], ['GET', 'POST', 'POST', 'POST', 'PATCH'])
        self.assertTrue(api.calls[1][2]['draft'])
        self.assertEqual(api.calls[1][2]['target_commitish'], COMMIT)
        self.assertFalse(api.calls[-1][2]['draft'])
        self.assertEqual(api.calls[-1][2]['make_latest'], 'true')

    def test_draft_from_different_commit_is_not_modified(self):
        api = FakeGitHub(existing={'draft': True, 'target_commitish': 'b' * 40})
        with self.assertRaisesRegex(ValueError, 'different source commit'):
            release.publish(api, self.root, VERSION, COMMIT)
        self.assertEqual(len(api.calls), 1)

    def test_binary_repository_tag_uses_its_own_commit_and_preserves_source_provenance(self):
        api = FakeGitHub()
        release.publish(api, self.root, VERSION, COMMIT, 'b' * 40)
        self.assertEqual(api.calls[1][2]['target_commitish'], 'b' * 40)
        self.assertIn(COMMIT, api.calls[-1][2]['body'])

    def test_source_workflow_can_publish_to_separate_binary_repository(self):
        (self.root/'public').mkdir()
        (self.root/'public/product.json').write_text(json.dumps({'version':VERSION,'repository':'owner/source','updateRepository':'owner/binaries'}))
        with patch.dict('os.environ',{'GITHUB_REPOSITORY':'owner/source'}):
            self.assertEqual(release.config(self.root)['updateRepository'], 'owner/binaries')
        with patch.dict('os.environ',{'GITHUB_REPOSITORY':'wrong/source'}), self.assertRaisesRegex(ValueError,'source repository'):
            release.config(self.root)


if __name__ == '__main__':
    unittest.main()
