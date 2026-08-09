import { expect, test, type Page, type Request } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const malformedFixture = await readFile(resolve(root, 'fixtures/navigation/malformed.html'), 'utf8');
const transactionEventsKey = 'pinega-test-navigation-transaction-events';

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

async function activateCoordinatorLink(page: Page, selector: string): Promise<void> {
  await page.locator(selector).evaluate((link: HTMLAnchorElement) => link.click());
}

async function instrumentTransactionEvents(page: Page): Promise<void> {
  await page.evaluate(storageKey => {
    sessionStorage.setItem(storageKey, '[]');
    const record = (type: string, detail: unknown): void => {
      const events = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]') as unknown[];
      events.push({ type, detail });
      sessionStorage.setItem(storageKey, JSON.stringify(events));
    };
    window.addEventListener('pinega:navigation-commit', event => {
      record('commit', (event as CustomEvent).detail);
    });
    window.addEventListener('pinega:navigation-fallback', event => {
      record('fallback', (event as CustomEvent).detail);
    });
  }, transactionEventsKey);
}

test('eligible navigation commits validated route state without replacing the Document or shell', async ({ page }) => {
  await ready(page, '/');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-navigation', 'enhanced');
  const timeOrigin = await instrumentDocument(page);
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));

  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');

  await expect(page).toHaveURL(/\/technology\/$/u);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Research becomes technology');
  await expect(page).toHaveTitle('Technology — Pinega');
  await expect(page.locator('html')).toHaveAttribute('data-page', 'technology');
  await expect(page.locator('body')).toHaveAttribute('data-pinega-route', 'technology');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://pinega.example/technology/');
  await expect(page.locator('pinega-site-header')).toHaveAttribute('data-test-shell-identity', 'preserved');
  await expect(page.locator('pinega-site-header a.pinega-brand')).not.toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-primary-navigation] a[href="/technology/"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-pinega-language-switcher] a[hreflang="ru"]')).toHaveAttribute('href', '/ru/technology/');
  await expect(page.locator('main')).toBeFocused();
  await expect(page.locator('[data-pinega-navigation-announcer]')).toHaveText('Technology — Pinega');

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
  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');
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
  const activeUrl = await page.evaluate(() => location.href);
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));

  await page.locator('[data-primary-navigation] a[href="/technology/"]').focus();
  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');
  await page.waitForTimeout(100);

  expect(await page.evaluate(() => ({
    url: location.href,
    commits: document.documentElement.dataset.testNavigationCommits,
    announcement: document.querySelector('[data-pinega-navigation-announcer]')?.textContent,
  }))).toEqual({ url: activeUrl, commits: '0', announcement: '' });
  expect(requestsFor(requests, '/technology/')).toHaveLength(0);
});

