import { expect, test, type Locator, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { openReadyDocument } from './support/direct-document.js';
import { expectInteractiveState } from './support/interactive-accessibility.js';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');
const documentationRoutes = [
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
const publicationRoutes = ['/research/publications/', '/research/publications/dual-target-contract/'];
const corePublicRoutes = ['/', '/technology/', '/research/', ...publicationRoutes, '/docs/', '/about/'];
const publicRoutes = ['/', '/technology/', '/research/', ...publicationRoutes, '/docs/', ...documentationRoutes, '/about/'];
const russianDocumentationRoutes = documentationRoutes.map(route => `/ru${route}`);
const russianCorePublicRoutes = ['/ru/', '/ru/technology/', '/ru/research/', ...publicationRoutes.map(route => `/ru${route}`), '/ru/docs/', '/ru/about/'];
const russianPublicRoutes = publicRoutes.map(route => route === '/' ? '/ru/' : `/ru${route}`);
const allCoreRoutes = [...corePublicRoutes, ...russianCorePublicRoutes, '/docs/getting-started/', '/ru/docs/getting-started/', '/component-lab/'];
const semanticTest = { tag: ['@aria-tree', '@accessibility'] };

async function ready(page: Page, route: string) {
  await openReadyDocument(page, route);
}

async function setDocumentationQuery(input: Locator, value: string): Promise<void> {
  await input.evaluate((element: HTMLElement & { value?: string }, nextValue) => {
    element.value = nextValue;
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }, value);
}

for (const route of allCoreRoutes) {
  test(`${route} keeps semantic landmarks and fits the active viewport`, async ({ page }) => {
    await ready(page, route);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('pinega-site-header')).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('complete English documentation corpus resolves with semantic article shells', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Full route inventory is exercised once; representative pages remain cross-browser.');
  for (const route of documentationRoutes) {
    await ready(page, route);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Documentation' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
    await expect(page.locator('[data-doc-provenance]')).toBeVisible();
    await expect(page.locator('select[disabled]')).toHaveCount(0);
  }
});

test('complete Russian documentation corpus resolves with semantic article shells', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Full route inventory is exercised once; representative pages remain cross-browser.');
  for (const route of russianDocumentationRoutes) {
    await ready(page, route);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Документация' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Навигационная цепочка' })).toBeVisible();
    await expect(page.locator('[data-doc-provenance]')).toBeVisible();
  }
});

test('public navigation exposes the programme hierarchy and hides the component lab', async ({ page }) => {
  for (const route of [...corePublicRoutes, '/docs/start/project-overview/']) {
    await ready(page, route);
    const navigation = page.locator('nav[data-primary-navigation]');
    await expect(navigation.locator('a[href="/technology/"]')).toHaveText('Technology');
    await expect(navigation.locator('a[href="/research/"]')).toHaveText('Research');
    await expect(navigation.locator('a[href="/docs/"]')).toHaveText('Documentation');
    await expect(navigation.locator('a[href="/about/"]')).toHaveText('About');
    await expect(navigation.locator('a[href="https://github.com/likern/research"]')).toHaveText('GitHub');
    await expect(navigation.locator('a[href="/component-lab/"]')).toHaveCount(0);
    const language = page.getByRole('navigation', { name: 'Language' });
    await expect(language).toBeVisible();
    await expect(language.locator('[aria-current="page"]')).toHaveText('English');
    await expect(language.getByRole('link', { name: 'Русский' })).toBeVisible();
  }
});

test('Russian public navigation stays inside the Russian corpus', async ({ page }) => {
  for (const route of [...russianCorePublicRoutes, '/ru/docs/start/project-overview/']) {
    await ready(page, route);
    const navigation = page.locator('nav[data-primary-navigation]');
    await expect(navigation.locator('a[href="/ru/technology/"]')).toHaveText('Технологии');
    await expect(navigation.locator('a[href="/ru/research/"]')).toHaveText('Исследования');
    await expect(navigation.locator('a[href="/ru/docs/"]')).toHaveText('Документация');
    await expect(navigation.locator('a[href="/ru/about/"]')).toHaveText('О проекте');
    await expect(navigation.locator('a[href="/component-lab/"]')).toHaveCount(0);
    const language = page.getByRole('navigation', { name: 'Язык' });
    await expect(language.locator('[aria-current="page"]')).toHaveText('Русский');
    await expect(language.getByRole('link', { name: 'English' })).toBeVisible();
  }
});

