import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const diagramIds = [
  'buffer-frame-lifecycle',
  'linearizability-overlap',
  'version-chain-snapshot',
];
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
  'diagrams/README.md',
  'diagrams/schema/diagram.schema.json',
  'diagrams/layouts/profiles.json',
  ...diagramIds.map(id => `diagrams/models/${id}.json`),
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
assert.ok(css <= 190 * 1024, `CSS budget exceeded: ${css} bytes`);

for (const path of required.filter(path => path.endsWith('.html'))) {
  const html = await readFile(resolve(root, path), 'utf8');
  assert.doesNotMatch(html, /\{\{SITE_ORIGIN\}\}|PINEGA_PROJECT_META|PINEGA_DIAGRAM:/u, `${path} contains an unresolved build marker`);
  assert.match(html, /\/assets\/main\.css/u, `${path} does not load the shared stylesheet`);
  assert.match(html, /\/assets\/main\.js/u, `${path} does not load the shared module`);
  assert.match(html, /<main\b/u, `${path} does not contain main content`);
}

const research = await readFile(resolve(root, 'research/index.html'), 'utf8');
assert.equal((research.match(/class="pinega-semantic-diagram"/gu) ?? []).length, 3, 'research page must contain three semantic diagrams');
assert.equal((research.match(/role="img" aria-labelledby=/gu) ?? []).length, 3, 'each semantic SVG must have an accessible image role and name');
assert.equal((research.match(/<title id="pinega-diagram-/gu) ?? []).length, 3, 'each semantic SVG must have a direct title');
assert.equal((research.match(/<desc id="pinega-diagram-/gu) ?? []).length, 3, 'each semantic SVG must have a direct description');
assert.equal((research.match(/data-layout-profile="production-v0\.2"/gu) ?? []).length, 6, 'each semantic figure and SVG must identify the accepted layout profile');

const manifest = JSON.parse(await readFile(resolve(root, 'site-manifest.json'), 'utf8'));
assert.deepEqual(manifest.diagrams.map(entry => entry.id).toSorted(), diagramIds.toSorted());

console.log(`Validated ${files.length} build files; JavaScript ${javascript} B, CSS ${css} B, diagrams ${diagramIds.length}.`);

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
