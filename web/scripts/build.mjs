import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const projectUrl = process.env.PINEGA_WEB_AWESOME_PROJECT_URL ?? '';

await import('../../design/scripts/build-tokens.mjs');
await mkdir(resolve(dist, 'assets'), { recursive: true });

await build({
  entryPoints: [resolve(root, 'src/main.ts')],
  outdir: resolve(dist, 'assets'),
  bundle: true,
  splitting: true,
  format: 'esm',
  target: ['es2022'],
  sourcemap: true,
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  assetNames: '[name]-[hash]',
  legalComments: 'eof',
  define: {
    __PINEGA_WEB_AWESOME_PROJECT_URL__: JSON.stringify(projectUrl),
  },
  logLevel: 'info',
});

const sourceHtml = await readFile(resolve(root, 'component-lab/index.html'), 'utf8');
const html = sourceHtml.replace(
  '<!-- PINEGA_PROJECT_META -->',
  projectUrl
    ? `<meta name="webawesome-project-url" content="${escapeHtml(projectUrl)}">`
    : '',
);
await writeFile(resolve(dist, 'index.html'), html, 'utf8');

const webAwesomeAssets = resolve(root, 'node_modules/@awesome.me/webawesome/dist/assets');
try {
  await cp(webAwesomeAssets, resolve(dist, 'assets/webawesome'), { recursive: true });
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

console.log(`Built Pinega Web Foundation at ${dist}`);

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