test('homepage states the Pinega master-brand and evidence boundary', async ({ page }) => {
  await ready(page, '/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Correctness under concurrency.');
  await expect(page.getByText('Pinega Engine is the first active implementation programme', { exact: false })).toBeVisible();
  await expect(page.getByText('it is not yet a production release', { exact: false })).toBeVisible();
  await expect(page.locator('.pinega-home-status .pinega-status-card')).toHaveCount(3);
  await expect(page.locator('#programmes .pinega-research-programme > article')).toHaveCount(3);
  await expect(page.locator('#pinega-engine .pinega-architecture-layers > li')).toHaveCount(4);
});

test('technology page separates active, research, and portfolio programmes', async ({ page }) => {
  await ready(page, '/technology/');
  await expect(page.locator('h1#technology-title')).toContainText('Research becomes technology');
  await expect(page.locator('#pinega-engine')).toBeAttached();
  await expect(page.locator('#optimisation')).toBeAttached();
  await expect(page.locator('#verification')).toBeAttached();
  await expect(page.locator('#distributed-systems')).toBeAttached();
  await expect(page.locator('#engine-architecture .pinega-architecture-layers > li')).toHaveCount(4);
  await expect(page.getByText('One PostgreSQL WAL', { exact: true })).toBeVisible();
});

test('documentation landing filters real metadata-backed pages by topic and group', semanticTest, async ({ page }, testInfo) => {
  await ready(page, '/docs/');
  const cards = page.locator('[data-doc-card]');
  await expect(cards).toHaveCount(13);
  await expect(page.locator('[data-doc-group]')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'Filter documentation topics' })).toBeVisible();
  await expect(page.locator('[data-doc-search-status]')).toHaveText('13 pages');
  const initialSemantic = await expectInteractiveState(page, 'DOC-FILTER-EN-INITIAL', testInfo);
  if (initialSemantic === undefined) throw new TypeError('English documentation filter initial state produced no semantic reference.');

  const input = page.locator('[data-doc-search-input]');
  await setDocumentationQuery(input, 'engine architecture');
  const visibleTitles = await cards.evaluateAll(elements =>
    elements.filter(element => !(element as HTMLElement).hidden).map(element => element.querySelector('h4')?.textContent?.trim()),
  );
  expect(visibleTitles).toEqual(['Pinega Engine architecture']);
  await expect(page.locator('[data-doc-search-status]')).toHaveText('1 of 13 pages');
  await expect(page.locator('[data-doc-group]:not([hidden])')).toHaveCount(1);
  await expectInteractiveState(page, 'DOC-FILTER-EN-MATCH', testInfo);

  await setDocumentationQuery(input, 'does-not-exist');
  await expect(page.locator('[data-doc-search-empty]')).toBeVisible();
  await expect(page.locator('[data-doc-group]:not([hidden])')).toHaveCount(0);
  await expectInteractiveState(page, 'DOC-FILTER-EN-EMPTY', testInfo);

  await setDocumentationQuery(input, '');
  await expect(page.locator('[data-doc-search-status]')).toHaveText('13 pages');
  await expect(page.locator('[data-doc-search-empty]')).toBeHidden();
  await expect(page.locator('[data-doc-card]:not([hidden])')).toHaveCount(13);
  await expectInteractiveState(page, 'DOC-FILTER-EN-CLEAR', testInfo, { reference: initialSemantic });
});

