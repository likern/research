import { expect, test, type Page, type Request } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const malformedFixture = await readFile(resolve(root, 'fixtures/navigation/malformed.html'), 'utf8');

async function ready(page: Page, route: string): Promise<void> {
  const response = await page.goto(route, { waitUntil: 'commit' });
  expect(response?.status(), `${route} should return a successful response`).toBeLessThan(400);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
}

async function instrumentDocument(page: Page): Promise<number> {
  return page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('pinega-site-header');
    if (!header) throw new Error('Missing persistent site header');
    header.dataset.testShellIdentity = 'preserved';
    document.documentElement.dataset.testNavigationCommits = '0';
    window.addEventListener('pinega:navigation-commit', () => {
      const root = document.documentElement;
      root.dataset.testNavigationCommits = String(Number(root.dataset.testNavigationCommits ?? 0) + 1);
    });
    return performance.timeOrigin;
  });
}

function requestsFor(requests: Request[], pathname: string): Request[] {
  return requests.filter(request => new URL(request.url()).pathname === pathname);
}

test('eligible navigation commits validated route state without replacing the Document or shell', async ({ page }) => {
  await ready(page, '/');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-navigation', 'enhanced');
  const timeOrigin = await instrumentDocument(page);
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));

  await page.locator('[data-primary-navigation] a[href="/technology/"]').click();

  await expect(page).toHaveURL(/\/technology\/$/u);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Research becomes technology');
  await expect(page).toHaveTitle('Technology — Pinega');
  await expect(page.locator('html')).toHaveAttribute('data-page', 'technology');
  await expect(page.locator('body')).toHaveAttribute('data-pinega-route', 'technology');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://pinega.example/technology/');
  await expect(page.locator('pinega-site-header')).toHaveAttribute('data-test-shell-identity', 'preserved');
  await expect(page.locator('a.pinega-brand')).not.toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-primary-navigation] a[href="/technology/"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-pinega-language-switcher] a[hreflang="ru"]')).toHaveAttribute('href', '/ru/technology/');

  const runtime = await page.evaluate(() => ({
    timeOrigin: performance.timeOrigin,
    navigationEntries: performance.getEntries().filter(entry => String(entry.entryType) === 'navigation').length,
    commits: document.documentElement.dataset.testNavigationCommits,
  }));
  expect(runtime).toEqual({ timeOrigin, navigationEntries: 1, commits: '1' });
  expect(requestsFor(requests, '/technology/').map(request => request.resourceType())).toEqual(['fetch']);
});

test('Back and Forward traverse same-document entries through the coordinator', async ({ page }) => {
  await ready(page, '/');
  const timeOrigin = await instrumentDocument(page);
  await page.locator('[data-primary-navigation] a[href="/technology/"]').click();
  await expect(page).toHaveURL(/\/technology\/$/u);

  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/127\.0\.0\.1:4173\/$/u);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Correctness under concurrency.');
  await expect(page.locator('[data-pinega-language-switcher] a[hreflang="ru"]')).toHaveAttribute('href', '/ru/');

  await page.evaluate(() => history.forward());
  await expect(page).toHaveURL(/\/technology\/$/u);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Research becomes technology');
  await expect(page.locator('pinega-site-header')).toHaveAttribute('data-test-shell-identity', 'preserved');
  expect(await page.evaluate(() => ({
    timeOrigin: performance.timeOrigin,
    commits: document.documentElement.dataset.testNavigationCommits,
  }))).toEqual({ timeOrigin, commits: '3' });
});

test('selecting the active route performs zero network and zero visible commits', async ({ page }) => {
  await ready(page, '/technology/');
  await instrumentDocument(page);
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));

  await page.locator('[data-primary-navigation] a[href="/technology/"]').click();
  await page.waitForTimeout(100);

  await expect(page).toHaveURL(/\/technology\/$/u);
  await expect(page.locator('html')).toHaveAttribute('data-test-navigation-commits', '0');
  expect(requestsFor(requests, '/technology/')).toHaveLength(0);
});

