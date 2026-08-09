import { expect, test, type Page, type Request } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openReadyDocument } from './support/direct-document.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const malformedFixture = await readFile(resolve(root, 'fixtures/navigation/malformed.html'), 'utf8');
const transactionEventsKey = 'pinega-test-navigation-transaction-events';

interface NavigationCommitRecord {
  type: 'commit';
  detail: {
    preparation: {
      source: 'cache' | 'in-flight' | 'network';
      networkRequests: number;
      parseCalls: number;
      materializeCalls: number;
    };
    cache: {
      stored: boolean;
      entries: number;
      weightBytes: number;
      maxEntries: number;
      maxWeightBytes: number;
      evictedEntries: number;
    };
  };
}

async function ready(page: Page, route: string): Promise<void> {
  await openReadyDocument(page, route);
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

async function navigationCommits(page: Page): Promise<NavigationCommitRecord[]> {
  return page.evaluate(storageKey => (
    (JSON.parse(sessionStorage.getItem(storageKey) ?? '[]') as NavigationCommitRecord[])
      .filter(event => event.type === 'commit')
  ), transactionEventsKey);
}

async function countDomParserCalls(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.dataset.testDomParserCalls = '0';
    const original = DOMParser.prototype.parseFromString;
    DOMParser.prototype.parseFromString = function parseFromString(
      input: string,
      format: DOMParserSupportedType,
    ): Document {
      const root = document.documentElement;
      root.dataset.testDomParserCalls = String(Number(root.dataset.testDomParserCalls ?? 0) + 1);
      return original.call(this, input, format);
    };
  });
}

test('eligible navigation commits validated route state without replacing the Document or shell', async ({ page }) => {
  await ready(page, '/');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-navigation', 'enhanced');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-route-cache', 'native-lru');
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
  await expect(page.locator('[data-pinega-navigation-announcer]')).toMatchAriaSnapshot('- status: Technology — Pinega');

  const runtime = await page.evaluate(() => ({
    timeOrigin: performance.timeOrigin,
    navigationEntries: performance.getEntries().filter(entry => String(entry.entryType) === 'navigation').length,
    commits: document.documentElement.dataset.testNavigationCommits,
  }));
  expect(runtime).toEqual({ timeOrigin, navigationEntries: 1, commits: '1' });
  expect(requestsFor(requests, '/technology/').map(request => request.resourceType())).toEqual(['fetch']);
});

test('direct and enhanced delivery expose the same route accessibility tree', async ({ page }) => {
  await ready(page, '/technology/');
  const direct = await page.locator('main').ariaSnapshot();

  await ready(page, '/');
  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');

  expect(await page.locator('main').ariaSnapshot()).toBe(direct);
  await expect(page.locator('main')).toBeFocused();
  await expect(page.locator('[data-pinega-navigation-announcer]')).toMatchAriaSnapshot('- status: Technology — Pinega');
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

test('boot and fetched routes become warm native-template hits with zero network and zero parsing', async ({ page }) => {
  await ready(page, '/');
  await instrumentDocument(page);
  await instrumentTransactionEvents(page);
  await countDomParserCalls(page);
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));

  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/research/"]');
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'research');
  expect(await page.locator('html').getAttribute('data-test-dom-parser-calls')).toBe('2');

  const requestBoundary = requests.length;
  await page.evaluate(() => history.back());
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
  await page.evaluate(() => history.back());
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'home');
  await page.evaluate(() => history.forward());
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');

  const warmRequests = requests.slice(requestBoundary).filter(request => (
    ['/', '/technology/'].includes(new URL(request.url()).pathname)
  ));
  expect(warmRequests).toHaveLength(0);
  expect(await page.locator('html').getAttribute('data-test-dom-parser-calls')).toBe('2');
  const commits = await navigationCommits(page);
  expect(commits.map(event => event.detail.preparation.source)).toEqual([
    'network',
    'network',
    'cache',
    'cache',
    'cache',
  ]);
  for (const event of commits.slice(2)) {
    expect(event.detail.preparation).toMatchObject({
      source: 'cache',
      networkRequests: 0,
      parseCalls: 0,
      materializeCalls: 1,
    });
  }
});

