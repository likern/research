import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');
const publicRoutes = [
  '/',
  '/technology/',
  '/research/',
  '/docs/',
  '/docs/getting-started/',
  '/about/',
];
const allRoutes = [...publicRoutes, '/component-lab/'];

async function ready(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), `${route} should return a successful response`).toBeLessThan(400);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
}

for (const route of allRoutes) {
  test(`${route} keeps semantic landmarks and fits the active viewport`, async ({ page }) => {
    await ready(page, route);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.locator('pinega-site-header')).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('public navigation exposes the programme hierarchy and hides the component lab', async ({ page }) => {
  for (const route of publicRoutes) {
    await ready(page, route);
    const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
    await expect(navigation.getByRole('link', { name: 'Technology', exact: true })).toHaveAttribute('href', '/technology/');
    await expect(navigation.getByRole('link', { name: 'Research', exact: true })).toHaveAttribute('href', '/research/');
    await expect(navigation.getByRole('link', { name: 'Documentation', exact: true })).toHaveAttribute('href', '/docs/');
    await expect(navigation.getByRole('link', { name: 'About', exact: true })).toHaveAttribute('href', '/about/');
    await expect(navigation.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute('href', 'https://github.com/likern/research');
    await expect(navigation.getByRole('link', { name: 'Design system' })).toHaveCount(0);
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
  await expect(page.getByRole('table')).toContainText('no production engine binary');
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
  await expect(page.getByText('No item below is presented as a shipped product', { exact: false })).toBeVisible();
});

test('documentation topic filter enhances durable cards without claiming full-text search', async ({ page }) => {
  await ready(page, '/docs/');
  const cards = page.locator('[data-doc-card]');
  await expect(cards).toHaveCount(8);
  await expect(page.getByRole('heading', { name: 'Filter documentation topics' })).toBeVisible();

  const input = page.locator('[data-doc-search-input]');
  await input.evaluate((element: HTMLElement & { value?: string }) => {
    element.value = 'engine architecture';
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  });
  const visibleTitles = await cards.evaluateAll(elements =>
    elements
      .filter(element => !(element as HTMLElement).hidden)
      .map(element => element.querySelector('h3')?.textContent?.trim()),
  );
  expect(visibleTitles).toEqual(['Pinega Engine architecture']);
  await expect(page.locator('[data-doc-search-status]')).toHaveText('1 of 8 topics');
});

test('getting-started page exposes programme boundaries and working commands', async ({ page }) => {
  await ready(page, '/docs/getting-started/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('programme and workspace');
  await expect(page.locator('pinega-code-example')).toHaveCount(3);
  await expect(page.getByRole('navigation', { name: 'Documentation sections' })).toBeAttached();
  await expect(page.locator('aside[aria-label="On this page"]')).toBeAttached();
  await expect(page.getByText('does not present an installable Pinega database engine', { exact: false })).toBeVisible();
  await expect(page.getByText('Pinega Engine is the first active implementation programme', { exact: false })).toBeVisible();
});

test('research landing exposes the area catalogue, method, and existing diagrams', async ({ page }) => {
  await ready(page, '/research/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Research is part');
  await expect(page.locator('#research-areas .pinega-research-programme > article')).toHaveCount(7);
  await expect(page.locator('.pinega-research-ledger span')).toHaveCount(5);
  await expect(page.locator('.pinega-research-timeline > [role="listitem"]')).toHaveCount(5);
  await expect(page.locator('figure[data-diagram-id]')).toHaveCount(3);
  await expect(page.locator('#method')).toBeAttached();
});

test('about page distinguishes Pinega, Pinega Labs, and future offerings', async ({ page }) => {
  await ready(page, '/about/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('defensible database technology');
  await expect(page.getByText('Pinega is the master technology and product programme', { exact: false })).toBeVisible();
  await expect(page.getByText('Pinega Labs is the working research', { exact: false })).toBeVisible();
  await expect(page.getByText('There is no current production engine release', { exact: false })).toBeVisible();
  await expect(page.locator('.pinega-principle-grid wa-card')).toHaveCount(6);
});

test('generated discovery files expose registry metadata and public routes only', async ({ request }) => {
  const manifest = await request.get('/site-manifest.json');
  expect(manifest.ok()).toBeTruthy();
  const payload = await manifest.json() as {
    site: { tagline: string };
    primaryNavigation: Array<{ label: string; route?: string; href?: string }>;
    routes: Array<{ id: string; route: string; sitemap: boolean; searchable: boolean; public: boolean }>;
  };

  expect(payload.site.tagline).toBe('Correctness under concurrency.');
  expect(payload.primaryNavigation.map(item => item.route ?? item.href)).toEqual([
    '/technology/',
    '/research/',
    '/docs/',
    '/about/',
    'https://github.com/likern/research',
  ]);
  expect(payload.routes.map(entry => entry.route)).toEqual([
    '/',
    '/technology/',
    '/research/',
    '/docs/',
    '/docs/getting-started/',
    '/about/',
    '/component-lab/',
    '/404.html',
  ]);
  expect(payload.routes.filter(entry => entry.sitemap).map(entry => entry.route)).toEqual(publicRoutes);
  expect(payload.routes.filter(entry => entry.searchable).map(entry => entry.route)).toEqual(publicRoutes);

  const componentLab = payload.routes.find(entry => entry.id === 'component-lab');
  expect(componentLab).toEqual(expect.objectContaining({ public: false, sitemap: false, searchable: false }));

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  const sitemapText = await sitemap.text();
  for (const route of publicRoutes) expect(sitemapText).toContain(route);
  expect(sitemapText).not.toContain('/component-lab/');
  expect(sitemapText).not.toContain('/404.html');

  const registry = await request.get('/content/content-index.json');
  expect(registry.ok()).toBeTruthy();
  const registryPayload = await registry.json() as { schema_version: number; entries: unknown[] };
  expect(registryPayload.schema_version).toBe(1);
  expect(registryPayload.entries).toHaveLength(8);

  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Sitemap: https://pinega.example/sitemap.xml');
});

test('unknown routes return the accessible not-found page with HTTP 404', async ({ page }) => {
  const response = await page.goto('/missing-stratum', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('not part of the current model');
  await expect(page.locator('.pinega-not-found').getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', '/docs/');
});

test('public pages have no serious or critical axe violations', async ({ page }) => {
  for (const route of publicRoutes) {
    await ready(page, route);
    await page.addScriptTag({ path: axePath });
    const results = await page.evaluate(async () => {
      const axe = (window as unknown as Window & {
        axe: {
          run: (
            context: Document,
            options: unknown,
          ) => Promise<{ violations: Array<{ impact: string | null; id: string }> }>;
        };
      }).axe;
      return axe.run(document, { resultTypes: ['violations'] });
    });
    const blocking = results.violations.filter(
      violation => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(blocking, `${route}: ${blocking.map(violation => violation.id).join(', ')}`).toEqual([]);
  }
});
