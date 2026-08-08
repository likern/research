import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';

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
const corePublicRoutes = ['/', '/technology/', '/research/', '/docs/', '/about/'];
const publicRoutes = ['/', '/technology/', '/research/', '/docs/', ...documentationRoutes, '/about/'];
const allCoreRoutes = [...corePublicRoutes, '/docs/getting-started/', '/component-lab/'];

async function ready(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'commit' });
  expect(response?.status(), `${route} should return a successful response`).toBeLessThan(400);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
}

for (const route of allCoreRoutes) {
  test(`${route} keeps semantic landmarks and fits the active viewport`, async ({ page }) => {
    await ready(page, route);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.locator('pinega-site-header')).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('complete documentation corpus resolves with semantic article shells', async ({ page }, testInfo) => {
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
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Research becomes technology');
  await expect(page.locator('#pinega-engine')).toBeAttached();
  await expect(page.locator('#optimisation')).toBeAttached();
  await expect(page.locator('#verification')).toBeAttached();
  await expect(page.locator('#distributed-systems')).toBeAttached();
  await expect(page.locator('#engine-architecture .pinega-architecture-layers > li')).toHaveCount(4);
  await expect(page.getByText('One PostgreSQL WAL', { exact: true })).toBeVisible();
});

test('documentation landing filters real metadata-backed pages by topic and group', async ({ page }) => {
  await ready(page, '/docs/');
  const cards = page.locator('[data-doc-card]');
  await expect(cards).toHaveCount(13);
  await expect(page.locator('[data-doc-group]')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'Filter documentation topics' })).toBeVisible();
  await expect(page.locator('[data-doc-search-status]')).toHaveText('13 pages');

  const input = page.locator('[data-doc-search-input]');
  await input.evaluate((element: HTMLElement & { value?: string }) => {
    element.value = 'engine architecture';
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  });
  const visibleTitles = await cards.evaluateAll(elements =>
    elements.filter(element => !(element as HTMLElement).hidden).map(element => element.querySelector('h4')?.textContent?.trim()),
  );
  expect(visibleTitles).toEqual(['Pinega Engine architecture']);
  await expect(page.locator('[data-doc-search-status]')).toHaveText('1 of 13 pages');
  await expect(page.locator('[data-doc-group]:not([hidden])')).toHaveCount(1);

  await input.evaluate((element: HTMLElement & { value?: string }) => {
    element.value = 'does-not-exist';
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  });
  await expect(page.locator('[data-doc-search-empty]')).toBeVisible();
  await expect(page.locator('[data-doc-group]:not([hidden])')).toHaveCount(0);
});

test('documentation catalogue remains complete without JavaScript', async ({ request }) => {
  const response = await request.get('/docs/');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect((html.match(/data-doc-card/gu) ?? []).length).toBe(13);
  expect((html.match(/data-doc-group/gu) ?? []).length).toBe(5);
  expect(html).not.toContain('hidden data-doc-card');
  expect(html).toContain('/docs/concepts/pinega-engine-architecture/');
  expect(html).toContain('/docs/reference/content-metadata-schema/');
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

test('about page distinguishes Pinega, Pinega Labs, and future offerings', async ({ page }) => {
  await ready(page, '/about/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('defensible database technology');
  await expect(page.getByText('Pinega is the master technology and product programme', { exact: false })).toBeVisible();
  await expect(page.getByText('Pinega Labs is the working research', { exact: false })).toBeVisible();
});

test('generated discovery files expose the complete documentation corpus', async ({ request }) => {
  const manifest = await request.get('/site-manifest.json');
  expect(manifest.ok()).toBeTruthy();
  const payload = await manifest.json() as {
    schemaVersion: number;
    site: { tagline: string; defaultLocale: string; locales: Record<string, { pathPrefix: string }> };
    routes: Array<{ id: string; locale: string; route: string; sitemap: boolean; searchable: boolean; public: boolean; documentation?: unknown }>;
  };
  expect(payload.schemaVersion).toBe(3);
  expect(payload.site.tagline).toBe('Correctness under concurrency.');
  expect(payload.site.defaultLocale).toBe('en');
  expect(payload.site.locales.ru?.pathPrefix).toBe('/ru');
  expect(payload.routes.filter(entry => entry.sitemap).map(entry => entry.route)).toEqual(publicRoutes);
  expect(payload.routes.filter(entry => entry.searchable).map(entry => entry.route)).toEqual(publicRoutes);
  expect(payload.routes.filter(entry => entry.documentation && entry.route !== '/docs/')).toHaveLength(13);
  expect(payload.routes.filter(entry => entry.locale === 'ru').map(entry => entry.route)).toEqual(['/ru/404.html']);

  const registry = await request.get('/content/content-index.json');
  const registryPayload = await registry.json() as { schema_version: number; entries: unknown[] };
  expect(registryPayload.schema_version).toBe(3);
  expect(registryPayload.entries).toHaveLength(20);

  const docsManifest = await request.get('/content/en/documentation-manifest.json');
  expect(docsManifest.ok()).toBeTruthy();
  const docsPayload = await docsManifest.json() as { schema_version: number; locale: string; sections: Array<{ id: string }>; entries: Array<{ route: string }> };
  expect(docsPayload.schema_version).toBe(2);
  expect(docsPayload.locale).toBe('en');
  expect(docsPayload.sections.map(section => section.id)).toEqual(['start', 'how-to', 'concepts', 'reference', 'contributing']);
  expect(docsPayload.entries.map(entry => entry.route)).toEqual(documentationRoutes);

  const russianDocsManifest = await request.get('/content/ru/documentation-manifest.json');
  expect(russianDocsManifest.ok()).toBeTruthy();
  const russianDocsPayload = await russianDocsManifest.json() as { schema_version: number; locale: string; sections: unknown[]; entries: unknown[] };
  expect(russianDocsPayload).toEqual({ schema_version: 2, locale: 'ru', sections: [], entries: [] });

  const sitemap = await request.get('/sitemap.xml');
  const sitemapText = await sitemap.text();
  for (const route of publicRoutes) expect(sitemapText).toContain(route);
  expect(sitemapText).not.toContain('/component-lab/');
});

test('unknown routes return the accessible not-found page with HTTP 404', async ({ page }) => {
  const response = await page.goto('/missing-stratum', { waitUntil: 'commit' });
  expect(response?.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('not part of the current model');
});

test('Russian unknown routes use the Russian 404, locale messages, and peer switcher', async ({ page }) => {
  const response = await page.goto('/ru/missing-stratum', { waitUntil: 'commit' });
  expect(response?.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('html')).toHaveAttribute('data-locale', 'ru');
  await expect(page.locator('html')).toHaveAttribute('data-webawesome-locale', 'ru');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Эта страница не входит в текущую модель.');
  const switcher = page.getByRole('navigation', { name: 'Язык' });
  await expect(switcher.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/404.html');
  await expect(switcher.getByRole('link', { name: 'Русский' })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-theme-toggle]')).toHaveText('Использовать тёмную тему');
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
  expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://pinega.example/docs/">');
  expect(html).toContain('<meta property="og:locale" content="en_GB">');
});

test('core public pages have no serious or critical axe violations', async ({ page }) => {
  for (const route of [...corePublicRoutes, '/docs/concepts/pinega-engine-architecture/', '/docs/how-to/run-validation/', '/ru/404.html']) {
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

test('every documentation page has no serious or critical axe violations', async ({ page }, testInfo) => {
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
