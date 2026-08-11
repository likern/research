import { expect, test, type Locator, type Page } from '@playwright/test';

import { openReadyDocument } from './support/direct-document.js';
import { expectInteractiveState } from './support/interactive-accessibility.js';

const modelId = 'version-chain-snapshot';
const viewerSelector = `pinega-diagram-viewer[data-diagram-id="${modelId}"]`;
const englishModelPath = `/diagrams/models/${modelId}.json`;
const russianModelPath = `/content/diagrams/ru/${modelId}.json`;
const semanticTest = { tag: ['@aria-tree', '@accessibility'] };

interface ActivatedIsland {
  readonly details: Locator;
  readonly root: Locator;
  readonly toggle: Locator;
  readonly viewer: Locator;
}

async function activateIsland(page: Page, route = '/research/'): Promise<ActivatedIsland> {
  await openReadyDocument(page, route);
  const viewer = page.locator(viewerSelector);
  await viewer.locator('.pinega-diagram-viewport').scrollIntoViewIfNeeded();
  await expect(viewer).toHaveAttribute('data-pinega-feature-state', 'ready');
  await expect(viewer).toHaveAttribute('data-pinega-island-state', 'connected');
  await expect(viewer).toHaveAttribute('data-pinega-island-ready', 'true');
  const details = viewer.locator('.pinega-diagram-transcript');
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open', '');
  const root = viewer.locator('[data-pinega-island-root]');
  await expect(root).toBeVisible();
  const toggle = root.locator('.pinega-diagram-model-toggle');
  await expect(toggle).toBeVisible();
  return { details, root, toggle, viewer };
}

test('canonical diagram remains complete when the Lit island cannot register', semanticTest, async ({ page }, testInfo) => {
  await page.route('**/assets/main-*.js', route => route.abort('failed'));
  await page.goto('/research/', { waitUntil: 'domcontentloaded' });

  const viewer = page.locator(viewerSelector);
  await expect(viewer.locator('figure.pinega-semantic-diagram')).toBeVisible();
  await expect(viewer.locator('svg[role="img"]')).toBeVisible();
  const details = viewer.locator('.pinega-diagram-transcript');
  await details.locator('summary').click();
  await expect(details.locator('pre')).toBeVisible();
  await expect(details.locator(`a[download][href="${englishModelPath}"]`)).toBeVisible();
  await expect(viewer.locator('[data-pinega-island-root]')).toBeHidden();
  await expect(viewer.locator('.pinega-diagram-model-toggle')).toHaveCount(0);
  expect(await page.evaluate(() => customElements.get('pinega-diagram-viewer') === undefined)).toBeTruthy();
  await expectInteractiveState(page, 'LIT-INSPECTOR-NO-JS-FALLBACK', testInfo);
});

test('stateful inspector exposes collapsed, pending, and complete semantics', semanticTest, async ({ page }, testInfo) => {
  const canonical = await page.request.get(englishModelPath);
  expect(canonical.ok()).toBeTruthy();
  const canonicalBody = await canonical.text();
  await canonical.dispose();
  let releaseModel: (() => void) | undefined;
  const modelGate = new Promise<void>(resolve => { releaseModel = resolve; });
  await page.route(`**${englishModelPath}`, async route => {
    await modelGate;
    await route.fulfill({ status: 200, contentType: 'application/json', body: canonicalBody });
  });
  const modelRequests: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path === englishModelPath) modelRequests.push(path);
  });
  const island = await activateIsland(page);
  await page.locator('main').evaluate(element => { element.dataset.testIslandMainIdentity = 'preserved'; });
  expect(modelRequests).toHaveLength(0);
  await expect(island.root.locator('.pinega-diagram-model-inspector')).toHaveAttribute('data-pinega-task-state', 'initial');
  await expectInteractiveState(page, 'LIT-INSPECTOR-COLLAPSED', testInfo);

  await island.toggle.click();
  await expect(island.toggle).toHaveAttribute('aria-expanded', 'true');
  const panel = island.root.locator('.pinega-diagram-model-panel');
  await expect(panel).toHaveAttribute('data-pinega-model-state', 'pending');
  await expect(panel).toHaveAttribute('aria-busy', 'true');
  await expectInteractiveState(page, 'LIT-INSPECTOR-PENDING', testInfo);
  releaseModel?.();
  await expect(panel).toHaveAttribute('data-pinega-model-state', 'complete');
  await expect(panel).toHaveAttribute('aria-busy', 'false');
  await expect(panel.getByRole('heading', { name: 'Validated semantic model' })).toBeVisible();
  await expect(panel.locator('.pinega-diagram-model-name')).toHaveText('Newest-to-oldest row-version chain');
  await expect(panel.locator('dd')).toHaveText(['v1', 'Version chain', '3']);
  await expectInteractiveState(page, 'LIT-INSPECTOR-COMPLETE', testInfo);
  expect(modelRequests).toEqual([englishModelPath]);
  await expect(page.locator('main')).toHaveAttribute('data-test-island-main-identity', 'preserved');

  await island.toggle.click();
  await expect(panel).toHaveCount(0);
  await island.root.getByRole('button', { name: 'Inspect semantic model' }).click();
  await expect(island.root.locator('.pinega-diagram-model-panel')).toHaveAttribute('data-pinega-model-state', 'complete');
  expect(modelRequests).toEqual([englishModelPath]);
});

