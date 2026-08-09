import { expect, test, type Page, type Request } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance as nodePerformance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

interface TransitionResult {
  id: string;
  actionDurationMs: number;
  finalUrl: string;
  routeId: string;
  locale: string;
  requestTypes: string[];
  documentRequests: number;
  htmlFetchRequests: number;
  commitCount: number;
  timeOriginBefore: number;
  timeOriginAfter: number;
  navigationEntries: number;
  shellPreserved: boolean;
  mainFocused: boolean;
  announcement: string;
  preparationSource: 'cache' | 'in-flight' | 'network';
  parseCalls: number;
  materializeCalls: number;
  cacheEntries: number;
  cacheWeightBytes: number;
}

interface CommitDetail {
  preparation: {
    source: 'cache' | 'in-flight' | 'network';
    parseCalls: number;
    materializeCalls: number;
  };
  cache: {
    entries: number;
    weightBytes: number;
    maxEntries: number;
    maxWeightBytes: number;
  };
}

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const artifactPath = resolve(webRoot, 'artifacts/baseline/gate-4.3-route-cache-baseline.json');
const stressArtifactPath = resolve(webRoot, 'artifacts/baseline/gate-4.3-route-cache-stress.json');
const commitStorageKey = 'pinega-baseline-navigation-commits';

test('records the Gate 4.3 cold and warm route-cache structural baseline', async ({ page, browserName }) => {
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-navigation', 'enhanced');
  await page.locator('pinega-site-header').evaluate((header: HTMLElement) => {
    header.dataset.baselineShell = 'persistent';
  });
  await page.evaluate(() => {
    document.documentElement.dataset.baselineCommits = '0';
    window.addEventListener('pinega:navigation-commit', () => {
      const root = document.documentElement;
      root.dataset.baselineCommits = String(Number(root.dataset.baselineCommits ?? 0) + 1);
    });
  });
  await page.evaluate(storageKey => {
    sessionStorage.setItem(storageKey, '[]');
    window.addEventListener('pinega:navigation-commit', event => {
      const commits = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]') as unknown[];
      commits.push((event as CustomEvent).detail);
      sessionStorage.setItem(storageKey, JSON.stringify(commits));
    });
  }, commitStorageKey);

  const buildId = await page.locator('html').getAttribute('data-pinega-build');
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));
  const transitions: TransitionResult[] = [];

  transitions.push(await measureTransition(page, requests, {
    id: 'home-to-technology',
    pathname: '/technology/',
    run: async () => {
      await page.locator('[data-primary-navigation] a[href="/technology/"]').click();
      await expect(page).toHaveURL(/\/technology\/$/u);
      await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
    },
  }));
  transitions.push(await measureTransition(page, requests, {
    id: 'back-to-home',
    pathname: '/',
    run: async () => {
      await page.evaluate(() => history.back());
      await expect(page).toHaveURL(/127\.0\.0\.1:4173\/$/u);
      await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'home');
    },
  }));
  transitions.push(await measureTransition(page, requests, {
    id: 'english-to-russian-home',
    pathname: '/ru/',
    run: async () => {
      await page.locator('[data-pinega-language-switcher] a[href="/ru/"]').click();
      await expect(page).toHaveURL(/\/ru\/$/u);
      await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'home');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    },
  }));
  transitions.push(await measureTransition(page, requests, {
    id: 'back-to-english-home',
    pathname: '/',
    run: async () => {
      await page.evaluate(() => history.back());
      await expect(page).toHaveURL(/127\.0\.0\.1:4173\/$/u);
      await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'home');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    },
  }));

  for (const transition of transitions) {
    expect(transition.documentRequests, transition.id).toBe(0);
    expect(transition.timeOriginAfter, transition.id).toBe(transition.timeOriginBefore);
    expect(transition.navigationEntries, transition.id).toBe(1);
    expect(transition.shellPreserved, transition.id).toBe(true);
  }
  expect(transitions.map(transition => transition.htmlFetchRequests)).toEqual([1, 0, 1, 0]);
  expect(transitions.map(transition => transition.preparationSource)).toEqual(['network', 'cache', 'network', 'cache']);
  expect(transitions.map(transition => transition.parseCalls)).toEqual([1, 0, 1, 0]);
  expect(transitions.every(transition => transition.materializeCalls === 1)).toBe(true);
  expect(transitions.every(transition => transition.cacheEntries <= 10)).toBe(true);
  expect(transitions.every(transition => transition.cacheWeightBytes <= 2 * 1024 * 1024)).toBe(true);
  expect(transitions.map(transition => transition.commitCount)).toEqual([1, 2, 3, 4]);
  expect(transitions.map(transition => transition.locale)).toEqual(['en', 'en', 'ru', 'en']);
  expect(transitions.filter(transition => ['home-to-technology', 'english-to-russian-home'].includes(transition.id)).every(transition => transition.mainFocused)).toBe(true);
  expect(buildId).toMatch(/^sha256-[a-f0-9]{64}$/u);

  const payload = {
    schemaVersion: 1,
    kind: 'pinega-gate-4.3-route-cache-baseline',
    generatedAt: new Date().toISOString(),
    source: {
      repository: process.env.GITHUB_REPOSITORY ?? 'local-checkout',
      sourceSha: process.env.PINEGA_DEPLOYMENT_SOURCE_SHA || process.env.GITHUB_SHA || null,
      testedSha: process.env.PINEGA_DEPLOYMENT_TESTED_SHA || process.env.GITHUB_SHA || null,
    },
    profile: {
      name: process.env.PINEGA_BASELINE_PROFILE ?? 'local-uncontrolled',
      browserName,
      browserVersion: await page.context().browser()?.version(),
      viewport: page.viewportSize(),
    },
    policy: {
      numericBudgetsEnforced: false,
      cache: 'native template LRU; 10 entries and 2 MiB estimated weight; boot route cached from the parsed document',
      focus: 'push/replace focuses main; traversal leaves focus restoration to the history policy',
      scroll: 'Navigation API event.scroll() after commit: push/replace top or fragment, traversal entry restoration',
      note: 'Structural gate: cold routes issue one HTML fetch and parse; warm routes issue neither while preserving one materialization and one visible route/locale commit.',
    },
    buildId,
    transitions,
  };
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
});

