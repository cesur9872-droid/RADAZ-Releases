// Ship the decoder WASM alongside the app so CD import also works offline.
import { createRequire } from 'node:module';
import { mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.resolve('@cornerstonejs/dicom-image-loader'));
const directory = fileURLToPath(new URL('../public/dicom-codecs/', import.meta.url));
mkdirSync(directory, { recursive: true });
for (const [module, name] of [
  ['@cornerstonejs/codec-openjpeg/decodewasm', 'openjpegwasm_decode.wasm'],
  ['@cornerstonejs/codec-openjph/wasm', 'openjphjs.wasm'],
  ['@cornerstonejs/codec-charls/decodewasm', 'charlswasm_decode.wasm'],
  ['@cornerstonejs/codec-libjpeg-turbo-8bit/decodewasm', 'libjpegturbowasm_decode.wasm'],
]) copyFileSync(require.resolve(module), directory + name);
const packageRequire = createRequire(import.meta.url);
copyFileSync(packageRequire.resolve('node-unrar-js/esm/js/unrar.wasm'), directory + 'unrar.wasm');
copyFileSync(packageRequire.resolve('node-unrar-js/LICENSE.md'), directory + 'unrar-LICENSE.md');