test('Russian island reads only its localized component model', async ({ page }) => {
  const modelRequests: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.includes(`/${modelId}.json`)) modelRequests.push(path);
  });
  const island = await activateIsland(page, '/ru/research/');
  await expect(island.toggle).toHaveText('Исследовать семантическую модель');
  await island.toggle.click();

  const panel = island.root.locator('.pinega-diagram-model-panel');
  await expect(panel).toHaveAttribute('data-pinega-model-state', 'complete');
  await expect(panel.getByRole('heading', { name: 'Проверенная семантическая модель' })).toBeVisible();
  await expect(panel.locator('.pinega-diagram-model-name')).toHaveText('Цепочка версий строки от новой к старой');
  await expect(panel.locator('dd')).toHaveText(['v1', 'Цепочка версий', '3']);
  expect(modelRequests).toEqual([russianModelPath]);
});

test('@lit/task exposes deterministic error, retry-pending, and retry-complete states', semanticTest, async ({ page }, testInfo) => {
  const canonical = await page.request.get(englishModelPath);
  expect(canonical.ok()).toBeTruthy();
  const canonicalBody = await canonical.text();
  await canonical.dispose();
  const invalid = { ...JSON.parse(canonicalBody) as Record<string, unknown>, id: 'other-model' };
  let attempts = 0;
  let releaseRetry: (() => void) | undefined;
  const retryGate = new Promise<void>(resolve => { releaseRetry = resolve; });
  await page.route(`**${englishModelPath}`, async route => {
    attempts += 1;
    if (attempts === 2) await retryGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: attempts === 1 ? JSON.stringify(invalid) : canonicalBody,
    });
  });

  const island = await activateIsland(page);
  await island.toggle.click();
  await expect(island.root.getByRole('alert')).toHaveText('The semantic model could not be loaded and validated.');
  await expect(island.root.locator('.pinega-diagram-model-panel')).toHaveAttribute('data-pinega-model-state', 'error');
  await expectInteractiveState(page, 'LIT-INSPECTOR-ERROR', testInfo);
  await island.root.getByRole('button', { name: 'Retry' }).click();
  await expect(island.root.locator('.pinega-diagram-model-panel')).toHaveAttribute('data-pinega-model-state', 'pending');
  await expectInteractiveState(page, 'LIT-INSPECTOR-RETRY-PENDING', testInfo);
  releaseRetry?.();
  await expect(island.root.locator('.pinega-diagram-model-panel')).toHaveAttribute('data-pinega-model-state', 'complete');
  await expectInteractiveState(page, 'LIT-INSPECTOR-RETRY-COMPLETE', testInfo);
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'research');
  expect(attempts).toBe(2);
});