test('Russian documentation filter uses locale-aware matching and plural forms', semanticTest, async ({ page }, testInfo) => {
  await ready(page, '/ru/docs/');
  const cards = page.locator('[data-doc-card]');
  await expect(cards).toHaveCount(13);
  await expect(page.locator('[data-doc-search-status]')).toHaveText('13 страниц');
  const initialSemantic = await expectInteractiveState(page, 'DOC-FILTER-RU-INITIAL', testInfo);
  if (initialSemantic === undefined) throw new TypeError('Russian documentation filter initial state produced no semantic reference.');
  const input = page.locator('[data-doc-search-input]');
  await setDocumentationQuery(input, 'архитектура pinega engine');
  const visibleTitles = await cards.evaluateAll(elements =>
    elements.filter(element => !(element as HTMLElement).hidden).map(element => element.querySelector('h4')?.textContent?.trim()),
  );
  expect(visibleTitles).toEqual(['Архитектура Pinega Engine']);
  await expect(page.locator('[data-doc-search-status]')).toHaveText('1 из 13 страниц');
  await expectInteractiveState(page, 'DOC-FILTER-RU-MATCH', testInfo);

  await setDocumentationQuery(input, 'не-существует');
  await expect(page.locator('[data-doc-search-empty]')).toBeVisible();
  await expect(page.locator('[data-doc-group]:not([hidden])')).toHaveCount(0);
  await expectInteractiveState(page, 'DOC-FILTER-RU-EMPTY', testInfo);

  await setDocumentationQuery(input, '');
  await expect(page.locator('[data-doc-search-status]')).toHaveText('13 страниц');
  await expect(page.locator('[data-doc-search-empty]')).toBeHidden();
  await expect(page.locator('[data-doc-card]:not([hidden])')).toHaveCount(13);
  await expectInteractiveState(page, 'DOC-FILTER-RU-CLEAR', testInfo, { reference: initialSemantic });
});

test('documentation catalogues remain complete without JavaScript', async ({ request }) => {
  for (const [route, prefix] of [['/docs/', '/docs/'], ['/ru/docs/', '/ru/docs/']] as const) {
    const response = await request.get(route);
    expect(response.ok()).toBeTruthy();
    const html = await response.text();
    expect((html.match(/data-doc-card/gu) ?? []).length).toBe(13);
    expect((html.match(/data-doc-group/gu) ?? []).length).toBe(5);
    expect(html).not.toContain('hidden data-doc-card');
    expect(html).toContain(`${prefix}concepts/pinega-engine-architecture/`);
    expect(html).toContain(`${prefix}reference/content-metadata-schema/`);
  }
});

test('nested documentation exposes generated navigation, breadcrumb and provenance', async ({ page }) => {
  await ready(page, '/docs/concepts/pinega-engine-architecture/');
  const docsNavigation = page.getByRole('navigation', { name: 'Documentation' });
  await expect(docsNavigation.locator('a[aria-current="page"]')).toHaveText('Pinega Engine architecture');
  const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(breadcrumb.locator('ol > li')).toHaveCount(4);
  await expect(breadcrumb).toContainText('Concepts');
  await expect(page.locator('[data-doc-provenance]')).toContainText('Design contract');
  await expect(page.locator('[data-doc-provenance]')).toContainText('Pinega Engine architecture for PostgreSQL 19');
  await expect(page.locator('[data-doc-provenance] a[href*="/blob/main/web/pages/en/docs/"]')).toHaveCount(1);
  await expect(page.locator('select[disabled]')).toHaveCount(0);
});

test('Russian nested documentation localizes navigation, provenance, and source identity', async ({ page }) => {
  await ready(page, '/ru/docs/concepts/pinega-engine-architecture/');
  const docsNavigation = page.getByRole('navigation', { name: 'Документация' });
  await expect(docsNavigation.locator('a[aria-current="page"]')).toHaveText('Архитектура Pinega Engine');
  const breadcrumb = page.getByRole('navigation', { name: 'Навигационная цепочка' });
  await expect(breadcrumb.locator('ol > li')).toHaveCount(4);
  await expect(breadcrumb).toContainText('Концепции');
  await expect(page.locator('[data-doc-provenance]')).toContainText('Проектный контракт');
  await expect(page.locator('[data-doc-provenance] a[href*="/blob/main/web/pages/ru/docs/"]')).toHaveCount(1);
});

test('getting-started is orientation rather than a mixed command article', async ({ page }) => {
  await ready(page, '/docs/getting-started/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose the documentation path that matches your task');
  await expect(page.locator('pinega-code-example')).toHaveCount(0);
  await expect(page.locator('#orient').getByRole('link', { name: 'Project overview', exact: true })).toBeVisible();
  await expect(page.locator('#orient').getByRole('link', { name: 'Reproduce the research workspace', exact: true })).toBeVisible();
  await expect(page.locator('#task').getByRole('link', { name: 'Build and inspect the website', exact: true })).toBeVisible();
  await expect(page.locator('#lookup').getByRole('link', { name: 'Repository layout', exact: true })).toBeVisible();
});

