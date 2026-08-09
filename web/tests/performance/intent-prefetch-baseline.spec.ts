import { expect, test, type Request } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface PrefetchMetrics {
  schemaVersion: number;
  kind: string;
  policy: {
    hoverDelayMs: number;
    maxConcurrent: number;
    maxQueued: number;
    slowEffectiveTypes: readonly string[];
    routePriority: string;
  };
  network: {
    allowed: boolean;
    reason: string;
  };
  scheduler: {
    active: number;
    queued: number;
  };
  intents: {
    hover: number;
    focus: number;
    pointer: number;
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
    source: ByteOutcome;
    transfer: ByteOutcome & {
      resourceTimingMeasurements: number;
      sourceFallbackMeasurements: number;
    };
  };
}

interface ByteOutcome {
  prefetched: number;
  useful: number;
  retainedUnused: number;
  finalizedUnused: number;
  wasted: number;
}

interface CommitDetail {
  preparation: {
    source: string;
    networkRequests: number;
    transferBytes: number;
    transferMeasurement: string;
  };
  prefetch: {
    hit: boolean;
    source: string | null;
  };
}

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const artifactPath = resolve(webRoot, 'artifacts/baseline/gate-4.5-intent-prefetch-baseline.json');

test('records the Gate 4.5 useful and unused intent-prefetch byte baseline', async ({ page, browserName }) => {
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-navigation', 'enhanced');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-prefetch', 'intent');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-prefetch-policy', 'allowed');

  await page.evaluate(() => {
    (window as Window & { __PINEGA_BASELINE_COMMIT__?: unknown }).__PINEGA_BASELINE_COMMIT__ = undefined;
    window.addEventListener('pinega:navigation-commit', event => {
      (window as Window & { __PINEGA_BASELINE_COMMIT__?: unknown }).__PINEGA_BASELINE_COMMIT__ =
        (event as CustomEvent).detail;
    });
  });

  const requests: Request[] = [];
  page.on('request', request => requests.push(request));
  const technologyLink = page.locator('[data-primary-navigation] a[href="/technology/"]');
  await technologyLink.dispatchEvent('focusin', { bubbles: true });
  await expect.poll(async () => (await readMetrics()).prefetches.completed).toBe(1);
  await expect.poll(async () => (await readMetrics()).scheduler.active).toBe(0);

  await technologyLink.evaluate((link: HTMLAnchorElement) => link.click());
  await expect(page).toHaveURL(/\/technology\/$/u);
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');

  const researchLink = page.locator('[data-primary-navigation] a[href="/research/"]');
  await researchLink.dispatchEvent('pointerover', {
    bubbles: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: -1,
    buttons: 0,
  });
  await expect.poll(async () => (await readMetrics()).prefetches.completed).toBe(2);
  await expect.poll(async () => (await readMetrics()).scheduler.active).toBe(0);

  const metrics = await readMetrics();
  const commit = await page.evaluate(() => {
    const detail = (window as Window & { __PINEGA_BASELINE_COMMIT__?: CommitDetail }).__PINEGA_BASELINE_COMMIT__;
    if (!detail) throw new TypeError('Missing Gate 4.5 baseline navigation commit.');
    return detail;
  });
  const routeFetches = requests
    .filter(request => request.resourceType() === 'fetch')
    .map(request => new URL(request.url()).pathname)
    .filter(pathname => pathname === '/technology/' || pathname === '/research/');

  expect(routeFetches).toEqual(['/technology/', '/research/']);
  expect(commit).toMatchObject({
    preparation: { source: 'cache', networkRequests: 0, transferBytes: 0, transferMeasurement: 'cache' },
    prefetch: { hit: true, source: 'cache' },
  });
  expect(metrics.policy).toMatchObject({
    hoverDelayMs: 80,
    maxConcurrent: 2,
    maxQueued: 8,
    routePriority: 'low',
  });
  expect(metrics.prefetches).toEqual({
    started: 2,
    completed: 2,
    failed: 0,
    aborted: 0,
    hits: 1,
    cacheHits: 1,
    inFlightHits: 0,
    retainedUnused: 1,
    finalizedUnused: 0,
    hitRate: 0.5,
  });
  assertByteAccounting(metrics.bytes.source);
  assertByteAccounting(metrics.bytes.transfer);
  expect(metrics.bytes.source.useful).toBeGreaterThan(0);
  expect(metrics.bytes.source.retainedUnused).toBeGreaterThan(0);
  expect(metrics.bytes.source.wasted).toBe(metrics.bytes.source.retainedUnused);
  expect(metrics.bytes.transfer.resourceTimingMeasurements + metrics.bytes.transfer.sourceFallbackMeasurements).toBe(2);

  const payload = {
    schemaVersion: 1,
    kind: 'pinega-gate-4.5-intent-prefetch-baseline',
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
      denominator: 'completed route HTML prefetches',
      hit: 'a completed or active prefetch consumed by a successful navigation commit',
      wastedBytes: 'prefetched minus useful bytes at observation time, partitioned into retained and finalized unused bytes',
    },
    buildId: await page.locator('html').getAttribute('data-pinega-build'),
    requests: {
      routeFetches,
      counts: Object.fromEntries(['/technology/', '/research/'].map(pathname => [
        pathname,
        routeFetches.filter(candidate => candidate === pathname).length,
      ])),
    },
    commit,
    metrics,
  };
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  async function readMetrics(): Promise<PrefetchMetrics> {
    return page.evaluate(() => {
      const snapshot = window.__PINEGA_PREFETCH_METRICS__;
      if (!snapshot) throw new TypeError('Missing Pinega prefetch metrics.');
      return snapshot as PrefetchMetrics;
    });
  }
});

function assertByteAccounting(outcome: ByteOutcome): void {
  expect(outcome.prefetched).toBeGreaterThan(0);
  expect(outcome.useful + outcome.wasted).toBe(outcome.prefetched);
  expect(outcome.retainedUnused + outcome.finalizedUnused).toBe(outcome.wasted);
}
