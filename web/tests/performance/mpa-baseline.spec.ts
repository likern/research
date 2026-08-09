import { expect, test, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, freemem, platform, release, totalmem } from 'node:os';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

interface ScenarioResult {
  id: string;
  description: string;
  proxyFor?: string;
  actionDurationMs: number;
  finalUrl: string;
  buildId: string;
  requests: {
    count: number;
    encodedBytes: number;
    byType: Record<string, { count: number; encodedBytes: number }>;
    fromDiskCache: number;
    fromServiceWorker: number;
  };
  navigation: Record<string, number>;
  webVitals: {
    lcpMs: number | null;
    cls: number;
    maxEventDurationMs: number | null;
    longTaskCount: number;
    longTaskDurationMs: number;
  };
  runtime: {
    before: Record<string, number>;
    after: Record<string, number>;
    delta: Record<string, number>;
  };
  heap: {
    beforeUsedBytes: number;
    afterUsedBytes: number;
    deltaUsedBytes: number;
    afterTotalBytes: number;
  };
}

interface NetworkRecord {
  type: string;
  encodedBytes: number;
  fromDiskCache: boolean;
  fromServiceWorker: boolean;
}

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const artifactPath = resolve(webRoot, 'artifacts/baseline/gate-4-mpa-baseline.json');
const packageMetadata = JSON.parse(await readFile(resolve(webRoot, 'package.json'), 'utf8')) as {
  engines: { node: string };
  devDependencies: Record<string, string>;
};

test('records the static MPA cost before same-document navigation', async ({ browser }) => {
  const scenarios: ScenarioResult[] = [];
  const createContext = () => browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
  });
  scenarios.push(await measureScenario(createContext, {
    id: 'initial-direct-load',
    description: 'Cold direct load of the canonical homepage.',
    run: async (page, _session, beginMeasurement) => {
      await beginMeasurement();
      return timed(async () => {
        await page.goto('/', { waitUntil: 'load' });
      });
    },
  }));
  scenarios.push(await measureScenario(createContext, {
    id: 'simple-route-transition',
    description: 'Current MPA transition from the homepage to Technology.',
    run: async (page, _session, beginMeasurement) => {
      await page.goto('/', { waitUntil: 'load' });
      await page.waitForLoadState('networkidle');
      await beginMeasurement();
      return timed(async () => {
        await Promise.all([
          page.waitForURL('**/technology/'),
          page.locator('a[href="/technology/"]').first().click(),
        ]);
        await page.waitForLoadState('load');
      });
    },
  }));
  scenarios.push(await measureScenario(createContext, {
    id: 'back-forward',
    description: 'MPA traversal after a homepage-to-Technology transition.',
    run: async (page, _session, beginMeasurement) => {
      await page.goto('/', { waitUntil: 'load' });
      await Promise.all([
        page.waitForURL('**/technology/'),
        page.locator('a[href="/technology/"]').first().click(),
      ]);
      await page.waitForLoadState('networkidle');
      await beginMeasurement();
      return timed(async () => {
        await page.goBack({ waitUntil: 'load' });
        await page.goForward({ waitUntil: 'load' });
      });
    },
  }));
  scenarios.push(await measureScenario(createContext, {
    id: 'locale-switch',
    description: 'MPA switch from the English documentation landing to its Russian peer.',
    run: async (page, _session, beginMeasurement) => {
      await page.goto('/docs/', { waitUntil: 'load' });
      await page.waitForLoadState('networkidle');
      await beginMeasurement();
      return timed(async () => {
        await Promise.all([
          page.waitForURL('**/ru/docs/'),
          page.locator('.pinega-language-switcher a[href="/ru/docs/"]').click(),
        ]);
        await page.waitForLoadState('load');
      });
    },
  }));
  scenarios.push(await measureScenario(createContext, {
    id: 'webawesome-lit-route',
    description: 'Direct load of the component laboratory, including Web Awesome and its Lit runtime.',
    run: async (page, _session, beginMeasurement) => {
      await beginMeasurement();
      return timed(async () => {
        await page.goto('/component-lab/', { waitUntil: 'load' });
      });
    },
  }));
  scenarios.push(await measureScenario(createContext, {
    id: 'cold-reload-cost',
    description: 'Cold-cache hard reload cost used as the Gate 4.0 performance proxy for deployment replacement.',
    proxyFor: 'reload-after-new-deployment; two-build compatibility is covered by deterministic contract fixtures',
    run: async (page, session, beginMeasurement) => {
      await page.goto('/', { waitUntil: 'load' });
      await page.waitForLoadState('networkidle');
      await session.send('Network.setCacheDisabled', { cacheDisabled: true });
      await beginMeasurement();
      return timed(async () => {
        await page.reload({ waitUntil: 'load' });
      });
    },
  }));

  const cpuModels = [...new Set(cpus().map(cpu => cpu.model))];
  const payload = {
    schemaVersion: 1,
    kind: 'pinega-gate-4-mpa-baseline',
    generatedAt: new Date().toISOString(),
    source: {
      repository: process.env.GITHUB_REPOSITORY ?? 'local-checkout',
      sourceSha: process.env.PINEGA_DEPLOYMENT_SOURCE_SHA || process.env.GITHUB_SHA || null,
      testedSha: process.env.PINEGA_DEPLOYMENT_TESTED_SHA || process.env.GITHUB_SHA || null,
    },
    profile: {
      name: process.env.PINEGA_BASELINE_PROFILE ?? 'local-uncontrolled',
      runnerOs: process.env.RUNNER_OS ?? platform(),
      runnerArch: process.env.RUNNER_ARCH ?? process.arch,
      osRelease: release(),
      node: process.version,
      requiredNode: packageMetadata.engines.node,
      playwright: packageMetadata.devDependencies['@playwright/test'],
      browser: await browser.version(),
      viewport: { width: 1440, height: 1000 },
      cpuModels,
      logicalCpuCount: cpus().length,
      totalMemoryBytes: totalmem(),
      freeMemoryBytesAtReport: freemem(),
    },
    policy: {
      numericBudgetsEnforced: false,
      repetitions: 1,
      note: 'Raw diagnostic baseline only. Gate 4.0 intentionally sets no latency or Web Vitals threshold from one noisy run.',
    },
    scenarios,
  };

  expect(scenarios).toHaveLength(6);
  expect(new Set(scenarios.map(scenario => scenario.buildId)).size).toBe(1);
  const scenariosRequiringNetwork = new Set([
    'initial-direct-load',
    'simple-route-transition',
    'locale-switch',
    'webawesome-lit-route',
    'cold-reload-cost',
  ]);
  for (const scenario of scenarios) {
    if (scenariosRequiringNetwork.has(scenario.id)) {
      expect(scenario.requests.count, scenario.id).toBeGreaterThan(0);
    } else {
      expect(scenario.requests.count, scenario.id).toBeGreaterThanOrEqual(0);
    }
    expect(Number.isFinite(scenario.actionDurationMs), scenario.id).toBe(true);
    expect(scenario.buildId, scenario.id).toMatch(/^sha256-[a-f0-9]{64}$/u);
  }
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
});