test('a repeated pending destination remains eligible until its document commits', async ({ page }) => {
  await ready(page, '/');
  await instrumentDocument(page);
  let firstRequestStarted: (() => void) | undefined;
  let releaseFirstRequest: (() => void) | undefined;
  const started = new Promise<void>(resolveStarted => {
    firstRequestStarted = resolveStarted;
  });
  const release = new Promise<void>(resolveRelease => {
    releaseFirstRequest = resolveRelease;
  });
  let fetches = 0;
  await page.route('**/technology/', async route => {
    if (route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    fetches += 1;
    if (fetches !== 1) {
      await route.continue();
      return;
    }
    firstRequestStarted?.();
    await release;
    try {
      await route.continue();
    } catch {
      // Repeating the destination aborts the earlier transaction.
    }
  });

  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');
  await started;
  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');

  await expect(page).toHaveURL(/\/technology\/$/u);
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
  await expect(page.locator('main')).toBeFocused();
  releaseFirstRequest?.();
  await page.waitForTimeout(100);
  expect(fetches).toBe(2);
  await expect(page.locator('html')).toHaveAttribute('data-test-navigation-commits', '1');
});

test('slow A, fast B, then C leaves late A unable to mutate any committed route state', async ({ page }) => {
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
  await page.evaluate(() => document.querySelector<HTMLElement>('[data-primary-navigation] a[href="/about/"]')?.click());
  await expect(page).toHaveURL(/\/about\/$/u);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A programme for building');
  releaseTechnology?.();
  await page.waitForTimeout(100);

  expect(await page.evaluate(() => ({
    url: location.pathname,
    title: document.title,
    routeId: document.querySelector<HTMLElement>('main')?.dataset.pinegaRoute,
    heading: document.querySelector('h1')?.textContent?.trim(),
    canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    currentHref: document.querySelector<HTMLAnchorElement>('[data-primary-navigation] a[aria-current="page"]')?.getAttribute('href'),
    focusRoute: document.activeElement?.closest('main')?.getAttribute('data-pinega-route'),
    announcement: document.querySelector('[data-pinega-navigation-announcer]')?.textContent,
    commits: document.documentElement.dataset.testNavigationCommits,
  }))).toEqual({
    url: '/about/',
    title: 'About Pinega and Pinega Labs',
    routeId: 'about',
    heading: 'A programme for building defensible database technology.',
    canonical: 'https://pinega.example/about/',
    currentHref: '/about/',
    focusRoute: 'about',
    announcement: 'About Pinega and Pinega Labs',
    commits: '2',
  });
});

test('Back supersedes a pending push and late work cannot overwrite the traversed entry', async ({ page }) => {
  await ready(page, '/');
  await instrumentDocument(page);
  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');
  await expect(page).toHaveURL(/\/technology\/$/u);

  let releaseResearch: (() => void) | undefined;
  let researchStarted: (() => void) | undefined;
  const started = new Promise<void>(resolveStarted => {
    researchStarted = resolveStarted;
  });
  const release = new Promise<void>(resolveRelease => {
    releaseResearch = resolveRelease;
  });
  await page.route('**/research/', async route => {
    if (route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    researchStarted?.();
    await release;
    try {
      await route.continue();
    } catch {
      // Back is expected to abort the pending push fetch.
    }
  });

  await page.evaluate(() => document.querySelector<HTMLAnchorElement>('[data-primary-navigation] a[href="/research/"]')?.click());
  await started;
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/technology\/$/u);
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
  releaseResearch?.();
  await page.waitForTimeout(100);

  expect(await page.evaluate(() => ({
    path: location.pathname,
    routeId: document.querySelector<HTMLElement>('main')?.dataset.pinegaRoute,
    title: document.title,
    canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    currentHref: document.querySelector<HTMLAnchorElement>('[data-primary-navigation] a[aria-current="page"]')?.getAttribute('href'),
    announcement: document.querySelector('[data-pinega-navigation-announcer]')?.textContent,
    commits: document.documentElement.dataset.testNavigationCommits,
  }))).toEqual({
    path: '/technology/',
    routeId: 'technology',
    title: 'Technology — Pinega',
    canonical: 'https://pinega.example/technology/',
    currentHref: '/technology/',
    announcement: 'Technology — Pinega',
    commits: '1',
  });
});

test('new-route fragments scroll after commit while same-route fragments stay native', async ({ page }) => {
  await ready(page, '/');
  await instrumentDocument(page);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
  });
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));

  await activateCoordinatorLink(page, 'a[href="/technology/#optimisation"]');
  await expect(page).toHaveURL(/\/technology\/#optimisation$/u);
  await expect(page.locator('main')).toBeFocused();
  await expect.poll(() => page.evaluate(() => {
    const target = document.getElementById('optimisation');
    const header = document.querySelector('pinega-site-header');
    if (!target || !header) return false;
    const top = target.getBoundingClientRect().top;
    return scrollY > 0 && top >= header.getBoundingClientRect().bottom - 1 && top < innerHeight;
  })).toBe(true);
  expect(requestsFor(requests, '/technology/').map(request => request.resourceType())).toEqual(['fetch']);

  const requestCount = requests.length;
  await activateCoordinatorLink(page, 'a[href="#engine-architecture"]');
  await expect(page).toHaveURL(/\/technology\/#engine-architecture$/u);
  await expect.poll(() => page.evaluate(() => {
    const target = document.getElementById('engine-architecture');
    const header = document.querySelector('pinega-site-header');
    if (!target || !header) return false;
    const top = target.getBoundingClientRect().top;
    return top >= header.getBoundingClientRect().bottom - 1 && top < innerHeight;
  })).toBe(true);
  expect(requests).toHaveLength(requestCount);
  await expect(page.locator('html')).toHaveAttribute('data-test-navigation-commits', '1');
});

test('Back and Forward restore each entry scroll position after route content exists', async ({ page }) => {
  await ready(page, '/');
  await instrumentDocument(page);
  const homeScroll = await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    const target = Math.min(1200, Math.max(1, document.documentElement.scrollHeight - innerHeight));
    scrollTo(0, target);
    return scrollY;
  });
  expect(homeScroll).toBeGreaterThan(0);

  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');
  await expect(page).toHaveURL(/\/technology\/$/u);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
  const technologyScroll = await page.evaluate(() => {
    const target = Math.min(700, Math.max(1, document.documentElement.scrollHeight - innerHeight));
    scrollTo(0, target);
    return scrollY;
  });
  expect(technologyScroll).toBeGreaterThan(0);

  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/127\.0\.0\.1:4173\/$/u);
  await expect.poll(() => page.evaluate(expected => Math.abs(scrollY - expected), homeScroll)).toBeLessThan(8);

  await page.evaluate(() => history.forward());
  await expect(page).toHaveURL(/\/technology\/$/u);
  await expect.poll(() => page.evaluate(expected => Math.abs(scrollY - expected), technologyScroll)).toBeLessThan(8);
});