test('records a forced-GC 100-route bounded-cache stress study', async ({ page, browserName }) => {
  test.setTimeout(120_000);
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-route-cache', 'native-lru');
  await page.evaluate(storageKey => {
    sessionStorage.setItem(storageKey, '[]');
    document.documentElement.dataset.baselineStressCommits = '0';
    window.addEventListener('pinega:navigation-commit', event => {
      const root = document.documentElement;
      root.dataset.baselineStressCommits = String(Number(root.dataset.baselineStressCommits ?? 0) + 1);
      const commits = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]') as unknown[];
      commits.push((event as CustomEvent).detail);
      sessionStorage.setItem(storageKey, JSON.stringify(commits));
    });
  }, commitStorageKey);

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
    '/docs/concepts/research-to-product-workflow/',
    '/docs/concepts/maturity-and-evidence-labels/',
    '/docs/reference/content-metadata-schema/',
    '/docs/reference/repository-layout/',
    '/docs/reference/web-build-and-environment/',
    '/docs/contributing/review-and-release-gates/',
    '/about/',
  ];
  let commits = 0;
  for (const route of routes) {
    commits += 1;
    await navigateForStress(page, route, commits);
  }
  await page.evaluate(storageKey => sessionStorage.setItem(storageKey, '[]'), commitStorageKey);
  await settleAndCollect(page);
  const heapBefore = await usedHeap(page);

  const started = nodePerformance.now();
  for (let index = 0; index < 100; index += 1) {
    commits += 1;
    await navigateForStress(page, routes[index % routes.length] as string, commits);
  }
  const actionDurationMs = nodePerformance.now() - started;
  await settleAndCollect(page);
  const heapAfter = await usedHeap(page);
  const details = await page.evaluate(storageKey => (
    JSON.parse(sessionStorage.getItem(storageKey) ?? '[]') as CommitDetail[]
  ), commitStorageKey);
  const maxEntries = Math.max(...details.map(detail => detail.cache.entries));
  const maxWeightBytes = Math.max(...details.map(detail => detail.cache.weightBytes));
  const configuredEntryLimit = details.at(-1)?.cache.maxEntries ?? 0;
  const configuredWeightLimit = details.at(-1)?.cache.maxWeightBytes ?? 0;
  const heapGrowthBytes = heapAfter - heapBefore;

  expect(maxEntries).toBeLessThanOrEqual(configuredEntryLimit);
  expect(configuredEntryLimit).toBe(10);
  expect(maxWeightBytes).toBeLessThanOrEqual(configuredWeightLimit);
  expect(configuredWeightLimit).toBe(2 * 1024 * 1024);
  expect(heapGrowthBytes).toBeLessThanOrEqual(12 * 1024 * 1024);

  const payload = {
    schemaVersion: 1,
    kind: 'pinega-gate-4.3-route-cache-stress',
    generatedAt: new Date().toISOString(),
    source: {
      repository: process.env.GITHUB_REPOSITORY ?? 'local-checkout',
      sourceSha: process.env.PINEGA_DEPLOYMENT_SOURCE_SHA || process.env.GITHUB_SHA || null,
      testedSha: process.env.PINEGA_DEPLOYMENT_TESTED_SHA || process.env.GITHUB_SHA || null,
    },
    profile: {
      name: process.env.PINEGA_BASELINE_PROFILE ?? 'local-uncontrolled',
      browserName,
      browserVersion: await page.context().browser()?.version(),
      viewport: page.viewportSize(),
    },
    policy: {
      routeOperations: 100,
      uniqueRoutes: routes.length,
      forcedGarbageCollection: true,
      heapGrowthEnvelopeBytes: 12 * 1024 * 1024,
      cacheEntryLimit: configuredEntryLimit,
      cacheWeightLimitBytes: configuredWeightLimit,
    },
    result: {
      actionDurationMs,
      heapBefore,
      heapAfter,
      heapGrowthBytes,
      maxEntries,
      maxWeightBytes,
      commits: details.length,
    },
  };
  await mkdir(dirname(stressArtifactPath), { recursive: true });
  await writeFile(stressArtifactPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
});

