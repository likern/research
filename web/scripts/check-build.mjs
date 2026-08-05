import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const required = [
  'index.html',
  'docs/index.html',
  'docs/getting-started/index.html',
  'research/index.html',
  'component-lab/index.html',
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'site-manifest.json',
  'favicon.svg',
  'assets/main.js',
  'assets/main.css',
];

for (const path of required) assert.ok(await isFile(resolve(root, path)), `Missing build output: ${path}`);

const files = await walk(root);
const totals = new Map();
for (const file of files) {
  const extension = extname(file);
  const size = (await stat(file)).size;
  totals.set(extension, (totals.get(extension) ?? 0) + size);
}

const javascript = totals.get('.js') ?? 0;
const css = totals.get('.css') ?? 0;
assert.ok(javascript <= 450 * 1024, `JavaScript budget exceeded: ${javascript} bytes`);
assert.ok(css <= 180 * 1024, `CSS budget exceeded: ${css} bytes`);

for (const path of required.filter(path => path.endsWith('.html'))) {
  const html = await readFile(resolve(root, path), 'utf8');
  assert.doesNotMatch(html, /\{\{SITE_ORIGIN\}\}|PINEGA_PROJECT_META/u, `${path} contains an unresolved build marker`);
  assert.match(html, /<main\b/u, `${path} does not contain main content`);
  assert.match(html, /\/assets\/main\.css/u, `${path} does not load the shared stylesheet`);
  assert.match(html, /\/assets\/main\.js/u, `${path} does not load the shared module`);
}

console.log(`Validated ${files.length} build files; JavaScript ${javascript} B, CSS ${css} B.`);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}