test('Back and Forward remain transactional after more than ten routes without adding entries', async ({ page }) => {
  const routes = [
    '/technology/',
    '/research/',
    '/docs/',
    '/docs/getting-started/',
    '/docs/start/project-overview/',
    '/docs/start/research-workspace/',
    '/docs/how-to/build-the-site/',
    '/docs/how-to/run-validation/',
    '/docs/concepts/pinega-programme/',
    '/docs/concepts/pinega-engine-architecture/',
    '/about/',
  ];
  const entries = ['/', ...routes];
  await ready(page, '/');
  const timeOrigin = await instrumentDocument(page);
  await instrumentTransactionEvents(page);
  const initialHistoryLength = await page.evaluate(() => history.length);
  let commits = 0;

  for (const route of routes) {
    commits += 1;
    await page.evaluate(target => {
      const link = document.createElement('a');
      link.href = target;
      link.textContent = target;
      document.body.append(link);
      link.click();
    }, route);
    await expect(page.locator('html')).toHaveAttribute('data-test-navigation-commits', String(commits));
    expect(new URL(page.url()).pathname).toBe(route);
  }
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength + routes.length);

  for (let index = entries.length - 2; index >= 0; index -= 1) {
    commits += 1;
    await page.evaluate(() => history.back());
    await expect(page.locator('html')).toHaveAttribute('data-test-navigation-commits', String(commits));
    expect(new URL(page.url()).pathname).toBe(entries[index]);
  }
  for (let index = 1; index < entries.length; index += 1) {
    commits += 1;
    await page.evaluate(() => history.forward());
    await expect(page.locator('html')).toHaveAttribute('data-test-navigation-commits', String(commits));
    expect(new URL(page.url()).pathname).toBe(entries[index]);
  }

  expect(await page.evaluate(() => ({
    historyLength: history.length,
    timeOrigin: performance.timeOrigin,
    route: document.querySelector<HTMLElement>('main')?.dataset.pinegaRoute,
  }))).toEqual({ historyLength: initialHistoryLength + routes.length, timeOrigin, route: 'about' });
  await expect(page.locator('pinega-site-header')).toHaveAttribute('data-test-shell-identity', 'preserved');
  const commitRecords = await navigationCommits(page);
  expect(commitRecords.some(event => event.detail.cache.evictedEntries > 0)).toBe(true);
  expect(commitRecords.some(event => event.detail.preparation.source === 'cache')).toBe(true);
  for (const event of commitRecords) {
    expect(event.detail.cache.entries).toBeLessThanOrEqual(event.detail.cache.maxEntries);
    expect(event.detail.cache.entries).toBeLessThanOrEqual(10);
    expect(event.detail.cache.weightBytes).toBeLessThanOrEqual(event.detail.cache.maxWeightBytes);
    expect(event.detail.cache.maxWeightBytes).toBe(2 * 1024 * 1024);
  }
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
  await instrumentTransactionEvents(page);
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
  await page.waitForTimeout(0);
  releaseFirstRequest?.();

  await expect(page).toHaveURL(/\/technology\/$/u);
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
  await expect(page.locator('main')).toBeFocused();
  await page.waitForTimeout(100);
  expect(fetches).toBe(1);
  await expect(page.locator('html')).toHaveAttribute('data-test-navigation-commits', '1');
  const commits = await navigationCommits(page);
  expect(commits).toHaveLength(1);
  expect(commits[0]?.detail.preparation).toMatchObject({
    source: 'in-flight',
    networkRequests: 1,
    parseCalls: 1,
    materializeCalls: 1,
  });
});

test('Cache-Control no-store routes stay cold while cacheable boot routes remain warm', async ({ page }) => {
  let technologyFetches = 0;
  await page.route('**/technology/', async route => {
    if (route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    technologyFetches += 1;
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'cache-control': 'private, no-store' },
    });
  });
  await ready(page, '/');
  await instrumentDocument(page);
  await instrumentTransactionEvents(page);
  await countDomParserCalls(page);

  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
  await page.evaluate(() => history.back());
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'home');
  await page.evaluate(() => history.forward());
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');

  expect(technologyFetches).toBe(2);
  expect(await page.locator('html').getAttribute('data-test-dom-parser-calls')).toBe('2');
  const commits = await navigationCommits(page);
  expect(commits.map(event => event.detail.preparation.source)).toEqual(['network', 'cache', 'network']);
  expect(commits[0]?.detail.cache.stored).toBe(false);
  expect(commits[2]?.detail.cache.stored).toBe(false);
});

