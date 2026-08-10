import assert from 'node:assert/strict';
import { version as esbuildVersion } from 'esbuild';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BUILD_ID_ALGORITHM,
  DOCUMENT_CONTRACT_VERSION,
  LIT_ISLAND_POLICY,
  NATIVE_NAVIGATION_ROUTE_IDS,
  ROUTE_FEATURE_DEFINITIONS,
  ROUTE_OWNED_METADATA,
  SHELL_VERSION,
} from '../navigation/contract.mjs';
import {
  DEFAULT_PREFETCH_MAX_CONCURRENCY,
  DEFAULT_PREFETCH_MAX_QUEUE,
  HOVER_PREFETCH_DELAY_MS,
  SLOW_EFFECTIVE_CONNECTION_TYPES,
} from '../navigation/prefetch.mjs';
import { verifyBuildIdentity } from './lib/build-identity.mjs';
import { validateDocumentContract } from './lib/document-contract.mjs';
import { createRouteRequestManifest, createVerifiedFeatureGraph } from './lib/feature-graph.mjs';
import {
  IMMUTABLE_CACHE_CONTROL,
  RELEASE_MANIFEST_PATH,
  REVALIDATED_CACHE_CONTROL,
  isFingerprintedAssetPath,
  verifyReleaseManifest,
} from './lib/release-contract.mjs';

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
const russianDocumentationEntries = variants.filter(entry => entry.locale === 'ru' && entry.documentation && entry.documentation.section !== 'landing');
const manifest = JSON.parse(await readFile(resolve(root, 'site-manifest.json'), 'utf8'));
const featureGraphPath = artifactPathFromUrl(manifest.navigation?.featureGraph?.assetManifest);
const bundleManifestPath = artifactPathFromUrl(manifest.navigation?.featureGraph?.bundleManifest);
const featureGraph = JSON.parse(await readFile(resolve(root, featureGraphPath), 'utf8'));
const bundleManifest = JSON.parse(await readFile(resolve(root, bundleManifestPath), 'utf8'));
const releaseManifest = JSON.parse(await readFile(resolve(root, RELEASE_MANIFEST_PATH), 'utf8'));
const faviconPath = releaseManifest.files.find(entry => /^assets\/static\/favicon-(?:[A-Z0-9]{8}|[a-f0-9]{16})\.svg$/u.test(entry.path))?.path;
assert.ok(faviconPath, 'Release manifest must expose one fingerprinted favicon.');
const required = [
  ...variants.map(entry => entry.output_path),
  'robots.txt',
  'sitemap.xml',
  'site-manifest.json',
  '_headers',
  RELEASE_MANIFEST_PATH,
  faviconPath,
  featureGraphPath,
  bundleManifestPath,
  featureGraph.entry.script.slice(1),
  featureGraph.entry.stylesheet.slice(1),
  'content/README.md',
  'content/content-index.json',
  'content/content.schema.json',
  'content/localization-policy.md',
  'content/localization-review.ru.md',
  'content/terminology.ru.json',
  ...Object.keys(contentIndex.site.locales).flatMap(locale => [
    `content/messages/${locale}.json`,
    `content/${locale}/documentation-manifest.json`,
  ]),
  'diagrams/README.md',
  'diagrams/schema/diagram.schema.json',
  'diagrams/layouts/profiles.json',
  ...diagramIds.map(id => `diagrams/models/${id}.json`),
  ...diagramIds.map(id => `content/diagrams/ru/${id}.json`),
];

for (const path of required) assert.ok(await isFile(resolve(root, path)), `Missing build output: ${path}`);

