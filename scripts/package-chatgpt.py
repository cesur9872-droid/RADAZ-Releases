"""Package exactly the extension source; fail if a declared script is missing."""
import json
import zipfile
from pathlib import Path
root=Path(__file__).resolve().parent.parent
source=root/'extensions/chatgpt'
manifest=json.loads((source/'manifest.json').read_text(encoding='utf-8'))
for group in manifest['content_scripts']:
    for script in group['js']:
        if not (source/script).is_file(): raise SystemExit(f'Missing extension script: {script}')
target=root/'public/radaz-chatgpt-extension.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(source.rglob('*')):
        if file.is_file(): archive.write(file,file.relative_to(source).as_posix())
with zipfile.ZipFile(target) as archive:
    assert json.loads(archive.read('manifest.json'))['version']==manifest['version']
    assert archive.testzip() is None
print(f'ChatGPT extension {manifest["version"]}: {target.stat().st_size} bytes; ZIP verified')
