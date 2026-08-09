import { expect, test, type Page, type Request } from '@playwright/test';
import { openReadyDocument } from './support/direct-document.js';

interface PrefetchMetrics {
  network: {
    allowed: boolean;
    reason: string;
    saveData: boolean | null;
    effectiveType: string | null;
  };
  scheduler: {
    active: number;
    queued: number;
    maxConcurrent: number;
    maxQueued: number;
  };
  intents: {
    outcomes: Record<string, number>;
  };
  prefetches: {
    started: number;
    completed: number;
    failed: number;
    aborted: number;
    hits: number;
    cacheHits: number;
    inFlightHits: number;
    retainedUnused: number;
    finalizedUnused: number;
    hitRate: number | null;
  };
  bytes: {
    source: {
      prefetched: number;
      useful: number;
      retainedUnused: number;
      finalizedUnused: number;
      wasted: number;
    };
    transfer: {
      prefetched: number;
      useful: number;
      retainedUnused: number;
      finalizedUnused: number;
      wasted: number;
    };
  };
}

interface CommitDetail {
  preparation: { source: 'cache' | 'in-flight' | 'network' };
  prefetch: { hit: boolean; source: 'cache' | 'in-flight' | null };
}

interface FeatureGraphManifest {
  features: Array<{ id: string; chunk: string }>;
}

async function ready(page: Page, route = '/'): Promise<void> {
  await openReadyDocument(page, route);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-prefetch', 'intent');
}

async function metrics(page: Page): Promise<PrefetchMetrics> {
  return page.evaluate(() => {
    const snapshot = window.__PINEGA_PREFETCH_METRICS__;
    if (!snapshot) throw new TypeError('Missing Pinega prefetch metrics.');
    return snapshot as PrefetchMetrics;
  });
}

async function waitForCompleted(page: Page, count: number): Promise<void> {
  await expect.poll(async () => (await metrics(page)).prefetches.completed).toBe(count);
  await expect.poll(async () => (await metrics(page)).scheduler.active).toBe(0);
}

async function captureCommits(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as Window & { __PINEGA_PREFETCH_TEST_COMMITS__?: unknown[] }).__PINEGA_PREFETCH_TEST_COMMITS__ = [];
    window.addEventListener('pinega:navigation-commit', event => {
      (window as Window & { __PINEGA_PREFETCH_TEST_COMMITS__?: unknown[] })
        .__PINEGA_PREFETCH_TEST_COMMITS__?.push((event as CustomEvent).detail);
    });
  });
}

async function lastCommit(page: Page): Promise<CommitDetail> {
  return page.evaluate(() => {
    const commits = (window as Window & { __PINEGA_PREFETCH_TEST_COMMITS__?: CommitDetail[] })
      .__PINEGA_PREFETCH_TEST_COMMITS__ ?? [];
    const commit = commits.at(-1);
    if (!commit) throw new TypeError('Missing prefetch navigation commit.');
    return commit;
  });
}

function routeRequests(requests: Request[], pathname: string): Request[] {
  return requests.filter(request => (
    request.resourceType() === 'fetch' && new URL(request.url()).pathname === pathname
  ));
}

async function dispatchPointer(
  page: Page,
  selector: string,
  type: 'pointerover' | 'pointerout' | 'pointerdown',
): Promise<void> {
  await page.locator(selector).dispatchEvent(type, {
    bubbles: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: type === 'pointerdown' ? 0 : -1,
    buttons: 0,
  });
}

async function dispatchFocusIntent(page: Page, selector: string): Promise<void> {
  await page.locator(selector).dispatchEvent('focusin', { bubbles: true });
}

test('hover requires dwell, then a completed route prefetch becomes a measured zero-fetch cache hit', async ({ page }) => {
  await ready(page);
  await captureCommits(page);
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));
  const selector = '[data-primary-navigation] a[href="/technology/"]';

  await dispatchPointer(page, selector, 'pointerover');
  await page.waitForTimeout(20);
  await dispatchPointer(page, selector, 'pointerout');
  await page.waitForTimeout(100);
  expect(routeRequests(requests, '/technology/')).toHaveLength(0);

  await dispatchPointer(page, selector, 'pointerover');
  await waitForCompleted(page, 1);
  expect(routeRequests(requests, '/technology/')).toHaveLength(1);
  expect((await metrics(page)).prefetches.retainedUnused).toBe(1);

  await page.locator(selector).evaluate((link: HTMLAnchorElement) => link.click());
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
  expect(routeRequests(requests, '/technology/')).toHaveLength(1);
  expect(await lastCommit(page)).toMatchObject({
    preparation: { source: 'cache' },
    prefetch: { hit: true, source: 'cache' },
  });
  const snapshot = await metrics(page);
  expect(snapshot.prefetches).toMatchObject({
    completed: 1,
    hits: 1,
    cacheHits: 1,
    inFlightHits: 0,
    retainedUnused: 0,
    hitRate: 1,
  });
  expect(snapshot.bytes.source.useful).toBeGreaterThan(0);
  expect(snapshot.bytes.source.wasted).toBe(0);
  expect(snapshot.bytes.transfer.wasted).toBe(0);
});

