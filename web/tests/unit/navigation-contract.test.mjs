import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  DOCUMENT_CONTRACT_VERSION,
  NATIVE_NAVIGATION_ROUTE_IDS,
  ROUTE_OWNED_METADATA,
  ROUTE_FEATURE_DEFINITIONS,
  SHELL_VERSION,
  normalizeRouteUrl,
  routeCacheKey,
} from '../../navigation/contract.mjs';
import { validateLocaleRouteContract } from '../../navigation/locale-contract.mjs';
import { finalizeBuildIdentity, verifyBuildIdentity } from '../../scripts/lib/build-identity.mjs';
import {
  classifyNavigationResponse,
  validateDocumentContract,
} from '../../scripts/lib/document-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = resolve(root, 'fixtures/navigation');
const buildA = 'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const readFixture = path => readFile(resolve(fixtures, path), 'utf8');

function completeLocaleContract() {
  return {
    documentLanguage: 'en',
    documentLocale: 'en',
    canonicalUrl: 'https://pinega.example/docs/',
    alternates: [
      { language: 'en', href: 'https://pinega.example/docs/' },
      { language: 'ru', href: 'https://pinega.example/ru/docs/' },
      { language: 'x-default', href: 'https://pinega.example/docs/' },
    ],
    defaultLocale: 'en',
    options: [
      { locale: 'en', language: 'en', kind: 'current', href: null, noticeId: null },
      { locale: 'ru', language: 'ru', kind: 'available', href: '/ru/docs/', noticeId: null },
    ],
    notices: [],
  };
}

test('valid fixtures cover ordinary, long, Lit, locale, missing-translation, and build documents', async () => {
  const names = [
    'normal.html',
    'long-doc.html',
    'lit-feature.html',
    'multilingual-en.html',
    'multilingual-ru.html',
    'missing-translation.html',
    'build-old.html',
    'build-new.html',
  ];
  const contracts = await Promise.all(names.map(async name => validateDocumentContract(await readFixture(name), {
    siteOrigin: 'https://pinega.example',
  })));
  assert.ok(contracts.every(contract => contract.contractVersion === DOCUMENT_CONTRACT_VERSION));
  assert.ok(contracts.every(contract => contract.shellVersion === SHELL_VERSION));
  assert.deepEqual(contracts[2].features, ['diagram-viewer']);
  assert.equal(contracts[2].criticalFeatures.length, 0);
  assert.equal(ROUTE_FEATURE_DEFINITIONS.find(feature => feature.id === 'diagram-viewer')?.implementation, 'lit');
  assert.deepEqual(contracts[3].alternates.map(alternate => alternate.language), ['en', 'ru', 'x-default']);
  assert.deepEqual(contracts[4].alternates.map(alternate => alternate.language), ['en', 'ru', 'x-default']);
  assert.deepEqual(contracts[5].alternates.map(alternate => alternate.language), ['en', 'x-default']);
});

test('locale route contract closes metadata, switcher, and missing-translation state as one invariant', () => {
  const complete = validateLocaleRouteContract(completeLocaleContract(), {
    locales: ['en', 'ru'],
    defaultLocale: 'en',
    metadataOrigin: 'https://pinega.example',
  });
  assert.deepEqual(complete, {
    locales: ['en', 'ru'],
    defaultLocale: 'en',
    metadataOrigin: 'https://pinega.example',
  });

  const missing = completeLocaleContract();
  missing.alternates = missing.alternates.filter(alternate => alternate.language !== 'ru');
  missing.options[1] = {
    locale: 'ru',
    language: 'ru',
    kind: 'unavailable',
    href: '#pinega-translation-unavailable-ru',
    noticeId: 'pinega-translation-unavailable-ru',
  };
  missing.notices = [{
    id: 'pinega-translation-unavailable-ru',
    message: 'A Russian translation of this page is not available.',
  }];
  assert.deepEqual(validateLocaleRouteContract(missing, {
    locales: ['en', 'ru'],
    defaultLocale: 'en',
  }), {
    locales: ['en', 'ru'],
    defaultLocale: 'en',
    metadataOrigin: 'https://pinega.example',
  });
});

test('locale route contract rejects every contradictory metadata or switcher boundary', () => {
  const cases = [
    {
      id: 'site locale omitted',
      mutate: contract => contract.options.pop(),
      expected: /site locale options/u,
    },
    {
      id: 'switch target disagrees with hreflang',
      mutate: contract => { contract.options[1].href = '/ru/research/'; },
      expected: /disagrees with hreflang/u,
    },
    {
      id: 'x-default disagrees with default locale',
      mutate: contract => { contract.alternates[2].href = 'https://pinega.example/ru/docs/'; },
      expected: /x-default/u,
    },
    {
      id: 'metadata crosses origin',
      mutate: contract => { contract.alternates[1].href = 'https://example.com/ru/docs/'; },
      expected: /share one origin/u,
    },
    {
      id: 'unavailable locale still publishes hreflang',
      mutate: contract => {
        contract.options[1] = {
          locale: 'ru',
          language: 'ru',
          kind: 'unavailable',
          href: '#pinega-translation-unavailable-ru',
          noticeId: 'pinega-translation-unavailable-ru',
        };
        contract.notices = [{ id: 'pinega-translation-unavailable-ru', message: 'Unavailable.' }];
      },
      expected: /hreflang set|must not publish/u,
    },
    {
      id: 'translation notice is missing',
      mutate: contract => {
        contract.alternates = contract.alternates.filter(alternate => alternate.language !== 'ru');
        contract.options[1] = {
          locale: 'ru',
          language: 'ru',
          kind: 'unavailable',
          href: '#pinega-translation-unavailable-ru',
          noticeId: 'pinega-translation-unavailable-ru',
        };
      },
      expected: /translation notices/u,
    },
  ];

  for (const fixture of cases) {
    const contract = completeLocaleContract();
    fixture.mutate(contract);
    assert.throws(
      () => validateLocaleRouteContract(contract, { locales: ['en', 'ru'], defaultLocale: 'en' }),
      fixture.expected,
      fixture.id,
    );
  }
});

