import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const diagramIds = ['buffer-frame-lifecycle', 'linearizability-overlap', 'version-chain-snapshot'];
const contentIndex = JSON.parse(await readFile(resolve(root, 'content/content-index.json'), 'utf8'));
const localeMessages = Object.fromEntries(await Promise.all(Object.keys(contentIndex.site.locales).map(async locale => [
  locale,
  JSON.parse(await readFile(resolve(root, `content/messages/${locale}.json`), 'utf8')),
])));
const variants = contentIndex.entries.flatMap(entry => Object.entries(entry.locales).map(([locale, localized]) => ({
  ...entry,
  ...localized,
  locale,
  documentation: entry.documentation ? { ...entry.documentation, ...localized.documentation } : undefined,
  translations: Object.fromEntries(Object.entries(entry.locales).map(([translationLocale, translation]) => [translationLocale, translation.route])),
})));
const documentationEntries = variants.filter(entry => entry.locale === 'en' && entry.documentation && entry.documentation.section !== 'landing');
const required = [
  ...variants.map(entry => entry.output_path),
  'robots.txt',
  'sitemap.xml',
  'site-manifest.json',
  'favicon.svg',
  'assets/main.js',
  'assets/main.css',
  'content/README.md',
  'content/content-index.json',
  'content/content.schema.json',
  ...Object.keys(contentIndex.site.locales).flatMap(locale => [
    `content/messages/${locale}.json`,
    `content/${locale}/documentation-manifest.json`,
  ]),
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

for (const entry of variants) {
  const html = await readFile(resolve(root, entry.output_path), 'utf8');
  assert.doesNotMatch(html, /\{\{SITE_ORIGIN\}\}|PINEGA_PROJECT_META|PINEGA_DIAGRAM:|PINEGA_DOC_[A-Z_]+|PINEGA_LANGUAGE_SWITCHER/u, `${entry.output_path} contains an unresolved build marker`);
  assert.match(html, /\/assets\/main\.css/u);
  assert.match(html, /\/assets\/main\.js/u);
  assert.match(html, /<main\b/u);
  assert.match(html, new RegExp(`<html\\b[^>]*\\blang="${escapeRegex(entry.locale)}"`, 'u'));
  assert.match(html, new RegExp(`<html\\b[^>]*\\bdata-locale="${escapeRegex(entry.locale)}"`, 'u'));
  assert.equal((html.match(/<h1\b/gu) ?? []).length, 1, `${entry.output_path} must contain one h1`);
  assert.match(html, new RegExp(`<title>${escapeRegex(entry.canonical_title)}<\\/title>`, 'u'));
  assert.match(html, new RegExp(`<meta name="description" content="${escapeRegex(entry.summary)}">`, 'u'));
  assert.match(html, new RegExp(`<nav class="pinega-language-switcher" aria-label="${escapeRegex(localeMessages[entry.locale].navigation.language)}">`, 'u'));
  for (const [locale, metadata] of Object.entries(contentIndex.site.locales)) {
    const label = `<span lang="${metadata.lang}" dir="${metadata.direction}" translate="no">${metadata.label}</span>`;
    if (locale === entry.locale) {
      assert.match(html, new RegExp(`<span class="pinega-language-option" aria-current="page">${escapeRegex(label)}<\/span>`, 'u'));
    } else if (entry.translations[locale]) {
      assert.match(html, new RegExp(`<a class="pinega-language-option" href="${escapeRegex(entry.translations[locale])}" hreflang="${escapeRegex(metadata.lang)}">${escapeRegex(label)}<\/a>`, 'u'));
    } else {
      const noticeId = `pinega-translation-unavailable-${locale}`;
      const message = localeMessages[entry.locale].navigation.translation_unavailable[locale];
      assert.match(html, new RegExp(`<a class="pinega-language-option" href="#${noticeId}" data-translation-unavailable aria-controls="${noticeId}">${escapeRegex(label)}<\/a>`, 'u'));
      assert.match(html, new RegExp(`<aside class="pinega-translation-notice" id="${noticeId}" data-translation-notice role="status"[^>]*>[\\s\\S]*${escapeRegex(message)}`, 'u'));
    }
  }
  if (entry.canonical) {
    assert.match(html, new RegExp(`<link rel="canonical" href="https:\/\/pinega\\.example${escapeRegex(entry.route)}">`, 'u'));
    for (const [locale, route] of Object.entries(entry.translations)) {
      assert.match(html, new RegExp(`<link rel="alternate" hreflang="${escapeRegex(locale)}" href="https:\/\/pinega\\.example${escapeRegex(route)}">`, 'u'));
    }
    assert.match(html, /<link rel="alternate" hreflang="x-default"/u);
  } else {
    assert.doesNotMatch(html, /<link rel="canonical"/u);
  }
}

assert.equal(contentIndex.schema_version, 3);
assert.equal(contentIndex.site.default_locale, 'en');
assert.deepEqual(Object.keys(contentIndex.site.locales), ['en', 'ru']);
const manifest = JSON.parse(await readFile(resolve(root, 'site-manifest.json'), 'utf8'));
assert.equal(manifest.schemaVersion, 3);
assert.equal(manifest.site.tagline, 'Correctness under concurrency.');
assert.equal(manifest.site.defaultLocale, 'en');
assert.deepEqual(manifest.routes.map(entry => `${entry.id}:${entry.locale}`), variants.map(entry => `${entry.id}:${entry.locale}`));
assert.deepEqual(manifest.routes.map(entry => entry.route), variants.map(entry => entry.route));
assert.deepEqual(manifest.routes.filter(entry => entry.sitemap).map(entry => entry.route), variants.filter(entry => entry.sitemap).map(entry => entry.route));
assert.deepEqual(manifest.routes.filter(entry => entry.searchable).map(entry => entry.route), variants.filter(entry => entry.searchable).map(entry => entry.route));
assert.deepEqual(manifest.diagrams.map(entry => entry.id).toSorted(), diagramIds.toSorted());

const englishDocsManifest = JSON.parse(await readFile(resolve(root, 'content/en/documentation-manifest.json'), 'utf8'));
assert.equal(englishDocsManifest.schema_version, 2);
assert.equal(englishDocsManifest.locale, 'en');
assert.deepEqual(englishDocsManifest.sections.map(section => section.id), ['start', 'how-to', 'concepts', 'reference', 'contributing']);
assert.deepEqual(englishDocsManifest.entries.map(entry => entry.id), documentationEntries.map(entry => entry.id));
assert.deepEqual(englishDocsManifest.entries.map(entry => entry.route), documentationEntries.map(entry => entry.route));
assert.equal(englishDocsManifest.entries.length, 13);
for (const entry of englishDocsManifest.entries) {
  assert.ok(entry.title && entry.summary && entry.section && entry.purpose && entry.appliesTo);
  assert.ok(Array.isArray(entry.topics));
  assert.ok(Array.isArray(entry.related));
  assert.ok(Array.isArray(entry.authors));
}

const russianDocsManifest = JSON.parse(await readFile(resolve(root, 'content/ru/documentation-manifest.json'), 'utf8'));
assert.equal(russianDocsManifest.schema_version, 2);
assert.equal(russianDocsManifest.locale, 'ru');
assert.deepEqual(russianDocsManifest.sections, []);
assert.deepEqual(russianDocsManifest.entries, []);

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

const publicNavigation = manifest.site.locales.en.primaryNavigation.map(item => item.route ?? item.href);
assert.deepEqual(publicNavigation, ['/technology/', '/research/', '/docs/', '/about/', 'https://github.com/likern/research']);
assert.ok(!publicNavigation.includes('/component-lab/'));
assert.ok(manifest.site.locales.ru.primaryNavigation.filter(item => item.entryId).every(item => item.route === null));

const sitemap = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
for (const route of manifest.routes.filter(entry => entry.sitemap).map(entry => entry.route)) {
  assert.match(sitemap, new RegExp(`<loc>https:\/\/pinega\\.example${escapeRegex(route)}<\\/loc>`, 'u'));
}
assert.doesNotMatch(sitemap, /component-lab|\/ru\//u);

const home = await readFile(resolve(root, 'index.html'), 'utf8');
assert.match(home, /<h1>Correctness under concurrency\.<\/h1>/u);
assert.match(home, /Pinega Engine is\s+the first active implementation programme/u);
assert.match(home, /href="#pinega-translation-unavailable-ru" data-translation-unavailable/u);
assert.match(home, /A Russian translation of this page is not available\. You are staying on the current page\./u);
assert.doesNotMatch(home, /<link rel="alternate" hreflang="ru"/u);

const russianNotFound = await readFile(resolve(root, 'ru/404.html'), 'utf8');
assert.match(russianNotFound, /<html\b[^>]*lang="ru"/u);
assert.match(russianNotFound, /aria-label="Язык"/u);
assert.match(russianNotFound, /href="\/404\.html" hreflang="en"><span lang="en"/u);
assert.match(russianNotFound, /aria-current="page"><span lang="ru"/u);
assert.doesNotMatch(russianNotFound, /data-translation-unavailable/u);
assert.match(russianNotFound, /Использовать тёмную тему/u);

const architecture = await readFile(resolve(root, 'docs/concepts/pinega-engine-architecture/index.html'), 'utf8');
assert.match(architecture, /one PostgreSQL WAL/iu);
assert.match(architecture, /Pinega-owned shared buffer pool/u);

const research = await readFile(resolve(root, 'research/index.html'), 'utf8');
assert.equal((research.match(/class="pinega-semantic-diagram"/gu) ?? []).length, 3);
assert.equal((research.match(/role="img" aria-labelledby=/gu) ?? []).length, 3);

console.log(`Validated ${files.length} build files; JavaScript ${javascript} B, CSS ${css} B, content items ${contentIndex.entries.length}, locale variants ${variants.length}, English docs ${documentationEntries.length}, diagrams ${diagramIds.length}.`);

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
