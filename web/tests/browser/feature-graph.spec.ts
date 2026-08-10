import { expect, test, type Page, type Request } from '@playwright/test';

import { openReadyDocument } from './support/direct-document.js';

interface FeatureGraphManifest {
  features: Array<{ id: string; chunk: string }>;
  lit: { runtimeChunk: string };
}

interface SiteManifest {
  navigation: { featureGraph: { assetManifest: string } };
}

async function ready(page: Page, route: string): Promise<void> {
  await openReadyDocument(page, route);
}

async function featureGraph(page: Page): Promise<FeatureGraphManifest> {
  const siteResponse = await page.request.get('/site-manifest.json');
  expect(siteResponse.ok()).toBeTruthy();
  const site = await siteResponse.json() as SiteManifest;
  await siteResponse.dispose();
  const response = await page.request.get(site.navigation.featureGraph.assetManifest);
  expect(response.ok()).toBeTruthy();
  const graph = await response.json() as FeatureGraphManifest;
  await response.dispose();
  return graph;
}

function requestsForAsset(requests: Request[], asset: string): Request[] {
  return requests.filter(request => new URL(request.url()).pathname === asset);
}

function requestsForAssetInFinalDocument(requests: Request[], documentRoute: string, asset: string): Request[] {
  let finalDocumentIndex = -1;
  for (const [index, request] of requests.entries()) {
    if (request.resourceType() === 'document' && new URL(request.url()).pathname === documentRoute) {
      finalDocumentIndex = index;
    }
  }
  expect(finalDocumentIndex, `${documentRoute} should have a main-document request`).toBeGreaterThanOrEqual(0);
  return requestsForAsset(requests.slice(finalDocumentIndex), asset);
}

async function activate(page: Page, selector: string): Promise<void> {
  await page.locator(selector).evaluate((link: HTMLAnchorElement) => link.click());
}

test('boot route honors critical and deferred classes through the closed registry', async ({ page }) => {
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));
  const graph = await featureGraph(page);
  const benchmarkChunk = graph.features.find(feature => feature.id === 'benchmark')?.chunk;
  const codeChunk = graph.features.find(feature => feature.id === 'code-example')?.chunk;
  expect(benchmarkChunk).toBeTruthy();
  expect(codeChunk).toBeTruthy();

  await ready(page, '/component-lab/');

  await expect(page.locator('html')).toHaveAttribute('data-pinega-feature-graph', 'dynamic');
  await expect(page.locator('pinega-benchmark')).toHaveAttribute('data-pinega-feature-state', 'ready');
  await expect(page.locator('pinega-code-example')).toHaveAttribute('data-pinega-feature-state', 'ready');
  expect(requestsForAssetInFinalDocument(requests, '/component-lab/', benchmarkChunk as string)).toHaveLength(1);
  expect(requestsForAssetInFinalDocument(requests, '/component-lab/', codeChunk as string)).toHaveLength(1);
});

test('deferred features start after commit and reuse one module across locale routes', async ({ page }) => {
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));
  const graph = await featureGraph(page);
  const filterChunk = graph.features.find(feature => feature.id === 'doc-topic-filter')?.chunk;
  expect(filterChunk).toBeTruthy();
  await ready(page, '/');
  await page.evaluate(() => {
    const events: string[] = [];
    (window as Window & { __pinegaFeatureOrder?: string[] }).__pinegaFeatureOrder = events;
    window.addEventListener('pinega:navigation-commit', () => events.push('commit'));
    window.addEventListener('pinega:feature-ready', event => {
      const detail = (event as CustomEvent<{ featureId: string }>).detail;
      if (detail.featureId === 'doc-topic-filter') events.push('doc-topic-filter-ready');
    });
  });

  await activate(page, '[data-primary-navigation] a[href="/docs/"]');
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'documentation');
  await expect(page.locator('pinega-doc-search')).toHaveAttribute('data-pinega-feature-state', 'ready');
  expect(await page.evaluate(() => (
    (window as Window & { __pinegaFeatureOrder?: string[] }).__pinegaFeatureOrder
  ))).toEqual(['commit', 'doc-topic-filter-ready']);

  await activate(page, '[data-pinega-language-switcher] a[href="/ru/docs/"]');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('pinega-doc-search')).toHaveAttribute('data-pinega-feature-state', 'ready');
  expect(requestsForAsset(requests, filterChunk as string)).toHaveLength(1);
});

