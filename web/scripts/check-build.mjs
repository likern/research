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
const contentIndex = JSON.parse(
  await readFile(resolve(root, 'content/content-index.json'), 'utf8'),
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
  'diagrams/README.md',
  'diagrams/schema/diagram.schema.json',
  'diagrams/layouts/profiles.json',
  ...diagramIds.map(id => `diagrams/models/${id}.json`),
];

for (const path of required) {
  assert.ok(await isFile(resolve(root, path)), `Missing build output: ${path}`);
}

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

for (const entry of contentIndex.entries) {
  const html = await readFile(resolve(root, entry.output_path), 'utf8');
  assert.doesNotMatch(
    html,
    /\{\{SITE_ORIGIN\}\}|PINEGA_PROJECT_META|PINEGA_DIAGRAM:/u,
    `${entry.output_path} contains an unresolved build marker`,
  );
  assert.match(html, /\/assets\/main\.css/u, `${entry.output_path} does not load the shared stylesheet`);
  assert.match(html, /\/assets\/main\.js/u, `${entry.output_path} does not load the shared module`);
  assert.match(html, /<main\b/u, `${entry.output_path} does not contain main content`);
  assert.equal((html.match(/<h1\b/gu) ?? []).length, 1, `${entry.output_path} must contain one h1`);
  assert.match(html, new RegExp(`<title>${escapeRegex(entry.canonical_title)}<\\/title>`, 'u'));
  assert.match(
    html,
    new RegExp(`<meta name="description" content="${escapeRegex(entry.summary)}">`, 'u'),
  );

  if (entry.canonical) {
    assert.match(
      html,
      new RegExp(`<link rel="canonical" href="https:\/\/pinega\\.example${escapeRegex(entry.route)}">`, 'u'),
      `${entry.output_path} has no generated canonical URL`,
    );
  } else {
    assert.doesNotMatch(html, /<link rel="canonical"/u, `${entry.output_path} must remain non-canonical`);
  }
}

const manifest = JSON.parse(await readFile(resolve(root, 'site-manifest.json'), 'utf8'));
assert.equal(manifest.site.tagline, 'Correctness under concurrency.');
assert.deepEqual(manifest.primaryNavigation, contentIndex.primary_navigation);
assert.deepEqual(
  manifest.routes.map(entry => entry.id),
  contentIndex.entries.map(entry => entry.id),
);
assert.deepEqual(
  manifest.routes.map(entry => entry.route),
  contentIndex.entries.map(entry => entry.route),
);
assert.deepEqual(
  manifest.routes.filter(entry => entry.sitemap).map(entry => entry.route),
  ['/', '/technology/', '/research/', '/docs/', '/docs/getting-started/', '/about/'],
);
assert.deepEqual(
  manifest.routes.filter(entry => entry.searchable).map(entry => entry.id),
  ['home', 'technology', 'research', 'documentation', 'getting-started', 'about'],
);
assert.deepEqual(manifest.diagrams.map(entry => entry.id).toSorted(), diagramIds.toSorted());

const publicNavigation = manifest.primaryNavigation.map(item => item.route ?? item.href);
assert.deepEqual(publicNavigation, [
  '/technology/',
  '/research/',
  '/docs/',
  '/about/',
  'https://github.com/likern/research',
]);
assert.ok(!publicNavigation.includes('/component-lab/'));

const sitemap = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
for (const route of manifest.routes.filter(entry => entry.sitemap).map(entry => entry.route)) {
  assert.match(sitemap, new RegExp(`<loc>https:\/\/pinega\\.example${escapeRegex(route)}<\\/loc>`, 'u'));
}
assert.doesNotMatch(sitemap, /component-lab/u);

const home = await readFile(resolve(root, 'index.html'), 'utf8');
assert.match(home, /<h1>Correctness under concurrency\.<\/h1>/u);
assert.match(home, /Pinega Engine is\s+the first active implementation programme/u);
assert.doesNotMatch(home, /href="\/component-lab\/"/u);

const technology = await readFile(resolve(root, 'technology/index.html'), 'utf8');
assert.match(technology, /id="pinega-engine"/u);
assert.match(technology, /id="engine-architecture"/u);
assert.match(technology, /One PostgreSQL WAL/u);

const research = await readFile(resolve(root, 'research/index.html'), 'utf8');
assert.equal((research.match(/class="pinega-semantic-diagram"/gu) ?? []).length, 3, 'research page must contain three semantic diagrams');
assert.equal((research.match(/role="img" aria-labelledby=/gu) ?? []).length, 3, 'each semantic SVG must have an accessible image role and name');
assert.equal((research.match(/<title id="pinega-diagram-/gu) ?? []).length, 3, 'each semantic SVG must have a direct title');
assert.equal((research.match(/<desc id="pinega-diagram-/gu) ?? []).length, 3, 'each semantic SVG must have a direct description');
assert.equal((research.match(/data-layout-profile="production-v0\.2"/gu) ?? []).length, 6, 'each semantic figure and SVG must identify the accepted layout profile');

const componentLab = await readFile(resolve(root, 'component-lab/index.html'), 'utf8');
assert.match(componentLab, /data-page="component-lab"/u);
assert.doesNotMatch(componentLab, /<link rel="canonical"/u);

console.log(
  `Validated ${files.length} build files; JavaScript ${javascript} B, CSS ${css} B, pages ${contentIndex.entries.length}, diagrams ${diagramIds.length}.`,
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
