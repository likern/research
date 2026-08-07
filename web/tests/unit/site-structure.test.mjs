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

const expectedPublicRoutes = [
  '/',
  '/technology/',
  '/research/',
  '/docs/',
  '/docs/getting-started/',
  '/about/',
];

const expectedPrimaryNavigation = [
  '/technology/',
  '/research/',
  '/docs/',
  '/about/',
  'https://github.com/likern/research',
];

test('content registry is the unique route and discovery contract', () => {
  assert.equal(contentIndex.schema_version, 1);
  assert.equal(contentSchema.properties.schema_version.const, 1);
  assert.equal(contentIndex.site.tagline, 'Correctness under concurrency.');
  assert.deepEqual(publicNavigation, expectedPrimaryNavigation);

  assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length);
  assert.equal(new Set(entries.map(entry => entry.route)).size, entries.length);
  assert.equal(new Set(entries.map(entry => entry.source_path)).size, entries.length);
  assert.equal(new Set(entries.map(entry => entry.output_path)).size, entries.length);

  assert.deepEqual(
    entries.filter(entry => entry.sitemap).map(entry => entry.route),
    expectedPublicRoutes,
  );
  assert.deepEqual(
    entries.filter(entry => entry.searchable).map(entry => entry.route),
    expectedPublicRoutes,
  );

  const componentLab = entries.find(entry => entry.id === 'component-lab');
  assert.ok(componentLab);
  assert.equal(componentLab.public, false);
  assert.equal(componentLab.canonical, false);
  assert.equal(componentLab.searchable, false);
  assert.equal(componentLab.sitemap, false);
  assert.ok(!publicNavigation.includes('/component-lab/'));
});

test('registered pages preserve semantic HTML and registry metadata', async () => {
  for (const entry of entries) {
    const html = sourceByRoute.get(entry.route);
    assert.match(html, /<!doctype html>/iu, `${entry.route} must declare HTML`);
    assert.match(
      html,
      new RegExp(`<html\\b[^>]*\\bdata-page="${escapeRegex(entry.id)}"`, 'u'),
      `${entry.route} must expose its registry identity`,
    );
    assert.match(
      html,
      new RegExp(`<title>${escapeRegex(entry.canonical_title)}<\\/title>`, 'u'),
      `${entry.route} title must match the registry`,
    );
    assert.match(
      html,
      new RegExp(`<meta name="description" content="${escapeRegex(entry.summary)}">`, 'u'),
      `${entry.route} description must match the registry`,
    );
    assert.equal((html.match(/<h1\b/gu) ?? []).length, 1, `${entry.route} must have one h1`);
    assert.match(html, /<main id="main-content"/u, `${entry.route} must have main content`);
    assert.match(html, /<!-- PINEGA_PROJECT_META -->/u, `${entry.route} must expose the private Pro boundary`);
    assert.doesNotMatch(html, /innerHTML\s*=/u, `${entry.route} must remain durable source HTML`);

    if (entry.canonical) {
      assert.match(
        html,
        new RegExp(`<link rel="canonical" href="\\{\\{SITE_ORIGIN\\}\\}${escapeRegex(entry.route)}">`, 'u'),
        `${entry.route} must have a canonical template`,
      );
    } else {
      assert.doesNotMatch(html, /<link rel="canonical"/u, `${entry.route} must remain non-canonical`);
    }
  }
});