test('viewport feature loads near the diagram and reuses Web Awesome Lit from the module map', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 400 });
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));
  const graph = await featureGraph(page);
  const diagramChunk = graph.features.find(feature => feature.id === 'diagram-viewer')?.chunk;
  expect(diagramChunk).toBeTruthy();
  await ready(page, '/research/');

  const diagrams = page.locator('pinega-diagram-viewer');
  await expect(diagrams).toHaveCount(3);
  await expect(diagrams.first()).toHaveAttribute('data-pinega-feature-state', 'waiting');
  expect(requestsForAsset(requests, diagramChunk as string)).toHaveLength(0);
  expect(requestsForAsset(requests, graph.lit.runtimeChunk)).toHaveLength(1);

  await diagrams.first().scrollIntoViewIfNeeded();
  await expect(diagrams.first()).toHaveAttribute('data-pinega-feature-state', 'ready');
  await expect(diagrams.first()).toHaveAttribute('data-renderer', 'lit');
  expect(requestsForAsset(requests, diagramChunk as string)).toHaveLength(1);
  expect(requestsForAsset(requests, graph.lit.runtimeChunk)).toHaveLength(1);
  expect(await page.evaluate(() => ({
    litElement: (window as Window & { litElementVersions?: string[] }).litElementVersions,
    litHtml: (window as Window & { litHtmlVersions?: string[] }).litHtmlVersions,
    reactiveElement: (window as Window & { reactiveElementVersions?: string[] }).reactiveElementVersions,
  }))).toEqual({
    litElement: ['4.2.2'],
    litHtml: ['3.3.3'],
    reactiveElement: ['2.1.2'],
  });

  await page.evaluate(() => {
    (window as Window & { __pinegaDiagramIsland?: HTMLElement | undefined }).__pinegaDiagramIsland =
      document.querySelector<HTMLElement>('pinega-diagram-viewer') ?? undefined;
  });
  await activate(page, '[data-primary-navigation] a[href="/docs/"]');
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'documentation');
  expect(await page.evaluate(() => {
    const island = (window as Window & { __pinegaDiagramIsland?: HTMLElement | undefined }).__pinegaDiagramIsland;
    return island ? { connected: island.isConnected, renderer: island.dataset.renderer ?? null } : null;
  })).toEqual({ connected: false, renderer: null });
});

test('critical feature chunk failure commits nothing and uses one guarded native document', async ({ page }) => {
  const graph = await featureGraph(page);
  const benchmarkChunk = graph.features.find(feature => feature.id === 'benchmark')?.chunk;
  expect(benchmarkChunk).toBeTruthy();
  let failedChunkRequests = 0;
  await page.route(`**${benchmarkChunk}`, async route => {
    if (failedChunkRequests === 0) {
      failedChunkRequests += 1;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  const routeRequestTypes: string[] = [];
  let injected = false;
  await page.route('**/technology/', async route => {
    const resourceType = route.request().resourceType();
    routeRequestTypes.push(resourceType);
    if (resourceType === 'fetch' && !injected) {
      injected = true;
      const response = await route.fetch();
      const body = (await response.text())
        .replace(
          'data-pinega-features="" data-pinega-critical-features=""',
          'data-pinega-features="benchmark" data-pinega-critical-features="benchmark"',
        )
        .replace(/(<main\b[^>]*>)/u, '$1<pinega-benchmark><p>Semantic fallback.</p></pinega-benchmark>');
      await route.fulfill({ response, body });
      return;
    }
    await route.continue();
  });

  await ready(page, '/');
  await page.evaluate(() => {
    sessionStorage.setItem('pinega-gate-4-4-fallback-events', '[]');
    const root = document.querySelector<HTMLElement>('pinega-site-header');
    if (root) root.dataset.testShellIdentity = 'preserved';
    window.addEventListener('pinega:navigation-fallback', event => {
      const key = 'pinega-gate-4-4-fallback-events';
      const events = JSON.parse(sessionStorage.getItem(key) ?? '[]') as unknown[];
      events.push((event as CustomEvent).detail);
      sessionStorage.setItem(key, JSON.stringify(events));
    });
  });

  await activate(page, '[data-primary-navigation] a[href="/technology/"]');

  await expect(page).toHaveURL(/\/technology\/$/u);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
  await expect(page.locator('pinega-benchmark')).toHaveCount(0);
  await expect(page.locator('pinega-site-header')).not.toHaveAttribute('data-test-shell-identity', 'preserved');
  expect(failedChunkRequests).toBe(1);
  expect(routeRequestTypes).toEqual(['fetch', 'document']);
  expect(await page.evaluate(() => ({
    events: JSON.parse(sessionStorage.getItem('pinega-gate-4-4-fallback-events') ?? '[]'),
    fallbackGuard: sessionStorage.getItem('pinega-navigation-hard-fallback-v1'),
  }))).toEqual({
    events: [{
      url: 'http://127.0.0.1:4173/technology/',
      reason: 'feature-module',
    }],
    fallbackGuard: null,
  });
});