async function measureTransition(
  page: Page,
  requests: Request[],
  scenario: { id: string; pathname: string; run: () => Promise<void> },
): Promise<TransitionResult> {
  const requestStart = requests.length;
  const timeOriginBefore = await page.evaluate(() => performance.timeOrigin);
  const started = nodePerformance.now();
  await scenario.run();
  const actionDurationMs = nodePerformance.now() - started;
  const transitionRequests = requests.slice(requestStart).filter(request => new URL(request.url()).pathname === scenario.pathname);
  const state = await page.evaluate(() => ({
    routeId: document.querySelector<HTMLElement>('main')?.dataset.pinegaRoute ?? '',
    locale: document.documentElement.dataset.locale ?? '',
    commitCount: Number(document.documentElement.dataset.baselineCommits ?? 0),
    timeOriginAfter: performance.timeOrigin,
    navigationEntries: performance.getEntries().filter(entry => String(entry.entryType) === 'navigation').length,
    shellPreserved: document.querySelector<HTMLElement>('pinega-site-header')?.dataset.baselineShell === 'persistent',
    mainFocused: document.activeElement === document.querySelector('main'),
    announcement: document.querySelector('[data-pinega-navigation-announcer]')?.textContent ?? '',
  }));
  const detail = await page.evaluate(storageKey => {
    const commits = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]') as CommitDetail[];
    return commits.at(-1);
  }, commitStorageKey);
  if (!detail) throw new Error(`Missing navigation commit instrumentation for ${scenario.id}`);
  return {
    id: scenario.id,
    actionDurationMs,
    finalUrl: page.url(),
    routeId: state.routeId,
    locale: state.locale,
    requestTypes: transitionRequests.map(request => request.resourceType()),
    documentRequests: transitionRequests.filter(request => request.resourceType() === 'document').length,
    htmlFetchRequests: transitionRequests.filter(request => request.resourceType() === 'fetch').length,
    commitCount: state.commitCount,
    timeOriginBefore,
    timeOriginAfter: state.timeOriginAfter,
    navigationEntries: state.navigationEntries,
    shellPreserved: state.shellPreserved,
    mainFocused: state.mainFocused,
    announcement: state.announcement,
    preparationSource: detail.preparation.source,
    parseCalls: detail.preparation.parseCalls,
    materializeCalls: detail.preparation.materializeCalls,
    cacheEntries: detail.cache.entries,
    cacheWeightBytes: detail.cache.weightBytes,
  };
}

async function navigateForStress(page: Page, route: string, expectedCommits: number): Promise<void> {
  await page.evaluate(target => {
    const link = document.createElement('a');
    link.href = target;
    link.textContent = target;
    document.body.append(link);
    link.click();
    link.remove();
  }, route);
  await expect(page.locator('html')).toHaveAttribute('data-baseline-stress-commits', String(expectedCommits));
  expect(new URL(page.url()).pathname).toBe(route);
}

async function settleAndCollect(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>(resolveIdle => {
    const requestIdle = (window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    }).requestIdleCallback;
    if (requestIdle) {
      requestIdle(() => resolveIdle(), { timeout: 1_000 });
    } else {
      setTimeout(resolveIdle, 0);
    }
  }));
  await page.requestGC();
  await page.requestGC();
}

async function usedHeap(page: Page): Promise<number> {
  return page.evaluate(() => {
    const memory = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory;
    if (!memory || typeof memory.usedJSHeapSize !== 'number') {
      throw new Error('Chromium performance.memory.usedJSHeapSize is unavailable for the route-cache study.');
    }
    return memory.usedJSHeapSize;
  });
}