test('all internal routes and fragments resolve to registered durable content', () => {
  for (const entry of entries) {
    const html = sourceByRoute.get(entry.route);
    const links = [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gu)].map(match => match[1]);

    for (const href of links) {
      if (/^(?:https?:|mailto:|tel:)/u.test(href)) continue;
      const target = new URL(href, `https://pinega.example${entry.route}`);
      const pathname = target.pathname;
      const targetEntry = routeMap.get(pathname);
      assert.ok(targetEntry, `${entry.source_path}: unresolved local route ${href}`);

      if (target.hash) {
        const targetHtml = sourceByRoute.get(pathname);
        const id = decodeURIComponent(target.hash.slice(1));
        assert.match(
          targetHtml,
          new RegExp(`\\bid="${escapeRegex(id)}"`, 'u'),
          `${entry.source_path}: unresolved fragment ${href}`,
        );
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
      assert.match(
        navigation,
        new RegExp(`href="${escapeRegex(destination)}"`, 'u'),
        `${entry.route} primary navigation misses ${destination}`,
      );
    }
    assert.doesNotMatch(navigation, /\/component-lab\//u);
    assert.doesNotMatch(navigation, /href="\/#architecture"/u);
  }
});

test('homepage presents Pinega as a programme and Pinega Engine as its first implementation', () => {
  const home = sourceByRoute.get('/');
  assert.match(home, /<h1>Correctness under concurrency\.<\/h1>/u);
  assert.match(home, /database-systems research into high-performance software/u);
  assert.match(home, /Pinega Engine is\s+the first active implementation programme/u);
  assert.match(home, /not yet a production release/u);
  assert.match(home, /Research and web platform/u);
  assert.match(home, /Optimisation, verification, and distributed systems/u);
  assert.doesNotMatch(home, /Pinega — a research-stage PostgreSQL storage engine/u);
});

test('technology and about pages own programme and company boundaries', () => {
  const technology = sourceByRoute.get('/technology/');
  const about = sourceByRoute.get('/about/');

  assert.match(technology, /id="pinega-engine"/u);
  assert.match(technology, /id="optimisation"/u);
  assert.match(technology, /id="verification"/u);
  assert.match(technology, /id="engine-architecture"/u);
  assert.match(technology, /One PostgreSQL WAL/u);
  assert.match(technology, /No item below is presented as a shipped product/u);

  assert.match(about, /Pinega is the master technology programme/u);
  assert.match(about, /Pinega Labs is the working research/u);
  assert.match(about, /There is no current production engine release/u);
  assert.match(about, /Correctness under concurrency/u);
});

test('research landing exposes the accepted area taxonomy', () => {
  const research = sourceByRoute.get('/research/');
  const areaSection = research.match(/<section class="pinega-section" id="research-areas"[\s\S]*?<\/section>/u)?.[0];
  assert.ok(areaSection);
  for (const title of [
    'Storage and execution',
    'Concurrency and memory reclamation',
    'Transactions and correctness',
    'Distributed systems',
    'Query optimisation and AI',
    'Performance engineering and hardware',
    'Verification and deterministic testing',
  ]) {
    assert.match(areaSection, new RegExp(escapeRegex(title), 'u'));
  }
  assert.equal((areaSection.match(/<article>/gu) ?? []).length, 7);
  assert.equal((research.match(/PINEGA_DIAGRAM:/gu) ?? []).length, 3);
});

test('documentation filter labels its actual topic-filter behaviour', async () => {
  const docs = sourceByRoute.get('/docs/');
  const search = await read('src/components/doc-search/doc-search.ts');

  assert.equal((docs.match(/data-doc-card/gu) ?? []).length, 8);
  assert.match(docs, /<h2 id="doc-filter-title">Filter documentation topics<\/h2>/u);
  assert.match(docs, /label="Filter documentation topics"/u);
  assert.doesNotMatch(docs, /label="Search documentation"/u);
  assert.match(docs, /data-content-type="start"/u);
  assert.match(docs, /data-content-type="how-to"/u);
  assert.match(docs, /data-content-type="explanation"/u);
  assert.match(docs, /data-content-type="reference"/u);
  assert.match(search, /card\.hidden = !matches/u);
  assert.doesNotMatch(search, /innerHTML/u);
});

test('the build derives routes and discovery metadata from the content registry', async () => {
  const build = await read('scripts/build.mjs');
  assert.match(build, /content\/content-index\.json/u);
  assert.match(build, /const pages = contentIndex\.entries\.map/u);
  assert.match(build, /validateContentIndex/u);
  assert.match(build, /validatePageSource/u);
  assert.match(build, /primaryNavigation: contentIndex\.primary_navigation/u);
  assert.match(build, /searchable: page\.searchable/u);
  assert.doesNotMatch(build, /const pages = \[/u);
});

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