test('a superseded response cannot commit over the latest navigation', async ({ page }) => {
  await ready(page, '/');
  await instrumentDocument(page);
  let releaseTechnology: (() => void) | undefined;
  let technologyStarted: (() => void) | undefined;
  const started = new Promise<void>(resolveStarted => {
    technologyStarted = resolveStarted;
  });
  const release = new Promise<void>(resolveRelease => {
    releaseTechnology = resolveRelease;
  });
  await page.route('**/technology/', async route => {
    if (route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    technologyStarted?.();
    await release;
    try {
      await route.continue();
    } catch {
      // The first fetch is expected to be aborted by the second navigation.
    }
  });

  await page.evaluate(() => document.querySelector<HTMLElement>('[data-primary-navigation] a[href="/technology/"]')?.click());
  await started;
  await page.evaluate(() => document.querySelector<HTMLElement>('[data-primary-navigation] a[href="/research/"]')?.click());
  await expect(page).toHaveURL(/\/research\/$/u);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Research is part');
  releaseTechnology?.();
  await page.waitForTimeout(100);

  await expect(page).toHaveURL(/\/research\/$/u);
  await expect(page.locator('html')).toHaveAttribute('data-test-navigation-commits', '1');
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'research');
});

test('cross-locale navigation remains a truthful native document transition', async ({ page }) => {
  await ready(page, '/docs/');
  await instrumentDocument(page);
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));

  await page.locator('[data-pinega-language-switcher] a[href="/ru/docs/"]').click();

  await expect(page).toHaveURL(/\/ru\/docs\/$/u);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await expect(page.locator('pinega-site-header')).not.toHaveAttribute('data-test-shell-identity', 'preserved');
  await expect(page.locator('[data-primary-navigation] a[href="/ru/docs/"]')).toHaveText('Документация');
  expect(requestsFor(requests, '/ru/docs/').map(request => request.resourceType())).toEqual(['document']);
});

test('native-only route policy protects shell-incompatible internal documents', async ({ page }) => {
  await ready(page, '/component-lab/');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-navigation', 'native-policy');
  await page.locator('pinega-site-header').evaluate((header: HTMLElement) => {
    header.dataset.testShellIdentity = 'component-lab';
  });

  await page.locator('a.pinega-brand[href="/"]').click();

  await expect(page).toHaveURL(/127\.0\.0\.1:4173\/$/u);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await expect(page.locator('pinega-site-header')).not.toHaveAttribute('data-test-shell-identity', 'component-lab');
  await expect(page.locator('footer.pinega-site-footer')).toBeVisible();
});

for (const fault of [
  { id: 'malformed contract', contentType: 'text/html; charset=utf-8', body: malformedFixture },
  { id: 'non-HTML response', contentType: 'text/plain; charset=utf-8', body: 'not HTML' },
]) {
  test(`${fault.id} hard-falls back once without committing unvalidated content`, async ({ page }) => {
    const requestTypes: string[] = [];
    let injected = false;
    await page.route('**/technology/', async route => {
      const type = route.request().resourceType();
      requestTypes.push(type);
      if (type === 'fetch' && !injected) {
        injected = true;
        await route.fulfill({ status: 200, contentType: fault.contentType, body: fault.body });
        return;
      }
      await route.continue();
    });
    await ready(page, '/');
    await instrumentDocument(page);

    await page.locator('[data-primary-navigation] a[href="/technology/"]').click();

    await expect(page).toHaveURL(/\/technology\/$/u);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Research becomes technology');
    await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
    await expect(page.locator('pinega-site-header')).not.toHaveAttribute('data-test-shell-identity', 'preserved');
    expect(requestTypes).toEqual(['fetch', 'document']);
  });
}

test('a real 404 falls back to one native localized not-found document', async ({ page }) => {
  await ready(page, '/');
  await instrumentDocument(page);
  const requestTypes: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/missing-navigation-route') requestTypes.push(request.resourceType());
  });
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = '/missing-navigation-route';
    link.textContent = 'Missing route';
    document.body.append(link);
    link.click();
  });

  await expect(page).toHaveURL(/\/missing-navigation-route$/u);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('not part of the current model');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-navigation', 'native-policy');
  await expect(page.locator('pinega-site-header')).not.toHaveAttribute('data-test-shell-identity', 'preserved');
  expect(requestTypes).toEqual(['fetch', 'document']);
});

test('semantic links remain complete MPA navigation with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    const response = await page.goto('http://127.0.0.1:4173/', { waitUntil: 'load' });
    expect(response?.status()).toBe(200);
    await page.locator('pinega-site-header').evaluate((header: HTMLElement) => {
      header.dataset.testShellIdentity = 'no-js';
    });

    await page.locator('[data-primary-navigation] a[href="/technology/"]').click();

    await expect(page).toHaveURL(/\/technology\/$/u);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Research becomes technology');
    await expect(page.locator('html')).not.toHaveAttribute('data-pinega-ready', 'true');
    await expect(page.locator('pinega-site-header')).not.toHaveAttribute('data-test-shell-identity', 'no-js');
  } finally {
    await context.close();
  }
});