async function measureScenario(
  createContext: () => Promise<BrowserContext>,
  scenario: {
    id: string;
    description: string;
    proxyFor?: string;
    run: (page: Page, session: CDPSession, beginMeasurement: () => Promise<void>) => Promise<number>;
  },
): Promise<ScenarioResult> {
  const context = await createContext();
  await installObservers(context);
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await Promise.all([
    session.send('Network.enable'),
    session.send('Performance.enable'),
  ]);
  const requests = new Map<string, NetworkRecord>();
  session.on('Network.responseReceived', event => {
    requests.set(event.requestId, {
      type: event.type,
      encodedBytes: 0,
      fromDiskCache: event.response.fromDiskCache ?? false,
      fromServiceWorker: event.response.fromServiceWorker ?? false,
    });
  });
  session.on('Network.loadingFinished', event => {
    const request = requests.get(event.requestId);
    if (request) request.encodedBytes = event.encodedDataLength;
  });

  let beforeHeap: { usedSize: number; totalSize: number } | undefined;
  let beforeRuntime: Record<string, number> | undefined;
  const beginMeasurement = async () => {
    if (beforeHeap || beforeRuntime) throw new TypeError(`${scenario.id}: measurement boundary was set more than once`);
    requests.clear();
    const [heap, metrics] = await Promise.all([
      session.send('Runtime.getHeapUsage'),
      session.send('Performance.getMetrics'),
    ]);
    beforeHeap = heap;
    beforeRuntime = selectRuntimeMetrics(metrics.metrics);
  };
  const actionDurationMs = await scenario.run(page, session, beginMeasurement);
  if (!beforeHeap || !beforeRuntime) throw new TypeError(`${scenario.id}: measurement boundary was not set`);
  const measuredBeforeHeap = beforeHeap;
  const measuredBeforeRuntime = beforeRuntime;
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await page.locator('[data-theme-toggle]').first().click();
  await page.waitForTimeout(150);
  const [afterHeap, performanceMetrics, pageMetrics] = await Promise.all([
    session.send('Runtime.getHeapUsage'),
    session.send('Performance.getMetrics'),
    page.evaluate(() => {
      const navigation = performance.getEntries().find(entry => String(entry.entryType) === 'navigation') as PerformanceNavigationTiming | undefined;
      const state = (window as Window & {
        __pinegaMpaBaseline?: {
          lcpMs: number | null;
          cls: number;
          eventDurations: number[];
          longTasks: number[];
        };
      }).__pinegaMpaBaseline;
      return {
        buildId: document.documentElement.dataset.pinegaBuild ?? '',
        navigation: navigation ? {
          durationMs: navigation.duration,
          responseStartMs: navigation.responseStart,
          responseEndMs: navigation.responseEnd,
          domInteractiveMs: navigation.domInteractive,
          domContentLoadedMs: navigation.domContentLoadedEventEnd,
          loadEventEndMs: navigation.loadEventEnd,
          transferSizeBytes: navigation.transferSize,
          encodedBodySizeBytes: navigation.encodedBodySize,
          decodedBodySizeBytes: navigation.decodedBodySize,
        } : {},
        webVitals: {
          lcpMs: state?.lcpMs ?? null,
          cls: state?.cls ?? 0,
          maxEventDurationMs: state?.eventDurations.length ? Math.max(...state.eventDurations) : null,
          longTaskCount: state?.longTasks.length ?? 0,
          longTaskDurationMs: state?.longTasks.reduce((sum, value) => sum + value, 0) ?? 0,
        },
      };
    }),
  ]);
  const requestSummary = summarizeRequests([...requests.values()]);
  const afterRuntime = selectRuntimeMetrics(performanceMetrics.metrics);
  const runtime = {
    before: measuredBeforeRuntime,
    after: afterRuntime,
    delta: Object.fromEntries(Object.keys(afterRuntime).map(name => [
      name,
      (afterRuntime[name] ?? 0) - (measuredBeforeRuntime[name] ?? 0),
    ])),
  };
  const result: ScenarioResult = {
    id: scenario.id,
    description: scenario.description,
    ...(scenario.proxyFor ? { proxyFor: scenario.proxyFor } : {}),
    actionDurationMs,
    finalUrl: page.url(),
    buildId: pageMetrics.buildId,
    requests: requestSummary,
    navigation: pageMetrics.navigation,
    webVitals: pageMetrics.webVitals,
    runtime,
    heap: {
      beforeUsedBytes: measuredBeforeHeap.usedSize,
      afterUsedBytes: afterHeap.usedSize,
      deltaUsedBytes: afterHeap.usedSize - measuredBeforeHeap.usedSize,
      afterTotalBytes: afterHeap.totalSize,
    },
  };
  await context.close();
  return result;
}