test('disconnect aborts local async work and reconnect restores exactly one external listener', semanticTest, async ({ page }, testInfo) => {
  const canonical = await page.request.get(englishModelPath);
  expect(canonical.ok()).toBeTruthy();
  const canonicalBody = await canonical.text();
  await canonical.dispose();
  let attempts = 0;
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
  await page.route(`**${englishModelPath}`, async route => {
    attempts += 1;
    if (attempts === 1) await firstGate;
    try {
      await route.fulfill({ status: 200, contentType: 'application/json', body: canonicalBody });
    } catch (error) {
      if (!/abort|cancel|closed|handled|target/iu.test(String(error))) throw error;
    }
  });

  const island = await activateIsland(page);
  await island.toggle.click();
  await expect.poll(() => attempts).toBe(1);
  await expect(island.toggle).toHaveAttribute('aria-expanded', 'true');
  await page.evaluate(selector => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element?.parentNode) throw new TypeError('Missing connected diagram island.');
    const marker = document.createComment('pinega-lit-island-marker');
    element.parentNode.insertBefore(marker, element);
    element.remove();
    (window as Window & { __pinegaDetachedIsland?: { element: HTMLElement; marker: Comment } }).__pinegaDetachedIsland = { element, marker };
  }, viewerSelector);
  expect(await page.evaluate(() => {
    const element = (window as Window & { __pinegaDetachedIsland?: { element: HTMLElement } }).__pinegaDetachedIsland?.element;
    return element ? { connected: element.isConnected, renderer: element.dataset.renderer ?? null, state: element.dataset.pinegaIslandState } : null;
  })).toEqual({ connected: false, renderer: null, state: 'disconnected' });
  await expectInteractiveState(page, 'LIT-INSPECTOR-DISCONNECTED', testInfo);

  releaseFirst?.();
  await page.waitForTimeout(50);
  expect(await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const element = (window as Window & { __pinegaDetachedIsland?: { element: HTMLElement } }).__pinegaDetachedIsland?.element;
    return element?.querySelector<HTMLButtonElement>('.pinega-diagram-model-toggle')?.getAttribute('aria-expanded');
  })).toBe('true');

  await page.evaluate(() => {
    const retained = (window as Window & {
      __pinegaDetachedIsland?: { element: HTMLElement; marker: Comment };
    }).__pinegaDetachedIsland;
    if (!retained?.marker.parentNode) throw new TypeError('Missing diagram island reconnect marker.');
    retained.marker.parentNode.insertBefore(retained.element, retained.marker);
    retained.marker.remove();
  });
  await expect.poll(() => attempts).toBe(2);
  const reconnected = page.locator(viewerSelector);
  await expect(reconnected).toHaveAttribute('data-pinega-island-state', 'connected');
  await expect(reconnected.locator('.pinega-diagram-model-panel')).toHaveAttribute('data-pinega-model-state', 'complete');
  await expectInteractiveState(page, 'LIT-INSPECTOR-RECONNECTED', testInfo);
  const toggle = reconnected.locator('.pinega-diagram-model-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await expectInteractiveState(page, 'LIT-INSPECTOR-ESCAPE-COLLAPSED', testInfo);
  expect(attempts).toBe(2);
});

test('a fresh clone discards rendered markers and owns independent state and task', semanticTest, async ({ page }, testInfo) => {
  const canonical = await page.request.get(englishModelPath);
  expect(canonical.ok()).toBeTruthy();
  const canonicalBody = await canonical.text();
  await canonical.dispose();
  let modelRequests = 0;
  await page.route(`**${englishModelPath}`, async route => {
    modelRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: canonicalBody,
    });
  });
  const island = await activateIsland(page);
  await island.toggle.click();
  await expect(island.root.locator('.pinega-diagram-model-panel')).toHaveAttribute('data-pinega-model-state', 'complete');
  expect(modelRequests).toBe(1);

  await page.evaluate(selector => {
    const original = document.querySelector<HTMLElement>(selector);
    if (!original) throw new TypeError('Missing diagram island to clone.');
    const clone = original.cloneNode(true);
    original.replaceWith(clone);
  }, viewerSelector);

  const clone = page.locator(viewerSelector);
  await expect(clone).toHaveAttribute('data-pinega-island-state', 'connected');
  await expect(clone.locator('.pinega-diagram-model-toggle')).toHaveCount(1);
  const cloneToggle = clone.locator('.pinega-diagram-model-toggle');
  await expect(cloneToggle).toHaveAttribute('aria-expanded', 'false');
  await expectInteractiveState(page, 'LIT-INSPECTOR-CLONE-COLLAPSED', testInfo);
  await cloneToggle.click();
  await expect(clone.locator('.pinega-diagram-model-panel')).toHaveAttribute('data-pinega-model-state', 'complete');
  await expectInteractiveState(page, 'LIT-INSPECTOR-CLONE-COMPLETE', testInfo);
  expect(modelRequests).toBe(2);
});
