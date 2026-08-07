import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = path => readFile(resolve(root, path), 'utf8');
const contentIndex = JSON.parse(await read('content/content-index.json'));
const contentSchema = JSON.parse(await read('content/content.schema.json'));
const entries = contentIndex.entries;
const routeMap = new Map(entries.map(entry => [entry.route, entry]));
const sourceByRoute = new Map(
  await Promise.all(entries.map(async entry => [entry.route, await read(entry.source_path)])),
);
const publicEntries = entries.filter(entry => entry.public);
const publicNavigation = contentIndex.primary_navigation.map(item => item.route ?? item.href);
const docsEntries = entries.filter(entry => entry.documentation && entry.documentation.section !== 'landing');
const expectedDocumentationRoutes = [
  '/docs/getting-started/',
  '/docs/start/project-overview/',
  '/docs/start/research-workspace/',
  '/docs/how-to/build-the-site/',
  '/docs/how-to/run-validation/',
  '/docs/concepts/pinega-programme/',
  '/docs/concepts/pinega-engine-architecture/',
  '/docs/concepts/maturity-and-evidence-labels/',
  '/docs/concepts/research-to-product-workflow/',
  '/docs/reference/repository-layout/',
  '/docs/reference/web-build-and-environment/',
  '/docs/reference/content-metadata-schema/',
  '/docs/contributing/review-and-release-gates/',
];
const expectedPublicRoutes = ['/', '/technology/', '/research/', '/docs/', ...expectedDocumentationRoutes, '/about/'];
const expectedPrimaryNavigation = [
  '/technology/',
  '/research/',
  '/docs/',
  '/about/',
  'https://github.com/likern/research',
];

test('content registry v2 is the unique route, discovery, and documentation contract', () => {
  assert.equal(contentIndex.schema_version, 2);
  assert.equal(contentSchema.properties.schema_version.const, 2);
  assert.ok(contentSchema.$defs.documentation);
  assert.equal(contentIndex.site.tagline, 'Correctness under concurrency.');
  assert.deepEqual(publicNavigation, expectedPrimaryNavigation);
  assert.equal(entries.length, 20);
  assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length);
  assert.equal(new Set(entries.map(entry => entry.route)).size, entries.length);
  assert.equal(new Set(entries.map(entry => entry.source_path)).size, entries.length);
  assert.equal(new Set(entries.map(entry => entry.output_path)).size, entries.length);
  assert.deepEqual(entries.filter(entry => entry.sitemap).map(entry => entry.route), expectedPublicRoutes);
  assert.deepEqual(entries.filter(entry => entry.searchable).map(entry => entry.route), expectedPublicRoutes);
});

test('documentation corpus contains real pages with one declared purpose', () => {
  assert.equal(docsEntries.length, 13);
  assert.deepEqual(docsEntries.map(entry => entry.route), expectedDocumentationRoutes);
  assert.deepEqual(
    [...new Set(docsEntries.map(entry => entry.documentation.section))],
    ['start', 'how-to', 'concepts', 'reference', 'contributing'],
  );
  assert.ok(!docsEntries.some(entry => entry.documentation.section === 'tutorials'), 'do not publish an empty Tutorials hierarchy');
  for (const entry of docsEntries) {
    assert.ok(entry.documentation.purpose !== 'index');
    assert.ok(entry.documentation.applies_to.length > 0);
    assert.ok(Array.isArray(entry.documentation.related));
    assert.equal(entry.public, true);
    assert.equal(entry.canonical, true);
    assert.equal(entry.searchable, true);
  }
});

test('registered pages preserve semantic HTML and registry metadata', () => {
  for (const entry of entries) {
    const html = sourceByRoute.get(entry.route);
    assert.match(html, /<!doctype html>/iu, `${entry.route} must declare HTML`);
    assert.match(html, new RegExp(`<html\\b[^>]*\\bdata-page="${escapeRegex(entry.id)}"`, 'u'));
    assert.match(html, new RegExp(`<title>${escapeRegex(entry.canonical_title)}<\\/title>`, 'u'));
    assert.match(html, new RegExp(`<meta name="description" content="${escapeRegex(entry.summary)}">`, 'u'));
    assert.equal((html.match(/<h1\b/gu) ?? []).length, 1, `${entry.route} must have one h1`);
    assert.match(html, /<main id="main-content"/u, `${entry.route} must have main content`);
    assert.match(html, /<!-- PINEGA_PROJECT_META -->/u, `${entry.route} must expose the private Pro boundary`);
    assert.doesNotMatch(html, /innerHTML\s*=/u, `${entry.route} must remain durable source HTML`);
    if (entry.canonical) {
      assert.match(html, new RegExp(`<link rel="canonical" href="\\{\\{SITE_ORIGIN\\}\\}${escapeRegex(entry.route)}">`, 'u'));
    } else {
      assert.doesNotMatch(html, /<link rel="canonical"/u);
    }
  }
});