test('template activations create fresh form, details, selection, and Custom Element lifecycle state', async ({ page }) => {
  let docsFetches = 0;
  await page.route('**/docs/', async route => {
    if (route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    docsFetches += 1;
    const response = await route.fetch();
    const html = await response.text();
    const stateFixture = [
      '<form data-cache-state-form>',
      '<label>Cache state <input data-cache-state-input value="initial"></label>',
      '<details data-cache-state-details><summary>Transient details</summary><p data-cache-selection>mutable selection</p></details>',
      '<x-cache-lifecycle></x-cache-lifecycle>',
      '</form>',
    ].join('');
    await route.fulfill({ response, body: html.replace('</main>', `${stateFixture}</main>`) });
  });
  await ready(page, '/');
  await instrumentDocument(page);
  await instrumentTransactionEvents(page);
  await page.evaluate(() => {
    const state = { connected: 0, disconnected: 0, externalEvents: 0, observerRecords: 0 };
    const controllers = new WeakMap<HTMLElement, AbortController>();
    const observers = new WeakMap<HTMLElement, MutationObserver>();
    (window as unknown as { __PINEGA_CACHE_LIFECYCLE__?: typeof state }).__PINEGA_CACHE_LIFECYCLE__ = state;
    customElements.define('x-cache-lifecycle', class extends HTMLElement {
      connectedCallback(): void {
        state.connected += 1;
        const controller = new AbortController();
        const observer = new MutationObserver(records => { state.observerRecords += records.length; });
        controllers.set(this, controller);
        observers.set(this, observer);
        observer.observe(this, { attributes: true });
        window.addEventListener('pinega-test-cache-external', () => { state.externalEvents += 1; }, {
          signal: controller.signal,
        });
      }

      disconnectedCallback(): void {
        state.disconnected += 1;
        (window as unknown as { __PINEGA_REMOVED_CACHE_PROBE__?: HTMLElement }).__PINEGA_REMOVED_CACHE_PROBE__ = this;
        controllers.get(this)?.abort();
        controllers.delete(this);
        observers.get(this)?.disconnect();
        observers.delete(this);
      }
    });
  });

  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/docs/"]');
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'documentation');
  await page.locator('[data-cache-state-input]').evaluate((input: HTMLInputElement) => { input.value = 'mutated'; });
  await page.locator('[data-cache-state-details]').evaluate((details: HTMLDetailsElement) => { details.open = true; });
  await page.locator('[data-cache-selection]').evaluate(element => {
    const selection = getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.evaluate(() => window.dispatchEvent(new Event('pinega-test-cache-external')));

  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/research/"]');
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'research');
  expect(await page.evaluate(async () => {
    const state = window as unknown as {
      __PINEGA_CACHE_LIFECYCLE__?: { observerRecords: number };
      __PINEGA_REMOVED_CACHE_PROBE__?: HTMLElement;
    };
    state.__PINEGA_REMOVED_CACHE_PROBE__?.setAttribute('data-after-disconnect', 'true');
    await new Promise(resolve => setTimeout(resolve, 0));
    return state.__PINEGA_CACHE_LIFECYCLE__?.observerRecords;
  })).toBe(0);
  await page.evaluate(() => history.back());
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'documentation');

  await expect(page.locator('[data-cache-state-input]')).toHaveValue('initial');
  await expect(page.locator('[data-cache-state-details]')).not.toHaveAttribute('open', '');
  expect(await page.evaluate(() => getSelection()?.toString())).not.toBe('mutable selection');
  await page.evaluate(() => window.dispatchEvent(new Event('pinega-test-cache-external')));
  await page.locator('x-cache-lifecycle').evaluate(async element => {
    element.setAttribute('data-live-mutation', 'true');
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  expect(await page.evaluate(() => (
    (window as unknown as {
      __PINEGA_CACHE_LIFECYCLE__?: {
        connected: number;
        disconnected: number;
        externalEvents: number;
        observerRecords: number;
      };
    }).__PINEGA_CACHE_LIFECYCLE__
  ))).toEqual({ connected: 2, disconnected: 1, externalEvents: 2, observerRecords: 1 });
  expect(docsFetches).toBe(1);
  expect((await navigationCommits(page)).at(-1)?.detail.preparation.source).toBe('cache');
});

test('pending state is transaction-owned, accessible, and overlays the header without layout shift', async ({ page }) => {
  await ready(page, '/');
  await instrumentDocument(page);
  const geometry = await page.evaluate(() => {
    const header = document.querySelector('pinega-site-header');
    const main = document.querySelector('main');
    if (!header || !main) throw new Error('Missing navigation geometry');
    return { headerBottom: header.getBoundingClientRect().bottom, mainTop: main.getBoundingClientRect().top };
  });
  let requestStarted: (() => void) | undefined;
  let releaseRequest: (() => void) | undefined;
  const started = new Promise<void>(resolveStarted => { requestStarted = resolveStarted; });
  const release = new Promise<void>(resolveRelease => { releaseRequest = resolveRelease; });
  await page.route('**/technology/', async route => {
    if (route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    requestStarted?.();
    await release;
    await route.continue();
  });

  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');
  await started;
  await expect(page.locator('html')).toHaveAttribute('data-pinega-navigation-pending', 'true');
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true');
  const pending = await page.evaluate(() => {
    const header = document.querySelector('pinega-site-header');
    const main = document.querySelector('main');
    if (!header || !main) throw new Error('Missing pending navigation geometry');
    return {
      headerBottom: header.getBoundingClientRect().bottom,
      mainTop: main.getBoundingClientRect().top,
      indicatorOpacity: getComputedStyle(header, '::after').opacity,
    };
  });
  expect(Math.abs(pending.headerBottom - geometry.headerBottom)).toBeLessThan(0.5);
  expect(Math.abs(pending.mainTop - geometry.mainTop)).toBeLessThan(0.5);
  expect(pending.indicatorOpacity).toBe('1');

  releaseRequest?.();
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
  await expect(page.locator('html')).not.toHaveAttribute('data-pinega-navigation-pending', 'true');
  await expect(page.locator('main')).not.toHaveAttribute('aria-busy', 'true');
});

test('supersession while reading a response body cannot commit the late route', async ({ page }) => {
  await ready(page, '/');
  await instrumentDocument(page);
  await page.evaluate(async () => {
    const capturedTechnologyBody = await fetch('/technology/').then(response => response.text());
    const originalFetch = window.fetch.bind(window);
    let releaseBody: (() => void) | undefined;
    const bodyGate = new Promise<void>(resolveGate => { releaseBody = resolveGate; });
    const state = window as unknown as Window & { __PINEGA_RELEASE_TEST_BODY__?: () => void };
    state.__PINEGA_RELEASE_TEST_BODY__ = () => releaseBody?.();
    window.fetch = async (...args): Promise<Response> => {
      const response = await originalFetch(...args);
      if (new URL(response.url).pathname !== '/technology/') return response;
      const read = response.text.bind(response);
      Object.defineProperty(response, 'text', {
        configurable: true,
        value: async (): Promise<string> => {
          document.documentElement.dataset.testBodyRead = 'pending';
          await bodyGate;
          void read().catch(() => undefined);
          return capturedTechnologyBody;
        },
      });
      return response;
    };
  });

  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');
  await expect(page.locator('html')).toHaveAttribute('data-test-body-read', 'pending');
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true');
  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/research/"]');
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'research');
  await expect(page.locator('main')).not.toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => {
    (window as unknown as Window & { __PINEGA_RELEASE_TEST_BODY__?: () => void }).__PINEGA_RELEASE_TEST_BODY__?.();
  });
  await page.waitForTimeout(100);

  expect(await page.evaluate(() => ({
    path: location.pathname,
    route: document.querySelector<HTMLElement>('main')?.dataset.pinegaRoute,
    title: document.title,
    commits: document.documentElement.dataset.testNavigationCommits,
  }))).toEqual({ path: '/research/', route: 'research', title: 'Research — Pinega', commits: '1' });
});

test('supersession while loading a locale module preserves the newer route and pending owner', async ({ page }) => {
  let localeChunkStarted: (() => void) | undefined;
  let releaseLocaleChunk: (() => void) | undefined;
  const started = new Promise<void>(resolveStarted => { localeChunkStarted = resolveStarted; });
  const release = new Promise<void>(resolveRelease => { releaseLocaleChunk = resolveRelease; });
  await page.route(/\/assets\/chunks\/ru-[^/?]+\.js(?:\?.*)?$/u, async route => {
    localeChunkStarted?.();
    await release;
    await route.continue();
  });
  await ready(page, '/docs/');
  await instrumentDocument(page);

  await activateCoordinatorLink(page, '[data-pinega-language-switcher] a[href="/ru/docs/"]');
  await started;
  await expect(page.locator('html')).toHaveAttribute('data-pinega-navigation-pending', 'true');
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true');
  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
  await expect(page.locator('html')).not.toHaveAttribute('data-pinega-navigation-pending', 'true');
  releaseLocaleChunk?.();
  await page.waitForTimeout(100);

  expect(await page.evaluate(() => ({
    path: location.pathname,
    locale: document.documentElement.dataset.locale,
    route: document.querySelector<HTMLElement>('main')?.dataset.pinegaRoute,
    commits: document.documentElement.dataset.testNavigationCommits,
  }))).toEqual({ path: '/technology/', locale: 'en', route: 'technology', commits: '1' });
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

test('a missing new-route fragment commits the route and applies the normalized top fallback', async ({ page }) => {
  await ready(page, '/');
  await instrumentDocument(page);
  const initialScroll = await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    scrollTo(0, Math.max(1, document.documentElement.scrollHeight - innerHeight));
    return scrollY;
  });
  expect(initialScroll).toBeGreaterThan(0);

  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = '/technology/#missing-gate-4-2-fragment';
    link.textContent = 'Missing fragment';
    document.body.append(link);
    link.click();
  });

  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
  await expect(page).toHaveURL(/\/technology\/#missing-gate-4-2-fragment$/u);
  await expect(page.locator('main')).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
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
  await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('aria-label', 'Использовать светлую тему');
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
  await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('aria-label', 'Использовать тёмную тему');
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

for (const fault of [
  {
    id: 'language switcher target that disagrees with hreflang',
    mutate: (body: string) => body.replace(
      'data-pinega-locale="ru" href="/ru/technology/" hreflang="ru"',
      'data-pinega-locale="ru" href="/ru/research/" hreflang="ru"',
    ),
  },
  {
    id: 'unknown route feature ID',
    mutate: (body: string) => body.replace('data-pinega-features=""', 'data-pinega-features="unknown-feature"'),
  },
]) {
  test(`${fault.id} fails closed through one native fallback`, async ({ page }) => {
    const requestTypes: string[] = [];
    let injected = false;
    await page.route('**/technology/', async route => {
      const type = route.request().resourceType();
      requestTypes.push(type);
      if (type === 'fetch' && !injected) {
        injected = true;
        const response = await route.fetch();
        const original = await response.text();
        const body = fault.mutate(original);
        expect(body, `${fault.id}: mutation must change the response`).not.toBe(original);
        await route.fulfill({ response, body });
        return;
      }
      await route.continue();
    });
    await ready(page, '/');
    await instrumentDocument(page);

    await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');

    await expect(page).toHaveURL(/\/technology\/$/u);
    await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
    await expect(page.locator('pinega-site-header')).not.toHaveAttribute('data-test-shell-identity', 'preserved');
    await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
    expect(requestTypes).toEqual(['fetch', 'document']);
  });
}

test('a persistently malformed destination stops after one fallback through the session loop guard', async ({ page }) => {
  const requestTypes: string[] = [];
  await page.route('**/technology/', async route => {
    const type = route.request().resourceType();
    requestTypes.push(type);
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace('data-pinega-shell="4.0"', 'data-pinega-shell="malformed"');
    expect(body).not.toBe(original);
    await route.fulfill({ response, body });
  });
  await ready(page, '/');
  await instrumentDocument(page);

  await activateCoordinatorLink(page, '[data-primary-navigation] a[href="/technology/"]');

  await expect(page).toHaveURL(/\/technology\/$/u);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-navigation', 'error');
  await page.waitForTimeout(200);
  expect(requestTypes).toEqual(['fetch', 'document']);
  expect(await page.evaluate(() => sessionStorage.getItem('pinega-navigation-hard-fallback-v1')))
    .toBe('http://127.0.0.1:4173/technology/');
});

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
