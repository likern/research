import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');
const publicRoutes = ['/', '/docs/', '/docs/getting-started/', '/research/'];
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
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('homepage states the research boundary and architecture maturity', async ({ page }) => {
  await ready(page, '/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('storage engine');
  await expect(page.getByText('it is not a production release', { exact: false })).toBeVisible();
  await expect(page.locator('.pinega-home-status .pinega-status-card')).toHaveCount(3);
  await expect(page.locator('.pinega-architecture-layers > li')).toHaveCount(4);
  await expect(page.getByRole('table')).toContainText('No production binary or performance claim yet');
});

test('documentation search filters durable cards without replacing their markup', async ({ page }) => {
  await ready(page, '/docs/');
  const cards = page.locator('[data-doc-card]');
  await expect(cards).toHaveCount(8);
  const input = page.locator('[data-doc-search-input]');
  await input.evaluate((element: HTMLElement & { value?: string }) => {
    element.value = 'durability';
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  });
  const visibleTitles = await cards.evaluateAll(elements => elements.filter(element => !(element as HTMLElement).hidden).map(element => element.querySelector('h3')?.textContent?.trim()));
  expect(visibleTitles).toEqual(['WAL and durability']);
  await expect(page.locator('[data-doc-search-status]')).toHaveText('1 of 8 topics');
});

test('getting-started page exposes real workspace commands and a table of contents', async ({ page }) => {
  await ready(page, '/docs/getting-started/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Getting started');
  await expect(page.locator('pinega-code-example')).toHaveCount(3);
  await expect(page.getByRole('navigation', { name: 'Documentation sections' })).toBeAttached();
  await expect(page.locator('aside[aria-label="On this page"]')).toBeAttached();
  await expect(page.getByText('does not present an installable Pinega database engine', { exact: false })).toBeVisible();
});

test('research page exposes provenance and concurrent-lifetime stages', async ({ page }) => {
  await ready(page, '/research/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Research is part');
  await expect(page.locator('.pinega-research-ledger span')).toHaveCount(5);
  await expect(page.locator('.pinega-research-timeline > [role="listitem"]')).toHaveCount(5);
  await expect(page.locator('#versioned-storage')).toBeAttached();
  await expect(page.locator('#concurrent-lifetimes')).toBeAttached();
});

test('generated discovery files expose public routes only', async ({ request }) => {
  const manifest = await request.get('/site-manifest.json');
  expect(manifest.ok()).toBeTruthy();
  const payload = await manifest.json() as { routes: Array<{ route: string; sitemap: boolean }> };
  expect(payload.routes.map(entry => entry.route)).toEqual(['/', '/docs/', '/docs/getting-started/', '/research/', '/component-lab/', '/404.html']);

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  const sitemapText = await sitemap.text();
  for (const route of publicRoutes) expect(sitemapText).toContain(route);
  expect(sitemapText).not.toContain('/component-lab/');

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
      const axe = (window as unknown as Window & { axe: { run: (context: Document, options: unknown) => Promise<{ violations: Array<{ impact: string | null; id: string }> }> } }).axe;
      return axe.run(document, { resultTypes: ['violations'] });
    });
    const blocking = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
    expect(blocking, `${route}: ${blocking.map(violation => violation.id).join(', ')}`).toEqual([]);
  }
});