async function installObservers(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const state = {
      lcpMs: null as number | null,
      cls: 0,
      eventDurations: [] as number[],
      longTasks: [] as number[],
    };
    (window as Window & { __pinegaMpaBaseline?: typeof state }).__pinegaMpaBaseline = state;
    const supported = new Set(PerformanceObserver.supportedEntryTypes);
    if (supported.has('largest-contentful-paint')) {
      new PerformanceObserver(list => {
        const entries = list.getEntries();
        const last = entries.at(-1);
        if (last) state.lcpMs = last.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    }
    if (supported.has('layout-shift')) {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput: boolean; value: number }>) {
          if (!entry.hadRecentInput) state.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    }
    if (supported.has('event')) {
      new PerformanceObserver(list => {
        state.eventDurations.push(...list.getEntries().map(entry => entry.duration));
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit & { durationThreshold: number });
    }
    if (supported.has('longtask')) {
      new PerformanceObserver(list => {
        state.longTasks.push(...list.getEntries().map(entry => entry.duration));
      }).observe({ type: 'longtask', buffered: true });
    }
  });
}

function summarizeRequests(requests: NetworkRecord[]): ScenarioResult['requests'] {
  const byType: ScenarioResult['requests']['byType'] = {};
  for (const request of requests) {
    const type = request.type || 'Other';
    const bucket = byType[type] ?? { count: 0, encodedBytes: 0 };
    bucket.count += 1;
    bucket.encodedBytes += request.encodedBytes;
    byType[type] = bucket;
  }
  return {
    count: requests.length,
    encodedBytes: requests.reduce((sum, request) => sum + request.encodedBytes, 0),
    byType,
    fromDiskCache: requests.filter(request => request.fromDiskCache).length,
    fromServiceWorker: requests.filter(request => request.fromServiceWorker).length,
  };
}

function selectRuntimeMetrics(metrics: Array<{ name: string; value: number }>): Record<string, number> {
  const selected = new Set([
    'Documents',
    'Frames',
    'JSEventListeners',
    'JSHeapTotalSize',
    'JSHeapUsedSize',
    'LayoutCount',
    'LayoutDuration',
    'Nodes',
    'RecalcStyleCount',
    'RecalcStyleDuration',
    'ScriptDuration',
    'TaskDuration',
    'V8CompileDuration',
  ]);
  return Object.fromEntries(metrics
    .filter(metric => selected.has(metric.name))
    .map(metric => [metric.name, metric.value]));
}

async function timed(action: () => Promise<void>): Promise<number> {
  const started = performance.now();
  await action();
  return performance.now() - started;
}
