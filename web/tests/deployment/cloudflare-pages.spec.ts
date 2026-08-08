import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');
const expectedDist = process.env.PINEGA_EXPECTED_DIST;
if (!expectedDist) throw new TypeError('PINEGA_EXPECTED_DIST is required for deployment smoke tests');
const expectedManifestPath = resolve(expectedDist, '.well-known/pinega-deployment.json');
const hasRussianNotFound = existsSync(resolve(expectedDist, 'ru/404.html'));

test('immutable preview exposes the exact build provenance and stays unindexed', async ({ request }) => {
  const expectedManifest = JSON.parse(await readFile(expectedManifestPath, 'utf8'));
  const response = await request.get('/.well-known/pinega-deployment.json');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(await response.json()).toEqual(expectedManifest);

  const root = await request.get('/');
  expect(root.status()).toBe(200);
  expect(root.headers()['x-robots-tag']?.toLowerCase()).toContain('noindex');
});

test('Cloudflare Pages serves essential routes and a real nearest 404', async ({ request }) => {
  for (const route of ['/', '/docs/']) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
    expect(response.headers()['content-type'], route).toContain('text/html');
  }

  const missing = await request.get('/missing-cloudflare-preview-route');
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain('<h1>');

  if (hasRussianNotFound) {
    const russianMissing = await request.get('/ru/missing-cloudflare-preview-route');
    expect(russianMissing.status()).toBe(404);
    expect(await russianMissing.text()).toMatch(/<html\b[^>]*\blang="ru"/u);
  }
});

test('deployed navigation and static assets load without browser console errors', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));

  await ready(page, '/');
  const assetUrls = await page.locator('link[rel="stylesheet"][href], script[src]').evaluateAll(elements =>
    elements.map(element => element instanceof HTMLLinkElement ? element.href : (element as HTMLScriptElement).src),
  );
  expect(assetUrls.length).toBeGreaterThan(0);
  for (const assetUrl of assetUrls) {
    const response = await request.get(assetUrl);
    expect(response.status(), assetUrl).toBeLessThan(400);
  }

  await page.getByRole('link', { name: 'Documentation' }).first().click();
  await expect(page).toHaveURL(/\/docs\/$/u);
  await expect(page.getByRole('main')).toBeVisible();
  expect(errors).toEqual([]);
});

test('deployed homepage has no serious or critical accessibility violations', async ({ page }) => {
  await ready(page, '/');
  await page.addScriptTag({ path: axePath });
  const results = await page.evaluate(async () => {
    const axe = (window as unknown as Window & {
      axe: { run: (context: Document, options: unknown) => Promise<{ violations: Array<{ impact: string | null; id: string }> }> };
    }).axe;
    return axe.run(document, { resultTypes: ['violations'] });
  });
  const blocking = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking, blocking.map(violation => violation.id).join(', ')).toEqual([]);
});

async function ready(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'networkidle' });
  expect(response?.status(), route).toBeLessThan(400);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
}