test('cross-locale navigation commits one truthful localized shell transaction', async ({ page }) => {
  await ready(page, '/docs/');
  const timeOrigin = await instrumentDocument(page);
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));
  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveClass(/pinega-dark/u);

  await activateCoordinatorLink(page, '[data-pinega-language-switcher] a[href="/ru/docs/"]');

  await expect(page).toHaveURL(/\/ru\/docs\/$/u);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('html')).toHaveAttribute('data-locale', 'ru');
  await expect(page.locator('html')).toHaveAttribute('data-webawesome-locale', 'ru');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await expect(page.locator('pinega-site-header')).toHaveAttribute('data-test-shell-identity', 'preserved');
  await expect(page.locator('[data-primary-navigation] a[href="/ru/docs/"]')).toHaveText('Документация');
  await expect(page.locator('[data-primary-navigation] a[href="/ru/docs/"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.pinega-skip-link')).toHaveText('Перейти к основному содержанию');
  await expect(page.locator('footer.pinega-site-footer')).toContainText('Исследования и инженерия систем баз данных');
  await expect(page.locator('[data-theme-toggle]')).toHaveText('Использовать светлую тему');
  await expect(page.locator('html')).toHaveClass(/pinega-dark/u);
  await expect(page.locator('main')).toBeFocused();
  await expect(page.locator('[data-pinega-navigation-announcer]')).toHaveText('Документация — Pinega');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://pinega.example/ru/docs/');
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', 'https://pinega.example/docs/');
  expect(await page.evaluate(() => ({
    timeOrigin: performance.timeOrigin,
    commits: document.documentElement.dataset.testNavigationCommits,
  }))).toEqual({ timeOrigin, commits: '1' });
  expect(requestsFor(requests, '/ru/docs/').map(request => request.resourceType())).toEqual(['fetch']);

  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveClass(/pinega-light/u);
  await expect(page.locator('[data-theme-toggle]')).toHaveText('Использовать тёмную тему');
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

    await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');

    await expect(page).toHaveURL(/\/technology\/$/u);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Research becomes technology');
    await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
    await expect(page.locator('pinega-site-header')).not.toHaveAttribute('data-test-shell-identity', 'preserved');
    expect(requestTypes).toEqual(['fetch', 'document']);
  });
}

test('a two-build deployment race hard-reloads once without a partial old-shell commit', async ({ page }) => {
  const requestTypes: string[] = [];
  const replacementBuild = `sha256-${'f'.repeat(64)}`;
  let injected = false;
  await page.route('**/technology/', async route => {
    const type = route.request().resourceType();
    requestTypes.push(type);
    if (type === 'fetch' && !injected) {
      injected = true;
      const response = await route.fetch();
      const body = (await response.text()).replace(
        /data-pinega-build="sha256-[a-f0-9]{64}"/u,
        `data-pinega-build="${replacementBuild}"`,
      );
      await route.fulfill({ response, body });
      return;
    }
    await route.continue();
  });
  await ready(page, '/');
  await instrumentDocument(page);
  await instrumentTransactionEvents(page);

  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');

  await expect(page).toHaveURL(/\/technology\/$/u);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await expect(page.locator('pinega-site-header')).not.toHaveAttribute('data-test-shell-identity', 'preserved');
  expect(requestTypes).toEqual(['fetch', 'document']);
  expect(await page.evaluate(storageKey => ({
    events: JSON.parse(sessionStorage.getItem(storageKey) ?? '[]'),
    fallbackGuard: sessionStorage.getItem('pinega-navigation-hard-fallback-v1'),
  }), transactionEventsKey)).toEqual({
    events: [{
      type: 'fallback',
      detail: { url: 'http://127.0.0.1:4173/technology/', reason: 'build-mismatch' },
    }],
    fallbackGuard: null,
  });
});

test('a failed locale chunk abandons the old module map and succeeds through one native reload', async ({ page }) => {
  const requestTypes: string[] = [];
  let failedLocaleChunk = 0;
  await page.route(/\/assets\/chunks\/ru-[^/?]+\.js(?:\?.*)?$/u, async route => {
    if (failedLocaleChunk === 0) {
      failedLocaleChunk += 1;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/ru/docs/') requestTypes.push(request.resourceType());
  });
  await ready(page, '/docs/');
  await instrumentDocument(page);
  await instrumentTransactionEvents(page);

  await activateCoordinatorLink(page, '[data-pinega-language-switcher] a[href="/ru/docs/"]');

  await expect(page).toHaveURL(/\/ru\/docs\/$/u);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('html')).toHaveAttribute('data-webawesome-locale', 'ru');
  await expect(page.locator('pinega-site-header')).not.toHaveAttribute('data-test-shell-identity', 'preserved');
  expect(failedLocaleChunk).toBe(1);
  expect(requestTypes).toEqual(['fetch', 'document']);
  expect(await page.evaluate(storageKey => ({
    events: JSON.parse(sessionStorage.getItem(storageKey) ?? '[]'),
    fallbackGuard: sessionStorage.getItem('pinega-navigation-hard-fallback-v1'),
  }), transactionEventsKey)).toEqual({
    events: [{
      type: 'fallback',
      detail: { url: 'http://127.0.0.1:4173/ru/docs/', reason: 'locale-runtime' },
    }],
    fallbackGuard: null,
  });
});

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