test('primary pointerdown publishes shared in-flight ownership before the click navigation', async ({ page }) => {
  let releaseRequest: (() => void) | undefined;
  let requestStarted: (() => void) | undefined;
  const started = new Promise<void>(resolve => { requestStarted = resolve; });
  const release = new Promise<void>(resolve => { releaseRequest = resolve; });
  let fetches = 0;
  await page.route('**/technology/', async route => {
    if (route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    fetches += 1;
    requestStarted?.();
    await release;
    await route.continue();
  });
  await ready(page);
  await captureCommits(page);
  const selector = '[data-primary-navigation] a[href="/technology/"]';

  await dispatchPointer(page, selector, 'pointerdown');
  await started;
  await page.locator(selector).evaluate((link: HTMLAnchorElement) => link.click());
  releaseRequest?.();

  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
  expect(fetches).toBe(1);
  expect(await lastCommit(page)).toMatchObject({
    preparation: { source: 'in-flight' },
    prefetch: { hit: true, source: 'in-flight' },
  });
  expect((await metrics(page)).prefetches).toMatchObject({
    completed: 1,
    hits: 1,
    cacheHits: 0,
    inFlightHits: 1,
  });
});

test('focus prefetch validates route HTML without executing its critical feature chunk', async ({ page }) => {
  const graphResponse = await page.request.get('/assets/feature-graph.json');
  const graph = await graphResponse.json() as FeatureGraphManifest;
  await graphResponse.dispose();
  const benchmarkChunk = graph.features.find(feature => feature.id === 'benchmark')?.chunk;
  expect(benchmarkChunk).toBeTruthy();
  await page.route('**/technology/', async route => {
    if (route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = (await response.text())
      .replace(
        'data-pinega-features="" data-pinega-critical-features=""',
        'data-pinega-features="benchmark" data-pinega-critical-features="benchmark"',
      )
      .replace('</main>', '<pinega-benchmark><p>Semantic fallback.</p></pinega-benchmark></main>');
    await route.fulfill({ response, body });
  });
  await ready(page);
  await captureCommits(page);
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));
  const selector = '[data-primary-navigation] a[href="/technology/"]';

  await dispatchFocusIntent(page, selector);
  await waitForCompleted(page, 1);
  expect(requests.filter(request => new URL(request.url()).pathname === benchmarkChunk)).toHaveLength(0);
  expect(await page.evaluate(() => customElements.get('pinega-benchmark') === undefined)).toBe(true);

  await page.locator(selector).evaluate((link: HTMLAnchorElement) => link.click());
  await expect(page.locator('pinega-benchmark')).toHaveAttribute('data-pinega-feature-state', 'ready');
  expect(requests.filter(request => new URL(request.url()).pathname === benchmarkChunk)).toHaveLength(1);
  expect(await lastCommit(page)).toMatchObject({
    preparation: { source: 'cache' },
    prefetch: { hit: true, source: 'cache' },
  });
});

test('scheduler enforces two live route transfers and a bounded queue across an intent burst', async ({ page }) => {
  const paths = new Set(['/technology/', '/research/', '/docs/', '/about/']);
  let releaseRequests: (() => void) | undefined;
  const release = new Promise<void>(resolve => { releaseRequests = resolve; });
  let active = 0;
  let maximumActive = 0;
  let fetches = 0;
  await page.route('**/*', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (route.request().resourceType() !== 'fetch' || !paths.has(pathname)) {
      await route.continue();
      return;
    }
    fetches += 1;
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await release;
    active -= 1;
    await route.continue();
  });
  await ready(page);

  for (const path of paths) {
    await dispatchFocusIntent(page, `[data-primary-navigation] a[href="${path}"]`);
  }
  await expect.poll(() => fetches).toBe(2);
  expect(await metrics(page)).toMatchObject({
    scheduler: { active: 2, queued: 2, maxConcurrent: 2, maxQueued: 8 },
    prefetches: { started: 2, completed: 0 },
  });

  releaseRequests?.();
  await waitForCompleted(page, 4);
  expect(fetches).toBe(4);
  expect(maximumActive).toBeLessThanOrEqual(2);
  expect((await metrics(page)).prefetches.retainedUnused).toBe(4);
});