test('research landing exposes the area catalogue, method, and existing diagrams', async ({ page }) => {
  await ready(page, '/research/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Research is part');
  await expect(page.locator('#research-areas .pinega-research-programme > article')).toHaveCount(7);
  await expect(page.locator('figure[data-diagram-id]')).toHaveCount(3);
});

test('Russian research diagrams localize visible and accessible text', async ({ page }) => {
  await ready(page, '/ru/research/');
  await expect(page.locator('figure[data-diagram-id]')).toHaveCount(3);
  await expect(page.getByText('Текстовое представление и семантическая модель')).toHaveCount(3);
  await expect(page.locator('a[download]', { hasText: 'Скачать семантическую модель' })).toHaveCount(3);
  await expect(page.locator('svg text').filter({ hasText: 'Жизненный цикл публикации и рекламации буферного фрейма' })).toBeVisible();
});

test('dual-target publication is a semantic responsive reader in both locales', async ({ page }) => {
  for (const locale of ['en', 'ru']) {
    const prefix = locale === 'ru' ? '/ru' : '';
    await ready(page, `${prefix}/research/publications/dual-target-contract/`);
    await expect(page.locator('article.pinega-publication-article')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('math')).toHaveCount(7);
    await expect(page.locator('.pinega-publication-table-scroll table')).toHaveCount(1);
    await expect(page.locator('figure[data-diagram-id="linearizability-overlap"]')).toHaveCount(1);
    await expect(page.locator('section.pinega-publication-endnotes[role="doc-endnotes"]')).toHaveCount(1);
    await expect(page.locator('.pinega-publication-navigation a[type="application/pdf"]')).toHaveAttribute('href', `${prefix}/research/publications/dual-target-contract/paper.pdf`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const tableOverflow = await page.locator('.pinega-publication-table-scroll').evaluate(element => element.scrollWidth - element.clientWidth);
    expect(tableOverflow).toBeGreaterThan(0);
  }
});

test('publication catalogue and reader retain the same document across enhanced traversal', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Transactional traversal is exercised once; route parity is cross-browser through page-class coverage.');
  await ready(page, '/research/');
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  await page.getByRole('link', { name: 'Research publications', exact: true }).click();
  await expect(page).toHaveURL(/\/research\/publications\/$/u);
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'research-publications');
  await page.getByRole('link', { name: 'One source, two reading contracts', exact: true }).click();
  await expect(page).toHaveURL(/\/research\/publications\/dual-target-contract\/$/u);
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'publication-dual-target-contract');
  await expect(page.locator('article.pinega-publication-article')).toHaveCount(1);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  await page.goBack();
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'research-publications');
});

test('publication HTML and exact PDF artefacts are available without client rendering', async ({ request }) => {
  const publicationManifestResponse = await request.get('/content/publications-manifest.json');
  expect(publicationManifestResponse.ok()).toBeTruthy();
  const publicationManifest = await publicationManifestResponse.json() as {
    schemaVersion: number;
    entries: Array<{ locale: string; route: string; pdf: { url: string; bytes: number; sha256: string } }>;
  };
  expect(publicationManifest.schemaVersion).toBe(1);
  expect(publicationManifest.entries).toHaveLength(2);
  for (const publication of publicationManifest.entries) {
    const htmlResponse = await request.get(publication.route);
    const html = await htmlResponse.text();
    expect(htmlResponse.ok()).toBeTruthy();
    expect(html).toContain('<article class="pinega-publication-article"');
    expect(html.match(/<h1\b/gu)).toHaveLength(1);
    expect(html).toContain('<math');
    expect(html).toContain('<table>');
    expect(html).not.toContain('PINEGA_PUBLICATION_ARTICLE');
    const pdfResponse = await request.get(publication.pdf.url);
    const pdf = await pdfResponse.body();
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
    expect(pdf.byteLength).toBe(publication.pdf.bytes);
    expect(createHash('sha256').update(pdf).digest('hex')).toBe(publication.pdf.sha256);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  }
});