const packageLock = JSON.parse(await readFile(resolve(root, '../package-lock.json'), 'utf8'));
const manifestRoutes = new Map(manifest.routes.map(entry => [`${entry.id}:${entry.locale}`, entry]));

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
  const manifestRoute = manifestRoutes.get(`${entry.id}:${entry.locale}`);
  assert.ok(manifestRoute, `Missing manifest route ${entry.id}:${entry.locale}`);
  const contract = validateDocumentContract(html, {
    siteOrigin: manifest.origin,
    routeId: entry.id,
    buildId: manifest.build.id,
    language: contentIndex.site.locales[entry.locale].lang,
    locale: entry.locale,
    direction: contentIndex.site.locales[entry.locale].direction,
    title: entry.canonical_title,
    description: entry.summary,
    canonicalUrl: entry.canonical ? `${manifest.origin}${entry.route}` : null,
    alternates: expectedRouteAlternates(entry, manifest.origin),
    locales: Object.keys(contentIndex.site.locales),
    defaultLocale: contentIndex.site.default_locale,
    features: manifestRoute.features,
    criticalFeatures: manifestRoute.criticalFeatures,
  });
  assert.deepEqual(contract.features, manifestRoute.features, `${entry.route}: manifest route features`);
  assert.deepEqual(contract.criticalFeatures, manifestRoute.criticalFeatures, `${entry.route}: manifest critical route features`);
  if (contract.features.includes('diagram-viewer')) {
    const viewers = html.match(/<pinega-diagram-viewer\b/gu) ?? [];
    const roots = html.match(/<div data-pinega-island-root hidden><\/div>/gu) ?? [];
    assert.ok(viewers.length > 0, `${entry.route}: diagram feature requires an island host`);
    assert.equal(roots.length, viewers.length, `${entry.route}: every diagram island requires one empty local root`);
    assert.equal(
      (html.match(new RegExp(`<pinega-diagram-viewer\\b[^>]*data-pinega-locale="${escapeRegex(entry.locale)}"`, 'gu')) ?? []).length,
      viewers.length,
      `${entry.route}: every diagram island requires its immutable route locale`,
    );
  }
  assert.deepEqual(
    manifestRoute.requests,
    createRouteRequestManifest(featureGraph, bundleManifest, ROUTE_FEATURE_DEFINITIONS, entry.locale, contract.features),
    `${entry.route}: deterministic request manifest`,
  );
  for (const phase of ['shell', 'critical', 'deferred', 'viewport', 'moduleMapReuse']) {
    assert.equal(new Set(manifestRoute.requests[phase]).size, manifestRoute.requests[phase].length, `${entry.route}: duplicate ${phase} request`);
    for (const url of manifestRoute.requests[phase]) {
      assert.match(url, /^\/assets\/[A-Za-z0-9._/-]+$/u, `${entry.route}: invalid ${phase} asset URL`);
      assert.ok(await isFile(resolve(root, url.slice(1))), `${entry.route}: missing ${phase} asset ${url}`);
    }
  }
  assert.doesNotMatch(html, /\{\{SITE_ORIGIN\}\}|PINEGA_PROJECT_META|PINEGA_DIAGRAM:|PINEGA_DOC_[A-Z_]+|PINEGA_LANGUAGE_SWITCHER/u, `${entry.output_path} contains an unresolved build marker`);
  assert.match(html, new RegExp(escapeRegex(featureGraph.entry.stylesheet), 'u'));
  assert.match(html, new RegExp(escapeRegex(featureGraph.entry.script), 'u'));
  assert.match(html, new RegExp(escapeRegex(`/${faviconPath}`), 'u'));
  assert.doesNotMatch(html, /\/assets\/main\.(?:css|js)|\/favicon\.svg/u);
  assert.match(html, /<main\b/u);
  assert.match(html, new RegExp(`<html\\b[^>]*\\blang="${escapeRegex(entry.locale)}"`, 'u'));
  assert.match(html, new RegExp(`<html\\b[^>]*\\bdata-locale="${escapeRegex(entry.locale)}"`, 'u'));
  assert.equal((html.match(/<h1\b/gu) ?? []).length, 1, `${entry.output_path} must contain one h1`);
  assert.match(html, new RegExp(`<title>${escapeRegex(entry.canonical_title)}<\\/title>`, 'u'));
  assert.match(html, new RegExp(`<meta name="description" content="${escapeRegex(entry.summary)}">`, 'u'));
  assert.match(html, new RegExp(`<nav class="pinega-language-switcher" data-pinega-language-switcher data-pinega-default-locale="${escapeRegex(contentIndex.site.default_locale)}" aria-label="${escapeRegex(localeMessages[entry.locale].navigation.language)}">`, 'u'));
  for (const [locale, metadata] of Object.entries(contentIndex.site.locales)) {
    const label = `<span lang="${metadata.lang}" dir="${metadata.direction}" translate="no">${metadata.label}</span>`;
    if (locale === entry.locale) {
      assert.match(html, new RegExp(`<span class="pinega-language-option" data-pinega-locale="${escapeRegex(locale)}" aria-current="page">${escapeRegex(label)}<\/span>`, 'u'));
    } else if (entry.translations[locale]) {
      assert.match(html, new RegExp(`<a class="pinega-language-option" data-pinega-locale="${escapeRegex(locale)}" href="${escapeRegex(entry.translations[locale])}" hreflang="${escapeRegex(metadata.lang)}">${escapeRegex(label)}<\/a>`, 'u'));
    } else {
      const noticeId = `pinega-translation-unavailable-${locale}`;
      const message = localeMessages[entry.locale].navigation.translation_unavailable[locale];
      assert.match(html, new RegExp(`<a class="pinega-language-option" data-pinega-locale="${escapeRegex(locale)}" href="#${noticeId}" data-translation-unavailable aria-controls="${noticeId}">${escapeRegex(label)}<\/a>`, 'u'));
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
assert.equal(manifest.schemaVersion, 8);
assert.equal(manifest.build.identityAlgorithm, BUILD_ID_ALGORITHM);
assert.equal(manifest.build.documentContractVersion, DOCUMENT_CONTRACT_VERSION);
assert.equal(manifest.build.shellVersion, SHELL_VERSION);
assert.deepEqual(manifest.navigation.nativeRouteIds, NATIVE_NAVIGATION_ROUTE_IDS);
assert.deepEqual(manifest.navigation.routeFeatureDefinitions, ROUTE_FEATURE_DEFINITIONS);
assert.deepEqual(manifest.navigation.litIslands, LIT_ISLAND_POLICY);
assert.deepEqual(manifest.navigation.featureGraph, {
  schemaVersion: 1,
  assetManifest: `/${featureGraphPath}`,
  bundleManifest: `/${bundleManifestPath}`,
  lit: featureGraph.lit,
});
assert.deepEqual(manifest.navigation.intentPrefetch, {
  schemaVersion: 1,
  signals: {
    hover: 'dwell',
    focus: 'immediate',
    pointer: 'primary-button-immediate',
  },
  hoverDelayMs: HOVER_PREFETCH_DELAY_MS,
  maxConcurrent: DEFAULT_PREFETCH_MAX_CONCURRENCY,
  maxQueued: DEFAULT_PREFETCH_MAX_QUEUE,
  routeRequestPriority: 'low',
  networkPolicy: {
    blockOffline: true,
    blockSaveData: true,
    blockedEffectiveTypes: SLOW_EFFECTIVE_CONNECTION_TYPES,
  },
  metrics: {
    schemaVersion: 1,
    event: 'pinega:prefetch-metrics',
    global: 'window.__PINEGA_PREFETCH_METRICS__',
    hitRateDenominator: 'completed-route-prefetches',
    wastedBytes: 'prefetched-minus-useful',
  },
});
assert.deepEqual(manifest.navigation.routeOwnedMetadata, ROUTE_OWNED_METADATA);
assert.deepEqual(manifest.navigation.urlNormalization.cacheKeyFields, ['buildId', 'origin', 'pathname', 'search']);
assert.deepEqual(manifest.delivery, {
  schemaVersion: 1,
  exactArtifact: true,
  releaseManifest: `/${RELEASE_MANIFEST_PATH}`,
  cache: {
    immutableAssets: IMMUTABLE_CACHE_CONTROL,
    revalidatedDocuments: REVALIDATED_CACHE_CONTROL,
  },
  serviceWorker: false,
});
await verifyBuildIdentity(root, manifest.build.id, [...variants.map(entry => entry.output_path), 'site-manifest.json']);
await verifyReleaseManifest(root, releaseManifest);
assert.equal(manifest.site.tagline, 'Correctness under concurrency.');
assert.equal(manifest.site.defaultLocale, 'en');
assert.deepEqual(manifest.routes.map(entry => `${entry.id}:${entry.locale}`), variants.map(entry => `${entry.id}:${entry.locale}`));
assert.deepEqual(manifest.routes.map(entry => entry.route), variants.map(entry => entry.route));
assert.deepEqual(manifest.routes.filter(entry => entry.sitemap).map(entry => entry.route), variants.filter(entry => entry.sitemap).map(entry => entry.route));
assert.deepEqual(manifest.routes.filter(entry => entry.searchable).map(entry => entry.route), variants.filter(entry => entry.searchable).map(entry => entry.route));
assert.deepEqual(manifest.diagrams.map(entry => entry.id).toSorted(), diagramIds.toSorted());
assert.equal(featureGraph.schemaVersion, 1);
assert.equal(featureGraph.kind, 'pinega-dynamic-feature-graph');
assert.deepEqual(featureGraph.bundler, {
  name: 'esbuild',
  version: '0.28.1',
  metafile: `/${bundleManifestPath}`,
  format: 'esm',
  splitting: true,
  minified: true,
  dynamicImports: 'native',
});
assert.match(featureGraph.entry.script, /^\/assets\/main-[A-Z0-9]{8}\.js$/u);
assert.match(featureGraph.entry.stylesheet, /^\/assets\/main-[A-Z0-9]{8}\.css$/u);
assert.deepEqual(featureGraph.features.map(feature => ({
  id: feature.id,
  element: feature.element,
  loading: feature.loading,
  implementation: feature.implementation,
  source: feature.source,
})), ROUTE_FEATURE_DEFINITIONS.map(feature => ({
  id: feature.id,
  element: feature.element,
  loading: feature.loading,
  implementation: feature.implementation,
  source: feature.module,
})));
assert.equal(featureGraph.lit.deduplicated, true);
assert.deepEqual(featureGraph.lit.packages, {
  '@lit/reactive-element': '2.1.2',
  '@lit/task': '1.0.3',
  lit: '3.3.3',
  'lit-element': '4.2.2',
  'lit-html': '3.3.3',
});
assert.deepEqual(featureGraph.lit.task, {
  package: '@lit/task',
  version: '1.0.3',
  scope: 'component-local',
  consumers: ['src/features/diagram-viewer.ts'],
});
assert.deepEqual(
  createVerifiedFeatureGraph({
    definitions: ROUTE_FEATURE_DEFINITIONS,
    metafile: bundleManifest,
    packageLock,
    esbuildVersion,
    bundleManifestUrl: `/${bundleManifestPath}`,
  }).graph,
  featureGraph,
  'Persisted feature graph must equal the independently verified esbuild metafile projection',
);
for (const [outputPath, output] of Object.entries(bundleManifest.outputs)) {
  assert.match(outputPath, /^dist\/assets\/[A-Za-z0-9._/-]+$/u, `Invalid esbuild output path: ${outputPath}`);
  const builtPath = resolve(root, outputPath.slice('dist/'.length));
  assert.ok(await isFile(builtPath), `Missing esbuild output: ${outputPath}`);
  assert.equal((await stat(builtPath)).size, output.bytes, `esbuild byte count mismatch: ${outputPath}`);
}
for (const file of files.filter(path => path.includes('/assets/'))) {
  const artifactPath = file.slice(`${root}/`.length);
  assert.equal(isFingerprintedAssetPath(artifactPath), true, `Unfingerprinted immutable asset: ${artifactPath}`);
}
assert.equal(releaseManifest.cachePolicy.serviceWorker, false);
assert.doesNotMatch(
  (await Promise.all(files.filter(path => /\.(?:html|js)$/u.test(path)).map(path => readFile(path, 'utf8')))).join('\n'),
  /navigator\.serviceWorker|serviceWorker\.register/u,
  'Gate 4.7 forbids Service Worker registration',
);

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
assert.deepEqual(russianDocsManifest.sections.map(section => section.id), ['start', 'how-to', 'concepts', 'reference', 'contributing']);
assert.deepEqual(russianDocsManifest.entries.map(entry => entry.id), russianDocumentationEntries.map(entry => entry.id));
assert.deepEqual(russianDocsManifest.entries.map(entry => entry.route), russianDocumentationEntries.map(entry => entry.route));
assert.equal(russianDocsManifest.entries.length, 13);

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

const russianDocsLanding = await readFile(resolve(root, 'ru/docs/index.html'), 'utf8');
assert.equal((russianDocsLanding.match(/data-doc-card/gu) ?? []).length, 13);
assert.equal((russianDocsLanding.match(/data-doc-group/gu) ?? []).length, 5);
assert.match(russianDocsLanding, /13 страниц/u);
assert.match(russianDocsLanding, /Фильтр по темам документации/u);

for (const entry of russianDocumentationEntries) {
  const html = await readFile(resolve(root, entry.output_path), 'utf8');
  assert.match(html, /<nav class="pinega-doc-navigation" aria-label="Документация">/u, entry.route);
  assert.match(html, /<nav class="pinega-breadcrumbs" aria-label="Навигационная цепочка">/u, entry.route);
  assert.match(html, /data-doc-provenance/u, entry.route);
  assert.match(html, /Стадия документации/u, entry.route);
}

const publicNavigation = manifest.site.locales.en.primaryNavigation.map(item => item.route ?? item.href);
assert.deepEqual(publicNavigation, ['/technology/', '/research/', '/docs/', '/about/', 'https://github.com/likern/research']);
assert.ok(!publicNavigation.includes('/component-lab/'));
assert.deepEqual(manifest.site.locales.ru.primaryNavigation.map(item => item.route ?? item.href), ['/ru/technology/', '/ru/research/', '/ru/docs/', '/ru/about/', 'https://github.com/likern/research']);

const sitemap = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
for (const route of manifest.routes.filter(entry => entry.sitemap).map(entry => entry.route)) {
  assert.match(sitemap, new RegExp(`<loc>https:\/\/pinega\\.example${escapeRegex(route)}<\\/loc>`, 'u'));
}
assert.doesNotMatch(sitemap, /component-lab/u);

const home = await readFile(resolve(root, 'index.html'), 'utf8');
assert.match(home, /<h1>Correctness under concurrency\.<\/h1>/u);
assert.match(home, /Pinega Engine is\s+the first active implementation programme/u);
assert.match(home, /href="\/ru\/" hreflang="ru"/u);
assert.doesNotMatch(home, /data-translation-unavailable/u);
assert.match(home, /<link rel="alternate" hreflang="ru" href="https:\/\/pinega\.example\/ru\/">/u);

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

const russianResearch = await readFile(resolve(root, 'ru/research/index.html'), 'utf8');
assert.equal((russianResearch.match(/class="pinega-semantic-diagram"/gu) ?? []).length, 3);
assert.match(russianResearch, /Текстовое представление и семантическая модель/u);
assert.match(russianResearch, /Скачать семантическую модель/u);
assert.match(russianResearch, /href="\/content\/diagrams\/ru\/linearizability-overlap\.json"/u);
assert.doesNotMatch(russianResearch, /Text representation and semantic model|Download semantic model/u);

console.log(`Validated ${files.length} build files; JavaScript ${javascript} B, CSS ${css} B, content items ${contentIndex.entries.length}, locale variants ${variants.length}, English docs ${documentationEntries.length}, Russian docs ${russianDocumentationEntries.length}, diagrams ${diagramIds.length}.`);

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

function expectedRouteAlternates(entry, origin) {
  if (!entry.canonical) return [];
  const alternates = Object.entries(entry.locales)
    .filter(([_locale, localized]) => localized.canonical)
    .map(([locale, localized]) => ({
      language: contentIndex.site.locales[locale].lang,
      href: `${origin}${localized.route}`,
    }));
  const defaultVariant = entry.locales[contentIndex.site.default_locale];
  if (defaultVariant?.canonical) alternates.push({ language: 'x-default', href: `${origin}${defaultVariant.route}` });
  return alternates;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function artifactPathFromUrl(value) {
  if (typeof value !== 'string' || !/^\/assets\/[A-Za-z0-9._/-]+$/u.test(value)) {
    throw new TypeError(`Invalid generated asset URL: ${JSON.stringify(value)}`);
  }
  return value.slice(1);
}