test('save-data and 3g policy block transfer, then a 4g change re-enables intent prefetch', async ({ page }) => {
  await page.addInitScript(() => {
    const connection = Object.assign(new EventTarget(), {
      saveData: true,
      effectiveType: '4g',
    });
    Object.defineProperty(navigator, 'connection', { configurable: true, value: connection });
    (window as Window & { __PINEGA_TEST_CONNECTION__?: typeof connection }).__PINEGA_TEST_CONNECTION__ = connection;
  });
  await ready(page);
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));

  await dispatchFocusIntent(page, '[data-primary-navigation] a[href="/technology/"]');
  await page.waitForTimeout(100);
  expect(routeRequests(requests, '/technology/')).toHaveLength(0);
  expect(await metrics(page)).toMatchObject({
    network: { allowed: false, reason: 'save-data', saveData: true, effectiveType: '4g' },
  });

  await page.evaluate(() => {
    const connection = (window as Window & {
      __PINEGA_TEST_CONNECTION__?: EventTarget & { saveData: boolean; effectiveType: string };
    }).__PINEGA_TEST_CONNECTION__;
    if (!connection) throw new TypeError('Missing test connection.');
    connection.saveData = false;
    connection.effectiveType = '3g';
    connection.dispatchEvent(new Event('change'));
  });
  await dispatchFocusIntent(page, '[data-primary-navigation] a[href="/research/"]');
  await page.waitForTimeout(100);
  expect(routeRequests(requests, '/research/')).toHaveLength(0);
  expect(await metrics(page)).toMatchObject({
    network: { allowed: false, reason: 'slow-network', saveData: false, effectiveType: '3g' },
  });

  await page.evaluate(() => {
    const connection = (window as Window & {
      __PINEGA_TEST_CONNECTION__?: EventTarget & { saveData: boolean; effectiveType: string };
    }).__PINEGA_TEST_CONNECTION__;
    if (!connection) throw new TypeError('Missing test connection.');
    connection.effectiveType = '4g';
    connection.dispatchEvent(new Event('change'));
  });
  await dispatchFocusIntent(page, '[data-primary-navigation] a[href="/docs/"]');
  await waitForCompleted(page, 1);
  expect(routeRequests(requests, '/docs/')).toHaveLength(1);
  expect(await metrics(page)).toMatchObject({
    network: { allowed: true, reason: 'eligible', saveData: false, effectiveType: '4g' },
    intents: { outcomes: { 'skipped:save-data': 1, 'skipped:slow-network': 1, started: 1 } },
  });
});

test('a completed no-store prefetch is reported as wasted and cannot become a navigation hit', async ({ page }) => {
  let fetches = 0;
  await page.route('**/about/', async route => {
    if (route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    fetches += 1;
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'cache-control': 'private, no-store' },
    });
  });
  await ready(page);
  await captureCommits(page);
  const selector = '[data-primary-navigation] a[href="/about/"]';

  await dispatchFocusIntent(page, selector);
  await waitForCompleted(page, 1);
  const unused = await metrics(page);
  expect(unused.prefetches).toMatchObject({
    completed: 1,
    hits: 0,
    retainedUnused: 0,
    finalizedUnused: 1,
    hitRate: 0,
  });
  expect(unused.bytes.source.finalizedUnused).toBeGreaterThan(0);
  expect(unused.bytes.source.wasted).toBe(unused.bytes.source.prefetched);
  expect(unused.bytes.transfer.wasted).toBe(unused.bytes.transfer.prefetched);

  await page.locator(selector).evaluate((link: HTMLAnchorElement) => link.click());
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'about');
  expect(fetches).toBe(2);
  expect(await lastCommit(page)).toMatchObject({
    preparation: { source: 'network' },
    prefetch: { hit: false, source: null },
  });
  expect((await metrics(page)).prefetches.hitRate).toBe(0);
});