test('publication reader preserves block MathML composition across narrow reflow boundaries', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Exact narrow-width geometry is exercised once in the pinned browser.');

  for (const width of [657, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const locale of ['en', 'ru']) {
      const prefix = locale === 'ru' ? '/ru' : '';
      const expectedLabel = locale === 'ru'
        ? 'Прокручиваемая математическая формула'
        : 'Scrollable mathematical formula';
      await ready(page, `${prefix}/research/publications/dual-target-contract/`);

      const metrics = await page.locator('.pinega-publication-math-scroll').evaluateAll(wrappers => wrappers.map(wrapper => {
        const mathematics = wrapper.querySelector(':scope > math[display="block"]');
        if (!(mathematics instanceof MathMLElement)) throw new TypeError('Math scroll host must own one direct block MathML root.');
        const children = [...mathematics.children]
          .map(element => element.getBoundingClientRect())
          .filter(rect => rect.width > 0 || rect.height > 0);
        const horizontalSteps = children.slice(1)
          .filter((rect, index) => rect.left > children[index]!.left + 0.5)
          .length;
        return {
          label: wrapper.getAttribute('aria-label'),
          role: wrapper.getAttribute('role'),
          tabIndex: (wrapper as HTMLElement).tabIndex,
          wrapperClientWidth: (wrapper as HTMLElement).clientWidth,
          wrapperScrollWidth: (wrapper as HTMLElement).scrollWidth,
          mathematicsWidth: mathematics.getBoundingClientRect().width,
          mathematicsOverflowX: getComputedStyle(mathematics).overflowX,
          horizontalStepRatio: children.length > 1 ? horizontalSteps / (children.length - 1) : 1,
        };
      }));

      expect(metrics).toHaveLength(2);
      for (const metric of metrics) {
        expect(metric.label).toBe(expectedLabel);
        expect(metric.role).toBe('group');
        expect(metric.tabIndex).toBe(0);
        expect(metric.mathematicsOverflowX).toBe('visible');
        expect(metric.mathematicsWidth).toBeGreaterThanOrEqual(metric.wrapperClientWidth - 1);
        expect(metric.wrapperScrollWidth).toBeGreaterThanOrEqual(metric.mathematicsWidth - 1);
        expect(metric.horizontalStepRatio).toBeGreaterThan(0.6);
      }
      if (width === 320) {
        expect(metrics.some(metric => metric.wrapperScrollWidth > metric.wrapperClientWidth + 1)).toBeTruthy();
        expect(await page.locator('.pinega-publication-table-scroll').evaluate(element => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    }
  }
});

test('about page distinguishes Pinega, Pinega Labs, and future offerings', async ({ page }) => {
  await ready(page, '/about/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('defensible database technology');
  await expect(page.getByText('Pinega is the master technology and product programme', { exact: false })).toBeVisible();
  await expect(page.getByText('Pinega Labs is the working research', { exact: false })).toBeVisible();
});

test('representative routes expose one versioned build and route-feature contract', async ({ page, request }) => {
  const manifestResponse = await request.get('/site-manifest.json');
  const manifest = await manifestResponse.json() as {
    build: { id: string; documentContractVersion: string; shellVersion: string };
  };
  const representatives = [
    { route: '/', routeId: 'home', features: '', critical: '' },
    { route: '/research/', routeId: 'research', features: 'diagram-viewer', critical: '' },
    { route: '/research/publications/', routeId: 'research-publications', features: '', critical: '' },
    { route: '/research/publications/dual-target-contract/', routeId: 'publication-dual-target-contract', features: 'diagram-viewer', critical: '' },
    { route: '/docs/', routeId: 'documentation', features: 'doc-topic-filter', critical: '' },
    { route: '/component-lab/', routeId: 'component-lab', features: 'benchmark code-example', critical: 'benchmark' },
    { route: '/ru/docs/', routeId: 'documentation', features: 'doc-topic-filter', critical: '' },
  ];
  for (const representative of representatives) {
    await ready(page, representative.route);
    await expect(page.locator('html')).toHaveAttribute('data-pinega-contract', manifest.build.documentContractVersion);
    await expect(page.locator('html')).toHaveAttribute('data-pinega-shell', manifest.build.shellVersion);
    await expect(page.locator('html')).toHaveAttribute('data-pinega-build', manifest.build.id);
    await expect(page.locator('body')).toHaveAttribute('data-pinega-route', representative.routeId);
    const main = page.locator('main#main-content');
    await expect(main).toHaveAttribute('data-pinega-route', representative.routeId);
    await expect(main).toHaveAttribute('data-pinega-features', representative.features);
    await expect(main).toHaveAttribute('data-pinega-critical-features', representative.critical);
  }
});

test('generated discovery files expose the complete documentation corpus', async ({ request }) => {
  const manifest = await request.get('/site-manifest.json');
  expect(manifest.ok()).toBeTruthy();
  const payload = await manifest.json() as {
    schemaVersion: number;
    build: { id: string; identityAlgorithm: string; documentContractVersion: string; shellVersion: string };
    navigation: {
      routeFeatureDefinitions: Array<{ id: string; implementation: string }>;
      litIslands: {
        schemaVersion: number;
        ownership: string;
        routeLoading: boolean;
        router: boolean;
        globalRendering: boolean;
        globalHydration: boolean;
        taskPackage: string;
        islands: Array<{ id: string; element: string; feature: string; fallback: string; asyncScope: string; reconnect: boolean }>;
      };
      intentPrefetch: {
        schemaVersion: number;
        hoverDelayMs: number;
        maxConcurrent: number;
        maxQueued: number;
        routeRequestPriority: string;
        networkPolicy: { blockSaveData: boolean; blockedEffectiveTypes: string[] };
        metrics: { event: string; hitRateDenominator: string; wastedBytes: string };
      };
      routeOwnedMetadata: string[];
    };
    delivery: {
      schemaVersion: number;
      exactArtifact: boolean;
      releaseManifest: string;
      cache: { immutableAssets: string; revalidatedDocuments: string; notFoundDocuments: string };
      serviceWorker: boolean;
    };
    site: { tagline: string; defaultLocale: string; locales: Record<string, { pathPrefix: string }> };
    routes: Array<{ id: string; locale: string; route: string; sitemap: boolean; searchable: boolean; public: boolean; features: string[]; criticalFeatures: string[]; documentation?: unknown; publication?: unknown }>;
    publications: { schemaVersion: number; profile: string; manifest: string; entries: Array<{ locale: string; route: string; pdf: string }> };
  };
  expect(payload.schemaVersion).toBe(9);
  expect(payload.build.id).toMatch(/^sha256-[a-f0-9]{64}$/u);
  expect(payload.build.identityAlgorithm).toBe('sha256-normalized-artifact-v1');
  expect(payload.build.documentContractVersion).toBe('1');
  expect(payload.build.shellVersion).toBe('4.0');
  expect(payload.delivery).toEqual({
    schemaVersion: 1,
    exactArtifact: true,
    releaseManifest: '/.well-known/pinega-release.json',
    cache: {
      immutableAssets: 'public, max-age=31536000, immutable',
      revalidatedDocuments: 'public, max-age=0, must-revalidate',
      notFoundDocuments: 'no-store',
    },
    serviceWorker: false,
  });
  expect(payload.navigation.routeFeatureDefinitions.map(feature => feature.id)).toEqual(['benchmark', 'code-example', 'diagram-viewer', 'doc-topic-filter']);
  expect(payload.navigation.litIslands).toEqual({
    schemaVersion: 1,
    ownership: 'component-local',
    routeLoading: false,
    router: false,
    globalRendering: false,
    globalHydration: false,
    taskPackage: '@lit/task',
    islands: [{
      id: 'semantic-diagram-inspector',
      element: 'pinega-diagram-viewer',
      feature: 'diagram-viewer',
      fallback: 'canonical-light-dom',
      asyncScope: 'component-local-model',
      reconnect: true,
    }],
  });
  expect(payload.navigation.intentPrefetch).toMatchObject({
    schemaVersion: 1,
    hoverDelayMs: 80,
    maxConcurrent: 2,
    maxQueued: 8,
    routeRequestPriority: 'low',
    networkPolicy: { blockSaveData: true, blockedEffectiveTypes: ['slow-2g', '2g', '3g'] },
    metrics: {
      event: 'pinega:prefetch-metrics',
      hitRateDenominator: 'completed-route-prefetches',
      wastedBytes: 'prefetched-minus-useful',
    },
  });
  expect(payload.navigation.routeOwnedMetadata).toContain('link[rel="canonical"]');
  expect(payload.site.tagline).toBe('Correctness under concurrency.');
  expect(payload.site.defaultLocale).toBe('en');
  expect(payload.site.locales.ru?.pathPrefix).toBe('/ru');
  expect(payload.routes.filter(entry => entry.sitemap).map(entry => entry.route).toSorted()).toEqual([...publicRoutes, ...russianPublicRoutes].toSorted());
  expect(payload.routes.filter(entry => entry.searchable).map(entry => entry.route).toSorted()).toEqual([...publicRoutes, ...russianPublicRoutes].toSorted());
  expect(payload.routes.filter(entry => entry.documentation && !['/docs/', '/ru/docs/'].includes(entry.route))).toHaveLength(26);
  expect(payload.routes.filter(entry => entry.locale === 'ru')).toHaveLength(21);
  expect(payload.routes.find(entry => entry.route === '/docs/')?.features).toEqual(['doc-topic-filter']);
  expect(payload.routes.find(entry => entry.route === '/component-lab/')?.criticalFeatures).toEqual(['benchmark']);
  expect(payload.publications.schemaVersion).toBe(1);
  expect(payload.publications.profile).toBe('dual-target');
  expect(payload.publications.manifest).toBe('/content/publications-manifest.json');
  expect(payload.publications.entries.map(entry => entry.locale)).toEqual(['en', 'ru']);
  expect(payload.routes.filter(entry => entry.publication)).toHaveLength(2);

  const registry = await request.get('/content/content-index.json');
  const registryPayload = await registry.json() as { schema_version: number; entries: unknown[] };
  expect(registryPayload.schema_version).toBe(4);
  expect(registryPayload.entries).toHaveLength(22);

  const docsManifest = await request.get('/content/en/documentation-manifest.json');
  expect(docsManifest.ok()).toBeTruthy();
  const docsPayload = await docsManifest.json() as { schema_version: number; locale: string; sections: Array<{ id: string }>; entries: Array<{ route: string }> };
  expect(docsPayload.schema_version).toBe(2);
  expect(docsPayload.locale).toBe('en');
  expect(docsPayload.sections.map(section => section.id)).toEqual(['start', 'how-to', 'concepts', 'reference', 'contributing']);
  expect(docsPayload.entries.map(entry => entry.route)).toEqual(documentationRoutes);

  const russianDocsManifest = await request.get('/content/ru/documentation-manifest.json');
  expect(russianDocsManifest.ok()).toBeTruthy();
  const russianDocsPayload = await russianDocsManifest.json() as { schema_version: number; locale: string; sections: Array<{ id: string }>; entries: Array<{ route: string }> };
  expect(russianDocsPayload.schema_version).toBe(2);
  expect(russianDocsPayload.locale).toBe('ru');
  expect(russianDocsPayload.sections.map(section => section.id)).toEqual(['start', 'how-to', 'concepts', 'reference', 'contributing']);
  expect(russianDocsPayload.entries.map(entry => entry.route)).toEqual(russianDocumentationRoutes);

  const sitemap = await request.get('/sitemap.xml');
  const sitemapText = await sitemap.text();
  for (const route of [...publicRoutes, ...russianPublicRoutes]) expect(sitemapText).toContain(route);
  expect(sitemapText).not.toContain('/component-lab/');
});

test('unknown routes return the accessible not-found page with HTTP 404', async ({ page }) => {
  await openReadyDocument(page, '/missing-stratum', 404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('not part of the current model');
});

test('Russian unknown routes use the Russian 404, locale messages, and peer switcher', async ({ page }) => {
  await openReadyDocument(page, '/ru/missing-stratum', 404);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('html')).toHaveAttribute('data-locale', 'ru');
  await expect(page.locator('html')).toHaveAttribute('data-webawesome-locale', 'ru');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Эта страница не входит в текущую модель.');
  const switcher = page.getByRole('navigation', { name: 'Язык' });
  await expect(switcher.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/404.html');
  await expect(switcher.locator('[aria-current="page"]')).toHaveText('Русский');
  await expect(page.locator('[data-translation-notice]')).toHaveCount(0);
  await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('aria-label', 'Использовать тёмную тему');
});

test('selecting an unavailable language keeps the current page and announces localized status', semanticTest, async ({ page }, testInfo) => {
  await ready(page, '/component-lab/');
  const initialUrl = page.url();
  const russian = page.getByRole('navigation', { name: 'Language' }).getByRole('link', { name: 'Русский' });
  const notice = page.locator('[data-translation-notice]');
  await expect(notice).toBeHidden();
  await expectInteractiveState(page, 'TRANSLATION-NOTICE-HIDDEN', testInfo);

  await russian.focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(initialUrl);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Systems research, made operational.');
  await expect(russian).toBeFocused();
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText('A Russian translation of this page is not available. You are staying on the current page.');
  await expect(notice).toHaveAttribute('aria-live', 'polite');
  await expectInteractiveState(page, 'TRANSLATION-STATUS-ANNOUNCED', testInfo);
});

test('missing-translation notice has a static fragment fallback', async ({ request }) => {
  const response = await request.get('/component-lab/');
  const html = await response.text();
  expect(html).toContain('href="#pinega-translation-unavailable-ru"');
  expect(html).toContain('id="pinega-translation-unavailable-ru"');
  expect(html).toContain('role="status"');
  expect(html).toContain('A Russian translation of this page is not available.');
});

test('language selection is URL-owned and Accept-Language never redirects the default route', async ({ request }) => {
  const response = await request.get('/', { headers: { 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8' }, maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.url()).toMatch(/\/$/u);
  expect(await response.text()).toContain('<html lang="en"');
});

test('canonical pages emit static self-canonical and reciprocal-ready locale metadata', async ({ request }) => {
  const response = await request.get('/docs/');
  const html = await response.text();
  expect(html).toContain('<link rel="canonical" href="https://pinega.example/docs/">');
  expect(html).toContain('<link rel="alternate" hreflang="en" href="https://pinega.example/docs/">');
  expect(html).toContain('<link rel="alternate" hreflang="ru" href="https://pinega.example/ru/docs/">');
  expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://pinega.example/docs/">');
  expect(html).toContain('<meta property="og:locale" content="en_GB">');
});

test('core public pages have no serious or critical axe violations', async ({ page }) => {
  for (const route of [...corePublicRoutes, '/docs/concepts/pinega-engine-architecture/', '/docs/how-to/run-validation/']) {
    await ready(page, route);
    await page.addScriptTag({ path: axePath });
    const results = await page.evaluate(async () => {
      const axe = (window as unknown as Window & { axe: { run: (context: Document, options: unknown) => Promise<{ violations: Array<{ impact: string | null; id: string }> }> } }).axe;
      return axe.run(document, { resultTypes: ['violations'] });
    });
    const blocking = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
    expect(blocking, `${route}: ${blocking.map(violation => violation.id).join(', ')}`).toEqual([]);
  }
});

test('Russian core public pages have no serious or critical axe violations', async ({ page }) => {
  for (const route of [...russianCorePublicRoutes, '/ru/docs/concepts/pinega-engine-architecture/', '/ru/docs/how-to/run-validation/', '/ru/404.html']) {
    await ready(page, route);
    await page.addScriptTag({ path: axePath });
    const results = await page.evaluate(async () => {
      const axe = (window as unknown as Window & { axe: { run: (context: Document, options: unknown) => Promise<{ violations: Array<{ impact: string | null; id: string }> }> } }).axe;
      return axe.run(document, { resultTypes: ['violations'] });
    });
    const blocking = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
    expect(blocking, `${route}: ${blocking.map(violation => violation.id).join(', ')}`).toEqual([]);
  }
});

test('every English documentation page has no serious or critical axe violations', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Complete documentation accessibility corpus is exercised once.');
  for (const route of documentationRoutes) {
    await ready(page, route);
    await page.addScriptTag({ path: axePath });
    const results = await page.evaluate(async () => {
      const axe = (window as unknown as Window & { axe: { run: (context: Document, options: unknown) => Promise<{ violations: Array<{ impact: string | null; id: string }> }> } }).axe;
      return axe.run(document, { resultTypes: ['violations'] });
    });
    const blocking = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
    expect(blocking, `${route}: ${blocking.map(violation => violation.id).join(', ')}`).toEqual([]);
  }
});

test('every Russian documentation page has no serious or critical axe violations', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Complete documentation accessibility corpus is exercised once.');
  for (const route of russianDocumentationRoutes) {
    await ready(page, route);
    await page.addScriptTag({ path: axePath });
    const results = await page.evaluate(async () => {
      const axe = (window as unknown as Window & { axe: { run: (context: Document, options: unknown) => Promise<{ violations: Array<{ impact: string | null; id: string }> }> } }).axe;
      return axe.run(document, { resultTypes: ['violations'] });
    });
    const blocking = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
    expect(blocking, `${route}: ${blocking.map(violation => violation.id).join(', ')}`).toEqual([]);
  }
});
