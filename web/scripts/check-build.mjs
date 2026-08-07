import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const diagramIds = ['buffer-frame-lifecycle', 'linearizability-overlap', 'version-chain-snapshot'];
const contentIndex = JSON.parse(await readFile(resolve(root, 'content/content-index.json'), 'utf8'));
const documentationEntries = contentIndex.entries.filter(
  entry => entry.documentation && entry.documentation.section !== 'landing',
);
const required = [
  ...contentIndex.entries.map(entry => entry.output_path),
  'robots.txt',
  'sitemap.xml',
  'site-manifest.json',
  'favicon.svg',
  'assets/main.js',
  'assets/main.css',
  'content/README.md',
  'content/content-index.json',
  'content/content.schema.json',
  'content/documentation-manifest.json',
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
assert.ok(css <= 210 * 1024, `CSS budget exceeded: ${css} bytes`);

for (const entry of contentIndex.entries) {
  const html = await readFile(resolve(root, entry.output_path), 'utf8');
  assert.doesNotMatch(
    html,
    /\{\{SITE_ORIGIN\}\}|PINEGA_PROJECT_META|PINEGA_DIAGRAM:|PINEGA_DOC_[A-Z_]+/u,
    `${entry.output_path} contains an unresolved build marker`,
  );
  assert.match(html, /\/assets\/main\.css/u);
  assert.match(html, /\/assets\/main\.js/u);
  assert.match(html, /<main\b/u);
  assert.equal((html.match(/<h1\b/gu) ?? []).length, 1, `${entry.output_path} must contain one h1`);
  assert.match(html, new RegExp(`<title>${escapeRegex(entry.canonical_title)}<\\/title>`, 'u'));
  assert.match(html, new RegExp(`<meta name="description" content="${escapeRegex(entry.summary)}">`, 'u'));
  if (entry.canonical) {
    assert.match(html, new RegExp(`<link rel="canonical" href="https:\/\/pinega\\.example${escapeRegex(entry.route)}">`, 'u'));
  } else {
    assert.doesNotMatch(html, /<link rel="canonical"/u);
  }
}

assert.equal(contentIndex.schema_version, 2);
const manifest = JSON.parse(await readFile(resolve(root, 'site-manifest.json'), 'utf8'));
assert.equal(manifest.site.tagline, 'Correctness under concurrency.');
assert.deepEqual(manifest.primaryNavigation, contentIndex.primary_navigation);
assert.deepEqual(manifest.routes.map(entry => entry.id), contentIndex.entries.map(entry => entry.id));
assert.deepEqual(manifest.routes.map(entry => entry.route), contentIndex.entries.map(entry => entry.route));
assert.deepEqual(
  manifest.routes.filter(entry => entry.sitemap).map(entry => entry.route),
  contentIndex.entries.filter(entry => entry.sitemap).map(entry => entry.route),
);
assert.deepEqual(
  manifest.routes.filter(entry => entry.searchable).map(entry => entry.route),
  contentIndex.entries.filter(entry => entry.searchable).map(entry => entry.route),
);
assert.deepEqual(manifest.diagrams.map(entry => entry.id).toSorted(), diagramIds.toSorted());

const docsManifest = JSON.parse(await readFile(resolve(root, 'content/documentation-manifest.json'), 'utf8'));
assert.equal(docsManifest.schema_version, 1);
assert.deepEqual(docsManifest.sections.map(section => section.id), ['start', 'how-to', 'concepts', 'reference', 'contributing']);
assert.deepEqual(docsManifest.entries.map(entry => entry.id), documentationEntries.map(entry => entry.id));
assert.deepEqual(docsManifest.entries.map(entry => entry.route), documentationEntries.map(entry => entry.route));
assert.equal(docsManifest.entries.length, 13);
for (const entry of docsManifest.entries) {
  assert.ok(entry.title && entry.summary && entry.section && entry.purpose && entry.appliesTo);
  assert.ok(Array.isArray(entry.topics));
  assert.ok(Array.isArray(entry.related));
  assert.ok(Array.isArray(entry.authors));
}

const docsLanding = await readFile(resolve(root, 'docs/index.html'), 'utf8');
assert.equal((docsLanding.match(/data-doc-card/gu) ?? []).length, 13);
assert.equal((docsLanding.match(/data-doc-group/gu) ?? []).length, 5);
assert.match(docsLanding, /13 pages/u);
assert.match(docsLanding, /Filter documentation topics/u);
assert.doesNotMatch(docsLanding, /Search documentation/u);

for (const entry of documentationEntries) {
  const html = await readFile(resolve(root, entry.output_path), 'utf8');
  assert.match(html, /<nav class="pinega-doc-navigation" aria-label="Documentation">/u, entry.route);
  assert.match(html, /<nav class="pinega-breadcrumbs" aria-label="Breadcrumb">/u, entry.route);
  assert.match(html, /data-doc-provenance/u, entry.route);
  assert.match(html, /Documentation stage/u, entry.route);
  assert.doesNotMatch(html, /<select[^>]*disabled/u, entry.route);
}

const publicNavigation = manifest.primaryNavigation.map(item => item.route ?? item.href);
assert.deepEqual(publicNavigation, ['/technology/', '/research/', '/docs/', '/about/', 'https://github.com/likern/research']);
assert.ok(!publicNavigation.includes('/component-lab/'));

const sitemap = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
for (const route of manifest.routes.filter(entry => entry.sitemap).map(entry => entry.route)) {
  assert.match(sitemap, new RegExp(`<loc>https:\/\/pinega\\.example${escapeRegex(route)}<\\/loc>`, 'u'));
}
assert.doesNotMatch(sitemap, /component-lab/u);

const home = await readFile(resolve(root, 'index.html'), 'utf8');
assert.match(home, /<h1>Correctness under concurrency\.<\/h1>/u);
assert.match(home, /Pinega Engine is\s+the first active implementation programme/u);

const architecture = await readFile(resolve(root, 'docs/concepts/pinega-engine-architecture/index.html'), 'utf8');
assert.match(architecture, /one PostgreSQL WAL/iu);
assert.match(architecture, /Pinega-owned shared buffer pool/u);

const research = await readFile(resolve(root, 'research/index.html'), 'utf8');
assert.equal((research.match(/class="pinega-semantic-diagram"/gu) ?? []).length, 3);
assert.equal((research.match(/role="img" aria-labelledby=/gu) ?? []).length, 3);

console.log(
  `Validated ${files.length} build files; JavaScript ${javascript} B, CSS ${css} B, pages ${contentIndex.entries.length}, docs ${documentationEntries.length}, diagrams ${diagramIds.length}.`,
);

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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