test('every registered content class has one deterministic representative route', async () => {
  const contentIndex = JSON.parse(await readFile(resolve(root, '../content/content-index.json'), 'utf8'));
  const fixture = JSON.parse(await readFixture('page-classes.json'));
  assert.equal(fixture.schemaVersion, 1);
  const contentTypes = [...new Set(contentIndex.entries.map(entry => entry.content_type))].sort();
  assert.deepEqual(fixture.representatives.map(representative => representative.contentType), contentTypes);
  assert.equal(new Set(fixture.representatives.map(representative => representative.route)).size, fixture.representatives.length);
  for (const representative of fixture.representatives) {
    const entry = contentIndex.entries.find(candidate => candidate.id === representative.id);
    assert.ok(entry, `Unknown representative entry ${representative.id}`);
    assert.equal(entry.content_type, representative.contentType);
    assert.equal(entry.locales[representative.locale]?.route, representative.route);
  }
});

test('coordinator ownership and native-route policy are closed over the content registry', async () => {
  const contentIndex = JSON.parse(await readFile(resolve(root, '../content/content-index.json'), 'utf8'));
  assert.deepEqual(NATIVE_NAVIGATION_ROUTE_IDS, ['component-lab', 'not-found']);
  for (const id of NATIVE_NAVIGATION_ROUTE_IDS) {
    const entry = contentIndex.entries.find(candidate => candidate.id === id);
    assert.ok(entry, `Unknown native-navigation route ${id}`);
    assert.equal(entry.public, false, `${id} must remain outside the enhanced public route graph`);
  }
  for (const selector of [
    'meta[name="robots"]',
    'html[lang][dir][data-page][data-locale]',
    'pinega-site-header [data-pinega-language-switcher]',
    'pinega-site-header [data-translation-notice]',
    'pinega-site-header .pinega-brand[aria-current="page"]',
    'a.pinega-skip-link',
    'pinega-site-header > header',
    'footer.pinega-site-footer',
    '[data-pinega-navigation-announcer]',
  ]) {
    assert.ok(ROUTE_OWNED_METADATA.includes(selector), `Missing coordinator-owned route state ${selector}`);
  }
});

test('malformed route documents fail before they can become prepared routes', async () => {
  assert.throws(
    () => validateDocumentContract(readFileSync(resolve(fixtures, 'malformed.html'), 'utf8')),
    /data-pinega-route|data-pinega-shell/u,
  );
});

test('URL normalization preserves content-affecting queries and trailing-slash policy but excludes fragments', () => {
  const origin = 'https://pinega.example';
  assert.equal(
    normalizeRouteUrl('/docs/?topic=mvcc&utm_source=research#target', origin),
    'https://pinega.example/docs/?topic=mvcc&utm_source=research',
  );
  assert.notEqual(normalizeRouteUrl('/docs', origin), normalizeRouteUrl('/docs/', origin));
  assert.notEqual(normalizeRouteUrl('/docs/?a=1&b=2', origin), normalizeRouteUrl('/docs/?b=2&a=1', origin));
  assert.throws(() => normalizeRouteUrl('https://example.com/docs/', origin), /must remain/u);
  assert.equal(
    routeCacheKey(buildA, '/docs/#one', origin),
    routeCacheKey(buildA, '/docs/#two', origin),
  );
});

test('response fixtures define hard-navigation boundaries without browser state', async () => {
  const cases = JSON.parse(await readFixture('response-cases.json'));
  for (const fixture of cases) {
    const body = fixture.body === null ? null : await readFixture(fixture.body);
    const result = classifyNavigationResponse({ ...fixture, body }, {
      siteOrigin: 'https://pinega.example',
      buildId: buildA,
      shellVersion: SHELL_VERSION,
    });
    assert.equal(result.outcome, fixture.outcome, fixture.id);
    if (fixture.reason) assert.equal(result.reason, fixture.reason, fixture.id);
  }
});

test('normalized artifact identity is deterministic and ignores delivery provenance only', async t => {
  const directory = await mkdtemp(resolve(tmpdir(), 'pinega-build-contract-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(resolve(directory, 'route'), { recursive: true });
  await writeFile(resolve(directory, 'route/index.html'), '<html data-pinega-build="__PINEGA_BUILD_ID__"></html>', 'utf8');
  await writeFile(resolve(directory, 'site-manifest.json'), '{"build":"__PINEGA_BUILD_ID__"}\n', 'utf8');
  const identityPaths = ['route/index.html', 'site-manifest.json'];
  const buildId = await finalizeBuildIdentity(directory, identityPaths);
  await verifyBuildIdentity(directory, buildId, identityPaths);
  await mkdir(resolve(directory, '.well-known'), { recursive: true });
  await writeFile(resolve(directory, '.well-known/pinega-deployment.json'), '{"run":1}\n', 'utf8');
  await verifyBuildIdentity(directory, buildId, identityPaths);
  await writeFile(resolve(directory, 'payload.txt'), 'changed\n', 'utf8');
  await assert.rejects(verifyBuildIdentity(directory, buildId, identityPaths), /identity mismatch/u);
});
