// Bundle only the production HTTP server. Workstations never install build tools.
import { createRequire } from 'node:module';
// esbuild is already a locked peer of Vite in this repository.
const { build } = createRequire(import.meta.resolve('vite'))('esbuild');
import { mkdirSync, cpSync, realpathSync, existsSync, lstatSync, unlinkSync } from 'node:fs';
import path from 'node:path';
mkdirSync('dist/runtime', { recursive: true });
await build({
  stdin: { contents: `import { startProdServer } from 'vinext/server/prod-server';
    await startProdServer({port:Number(process.env.RADAZ_WORKER_PORT||5175),host:'127.0.0.1'});`, resolveDir: process.cwd(), sourcefile: 'radaz-web-runtime.mjs' },
  outfile: 'dist/runtime/web-server.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node24',
  external: ['sharp'], banner: { js: "import {createRequire as __radazCreateRequire} from 'node:module'; const require=__radazCreateRequire(import.meta.url);" },
  logLevel: 'info',
});
// SSR deliberately keeps React external. Ship its small runtime dependency
// closure beside dist/server; no developer node_modules is needed on the PC.
const resolveRuntime = createRequire(import.meta.url);
for (const name of ['react', 'react-dom', 'scheduler']) {
  const resolver = name === 'scheduler' ? createRequire(resolveRuntime.resolve('react-dom/package.json')) : resolveRuntime;
  const source = realpathSync(path.dirname(resolver.resolve(name + '/package.json')));
  const destination = path.join('dist/node_modules', name);
  if(existsSync(destination) && lstatSync(destination).isSymbolicLink()) unlinkSync(destination);
  cpSync(source, destination, {recursive:true,dereference:true});
}