test('all author-written internal routes and fragments resolve to registered durable content', () => {
  for (const entry of entries) {
    const html = sourceByRoute.get(entry.route);
    const links = [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gu)].map(match => match[1]);
    for (const href of links) {
      if (/^(?:https?:|mailto:|tel:)/u.test(href)) continue;
      const target = new URL(href, `https://pinega.example${entry.route}`);
      const targetEntry = routeMap.get(target.pathname);
      assert.ok(targetEntry, `${entry.source_path}: unresolved local route ${href}`);
      if (target.hash) {
        const targetHtml = sourceByRoute.get(target.pathname);
        const id = decodeURIComponent(target.hash.slice(1));
        assert.match(targetHtml, new RegExp(`\\bid="${escapeRegex(id)}"`, 'u'), `${entry.source_path}: unresolved fragment ${href}`);
      }
    }
  }
});

test('public navigation expresses the Pinega master-brand hierarchy', () => {
  for (const entry of publicEntries) {
    const html = sourceByRoute.get(entry.route);
    const navigation = html.match(/<nav\b[^>]*data-primary-navigation[^>]*>[\s\S]*?<\/nav>/u)?.[0];
    assert.ok(navigation, `${entry.route} must have primary navigation`);
    for (const destination of expectedPrimaryNavigation) {
      assert.match(navigation, new RegExp(`href="${escapeRegex(destination)}"`, 'u'));
    }
    assert.doesNotMatch(navigation, /\/component-lab\//u);
  }
});

test('documentation landing is generated from metadata rather than hard-coded cards', async () => {
  const docs = sourceByRoute.get('/docs/');
  const search = await read('src/components/doc-search/doc-search.ts');
  assert.equal((docs.match(/data-doc-card/gu) ?? []).length, 0);
  assert.match(docs, /<!-- PINEGA_DOC_COUNT -->/u);
  assert.match(docs, /<!-- PINEGA_DOC_CATALOGUE -->/u);
  assert.match(docs, /Filter documentation topics/u);
  assert.match(docs, /full-text search remains a later gate/u);
  assert.match(search, /normalize\('NFKC'\)/u);
  assert.match(search, /every\(term => haystack\.includes\(term\)\)/u);
  assert.match(search, /group\.hidden = cards\.length > 0 && cards\.every/u);
  assert.match(search, /pages`/u);
  assert.doesNotMatch(search, /innerHTML/u);
});

test('nested documentation sources expose build-time navigation, breadcrumb, and provenance slots', () => {
  for (const entry of docsEntries) {
    const html = sourceByRoute.get(entry.route);
    assert.match(html, /<!-- PINEGA_DOC_NAV -->/u, entry.route);
    assert.match(html, /<!-- PINEGA_BREADCRUMBS -->/u, entry.route);
    assert.match(html, /<!-- PINEGA_DOC_PROVENANCE -->/u, entry.route);
    assert.doesNotMatch(html, /<select[^>]*disabled/u, `${entry.route} must not expose a fake version selector`);
  }
});

test('getting started has been decomposed by purpose', () => {
  const gettingStarted = sourceByRoute.get('/docs/getting-started/');
  assert.match(gettingStarted, /Choose the documentation path that matches your task/u);
  assert.equal((gettingStarted.match(/<pinega-code-example/gu) ?? []).length, 0);
  for (const route of [
    '/docs/start/project-overview/',
    '/docs/start/research-workspace/',
    '/docs/how-to/build-the-site/',
    '/docs/concepts/pinega-engine-architecture/',
    '/docs/reference/repository-layout/',
  ]) assert.match(gettingStarted, new RegExp(escapeRegex(route), 'u'));
});

test('Pinega Engine explanation preserves accepted architecture boundaries without product claims', () => {
  const architecture = sourceByRoute.get('/docs/concepts/pinega-engine-architecture/');
  assert.match(architecture, /PostgreSQL 19/u);
  assert.match(architecture, /extension-only Table Access Method/u);
  assert.match(architecture, /out-of-place row versions/u);
  assert.match(architecture, /Pinega-owned shared buffer pool/u);
  assert.match(architecture, /one PostgreSQL WAL/u);
  assert.match(architecture, /not an installation guide/u);
  assert.match(architecture, /not a blanket claim/u);
});

test('build generates documentation discovery, navigation, breadcrumbs, and provenance', async () => {
  const build = await read('scripts/build.mjs');
  assert.match(build, /schema_version !== 2/u);
  assert.match(build, /renderDocumentationCatalogue/u);
  assert.match(build, /renderDocumentationNavigation/u);
  assert.match(build, /renderDocumentationBreadcrumbs/u);
  assert.match(build, /renderDocumentationProvenance/u);
  assert.match(build, /documentation-manifest\.json/u);
  assert.match(build, /documentation: page\.documentation \?\? null/u);
});

test('research and programme surfaces retain Gate 1 boundaries', () => {
  const home = sourceByRoute.get('/');
  const technology = sourceByRoute.get('/technology/');
  const research = sourceByRoute.get('/research/');
  const about = sourceByRoute.get('/about/');
  assert.match(home, /<h1>Correctness under concurrency\.<\/h1>/u);
  assert.match(home, /Pinega Engine is\s+the first active implementation programme/u);
  assert.match(technology, /One PostgreSQL WAL/u);
  assert.equal((research.match(/PINEGA_DIAGRAM:/gu) ?? []).length, 3);
  assert.match(about, /Pinega Labs is the working research/u);
});

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
