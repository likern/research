import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');
const expectedDist = process.env.PINEGA_EXPECTED_DIST;
if (!expectedDist) throw new TypeError('PINEGA_EXPECTED_DIST is required for deployment smoke tests');
const expectedManifestPath = resolve(expectedDist, '.well-known/pinega-deployment.json');
const expectedReleaseManifestPath = resolve(expectedDist, '.well-known/pinega-release.json');
const hasRussianNotFound = existsSync(resolve(expectedDist, 'ru/404.html'));

interface ReleaseFile {
  path: string;
  url: string;
  status: number;
  bytes: number;
  sha256: string;
  cacheControl: string;
  mediaType: string | null;
}

interface ReleaseManifest {
  buildId: string;
  inventory: { fileCount: number; sha256: string };
  files: ReleaseFile[];
}

test('immutable preview exposes the exact build provenance and stays unindexed', async ({ request }) => {
  const expectedManifest = JSON.parse(await readFile(expectedManifestPath, 'utf8'));
  const response = await request.get('/.well-known/pinega-deployment.json');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(response.headers()['cache-control']).toBe('public, max-age=0, must-revalidate');
  expect(response.headers().etag).toBeTruthy();
  expect(await response.json()).toEqual(expectedManifest);

  const root = await request.get('/');
  expect(root.status()).toBe(200);
  expect(root.headers()['x-robots-tag']?.toLowerCase()).toContain('noindex');
});

test('the HTTPS preview serves every inventoried byte with the declared HTTP contract', async ({ request }) => {
  test.setTimeout(120_000);
  const expected = JSON.parse(await readFile(expectedReleaseManifestPath, 'utf8')) as ReleaseManifest;
  const releaseResponse = await request.get('/.well-known/pinega-release.json');
  expect(releaseResponse.status()).toBe(200);
  expect(releaseResponse.headers()['cache-control']).toBe('public, max-age=0, must-revalidate');
  expect(releaseResponse.headers().etag).toBeTruthy();
  expect(await releaseResponse.json()).toEqual(expected);

  expect(expected.files).toHaveLength(expected.inventory.fileCount);
  for (let offset = 0; offset < expected.files.length; offset += 8) {
    await Promise.all(expected.files.slice(offset, offset + 8).map(async file => {
      const response = await request.get(file.url, { failOnStatusCode: false });
      expect(response.status(), file.path).toBe(file.status);
      expect(response.headers()['cache-control'], file.path).toBe(file.cacheControl);
      if (file.status === 200) expect(response.headers().etag, file.path).toBeTruthy();
      if (file.mediaType) expect(response.headers()['content-type'], file.path).toContain(file.mediaType);
      const body = await response.body();
      expect(body.byteLength, file.path).toBe(file.bytes);
      expect(createHash('sha256').update(body).digest('hex'), file.path).toBe(file.sha256);
    }));
  }
});

test('revalidated HTML honors its deployed ETag while fingerprinted assets stay immutable', async ({ request }) => {
  const root = await request.get('/');
  expect(root.status()).toBe(200);
  expect(root.headers()['cache-control']).toBe('public, max-age=0, must-revalidate');
  const etag = root.headers().etag;
  expect(etag).toBeTruthy();
  if (!etag) throw new TypeError('Deployed HTML response omitted ETag');
  const conditional = await request.get('/', {
    failOnStatusCode: false,
    headers: { 'If-None-Match': etag },
  });
  expect(conditional.status()).toBe(304);

  const expected = JSON.parse(await readFile(expectedReleaseManifestPath, 'utf8')) as ReleaseManifest;
  const immutable = expected.files.find(file => file.url.startsWith('/assets/') && file.status === 200);
  expect(immutable).toBeTruthy();
  const asset = await request.get(immutable!.url);
  expect(asset.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
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

  const timeOrigin = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('pinega-site-header');
    if (!header) throw new Error('Missing deployed site header');
    header.dataset.deploymentShell = 'persistent';
    return performance.timeOrigin;
  });
  await page.getByRole('link', { name: 'Documentation' }).first().click();
  await expect(page).toHaveURL(/\/docs\/$/u);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-pinega-navigation', 'enhanced');
  await expect(page.locator('pinega-site-header')).toHaveAttribute('data-deployment-shell', 'persistent');
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);

  await page.locator('[data-pinega-language-switcher] a[href="/ru/docs/"]').click();
  await expect(page).toHaveURL(/\/ru\/docs\/$/u);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('html')).toHaveAttribute('data-webawesome-locale', 'ru');
  await expect(page.locator('pinega-site-header')).toHaveAttribute('data-deployment-shell', 'persistent');
  await expect(page.locator('footer.pinega-site-footer')).toContainText('Исследования и инженерия систем баз данных');
  await expect(page.locator('main')).toBeFocused();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  expect(errors).toEqual([]);
});

test('deployed homepage has no serious or critical accessibility violations', async ({ page }) => {
  await ready(page, '/');
  await page.addScriptTag({ path: axePath });
  const results = await page.evaluate(async () => {
    const axe = (window as unknown as Window & {
      axe: { run: (context: Document, options: unknown) => Promise<{ violations: Array<{ impact: string | null; id: string }> }> };
    }).axe;
    return axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      resultTypes: ['violations'],
    });
  });
  const blocking = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking, blocking.map(violation => violation.id).join(', ')).toEqual([]);
});

async function ready(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'networkidle' });
  expect(response?.status(), route).toBeLessThan(400);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
}
