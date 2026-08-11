import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { openReadyDocument } from './support/direct-document.js';
import { captureSemanticTree, expectSemanticEquivalent } from './support/accessibility-tree.js';
import {
  expectInteractiveState,
  interactiveStateApplies,
} from './support/interactive-accessibility.js';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

async function ready(page: Page, route = '/component-lab/') {
  await openReadyDocument(page, route);
}

const semanticTest = { tag: ['@aria-tree', '@accessibility'] };

interface FeatureGraphManifest {
  features: Array<{ chunk: string; id: string }>;
}

interface SiteManifest {
  navigation: { featureGraph: { assetManifest: string } };
}

async function featureChunk(page: Page, featureId: string): Promise<string> {
  const siteResponse = await page.request.get('/site-manifest.json');
  expect(siteResponse.ok()).toBeTruthy();
  const site = await siteResponse.json() as SiteManifest;
  await siteResponse.dispose();
  const graphResponse = await page.request.get(site.navigation.featureGraph.assetManifest);
  expect(graphResponse.ok()).toBeTruthy();
  const graph = await graphResponse.json() as FeatureGraphManifest;
  await graphResponse.dispose();
  const chunk = graph.features.find(feature => feature.id === featureId)?.chunk;
  if (!chunk) throw new TypeError(`Missing feature chunk for ${featureId}.`);
  return chunk;
}

async function installClipboardMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const runtime = window as Window & {
      __pinegaClipboardShouldFail?: boolean;
      __pinegaClipboardValue?: string;
    };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          if (runtime.__pinegaClipboardShouldFail) throw new DOMException('Test clipboard failure.', 'NotAllowedError');
          runtime.__pinegaClipboardValue = value;
        },
      },
    });
  });
}

test('renders durable semantic landmarks and all five foundation compositions', async ({ page }, testInfo) => {
  await ready(page);
  const navigation = page.locator('nav[data-primary-navigation]');
  await expect(navigation).toHaveAttribute('aria-label', 'Primary navigation');
  if (testInfo.project.use.isMobile) await expect(navigation).toBeHidden();
  else await expect(navigation).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Systems research');
  await expect(page.getByRole('link', { name: 'Explore the foundation' })).toHaveAttribute('href', '#foundation');
  await expect(page.locator('pinega-site-header')).toHaveCount(1);
  await expect(page.locator('pinega-hero')).toHaveCount(1);
  await expect(page.locator('pinega-evidence')).toHaveCount(5);
  await expect(page.locator('pinega-code-example')).toHaveCount(1);
  await expect(page.locator('pinega-benchmark')).toHaveCount(1);
  await expect(page.locator('pinega-benchmark table')).toBeAttached();
});

test('has no horizontal overflow at the active viewport', async ({ page }) => {
  await ready(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('desktop header exposes stable navigation semantics', semanticTest, async ({ page }, testInfo) => {
  test.skip(!interactiveStateApplies('HEADER-DESKTOP-NAVIGATION', testInfo), 'Desktop header baseline is shared by desktop engines.');
  await page.addInitScript(() => localStorage.setItem('pinega-color-scheme', 'light'));
  await ready(page, '/');
  const navigation = page.locator('nav[data-primary-navigation]');
  await expect(navigation).toBeVisible();
  await expect(navigation.locator('a')).toHaveCount(5);
  const navigationId = await navigation.getAttribute('id');
  expect(navigationId).toBeTruthy();
  await expect(page.locator('[data-navigation-toggle]')).toHaveAttribute('aria-controls', navigationId as string);
  await expectInteractiveState(page, 'HEADER-DESKTOP-NAVIGATION', testInfo);
});

test('mobile navigation exposes closed, open, Escape, and enhanced-commit states', semanticTest, async ({ page }, testInfo) => {
  test.skip(!interactiveStateApplies('HEADER-MOBILE-CLOSED', testInfo), 'Mobile disclosure behavior is exercised in Chromium mobile.');
  await page.addInitScript(() => localStorage.setItem('pinega-color-scheme', 'light'));
  await ready(page, '/');
  const toggle = page.locator('[data-navigation-toggle]');
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(toggle).toBeVisible();
  await expect(navigation).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expectInteractiveState(page, 'HEADER-MOBILE-CLOSED', testInfo);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation).toBeVisible();
  await expectInteractiveState(page, 'HEADER-MOBILE-OPEN', testInfo);

  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(navigation).toBeHidden();
  await expect(toggle).toBeFocused();
  await expectInteractiveState(page, 'HEADER-MOBILE-ESCAPE', testInfo);

  await toggle.click();
  await navigation.getByRole('link', { name: 'Research' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'research');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(navigation).toBeHidden();
  await expectInteractiveState(page, 'HEADER-MOBILE-COMMIT', testInfo);
});

test('keyboard navigation is trap-free from the shell into main content', async ({ page }) => {
  await ready(page);
  let reachedMain = false;
  let previous = '';
  for (let index = 0; index < 30; index += 1) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      const candidates = [...document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')];
      return {
        identity: active ? `${active.localName}:${candidates.indexOf(active)}` : '',
        insideMain: Boolean(active?.closest('main')),
      };
    });
    expect(focus.identity, `focus stopped advancing after ${index + 1} Tab presses`).not.toBe(previous);
    previous = focus.identity;
    if (focus.insideMain) {
      reachedMain = true;
      break;
    }
  }
  expect(reachedMain, 'keyboard focus never escaped the persistent shell').toBe(true);
  const beforeReverse = previous;
  await page.keyboard.press('Shift+Tab');
  const afterReverse = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    const candidates = [...document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')];
    return active ? `${active.localName}:${candidates.indexOf(active)}` : '';
  });
  expect(afterReverse, 'reverse keyboard traversal is trapped').not.toBe(beforeReverse);
});

test('theme control exposes localized light and dark semantic states', semanticTest, async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('pinega-color-scheme', 'light'));

  await ready(page, '/');
  let toggle = page.locator('[data-theme-toggle]');
  await expect(page.locator('html')).toHaveClass(/pinega-light/u);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expectInteractiveState(page, 'THEME-EN-LIGHT', testInfo);
  await toggle.click();
  await expect(page.locator('html')).toHaveClass(/pinega-dark/u);
  await expect(page.locator('html')).toHaveClass(/wa-dark/u);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expectInteractiveState(page, 'THEME-EN-DARK', testInfo);

  await ready(page, '/ru/');
  toggle = page.locator('[data-theme-toggle]');
  await expect(page.locator('html')).toHaveClass(/pinega-light/u);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expectInteractiveState(page, 'THEME-RU-LIGHT', testInfo);
  await toggle.click();
  await expect(page.locator('html')).toHaveClass(/pinega-dark/u);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expectInteractiveState(page, 'THEME-RU-DARK', testInfo);
});

test('evidence semantics are explicit and not encoded by colour alone', async ({ page }) => {
  await ready(page);
  const expected = ['Confirmed', 'Inferred', 'Hypothesis', 'External evidence', 'Contradicted'];
  const labels = await page.locator('pinega-evidence [data-evidence-label]').allTextContents();
  expect(labels).toEqual(expected);
  for (const evidence of await page.locator('pinega-evidence').all()) await expect(evidence).toHaveAttribute('role', 'note');
});

test('benchmark retains native SVG and semantic table when Pro is unavailable', semanticTest, async ({ page }, testInfo) => {
  await ready(page);
  const benchmark = page.locator('pinega-benchmark');
  await expect(benchmark).toHaveAttribute('data-renderer', 'svg-fallback');
  const chart = benchmark.locator('svg[data-chart-fallback]');
  await expect(chart).toBeVisible();
  await expect(chart).toHaveAttribute('aria-labelledby', /pinega-benchmark-chart-\d+-title pinega-benchmark-chart-\d+-description/u);
  await expect(benchmark.locator('table')).toBeAttached();
  await expectInteractiveState(page, 'BENCHMARK-FALLBACK', testInfo);

  await benchmark.locator('details > summary').click();
  await expect(benchmark.locator('table')).toBeVisible();
  await expectInteractiveState(page, 'BENCHMARK-FALLBACK-TABLE-OPEN', testInfo);
});

test('benchmark progressively upgrades when the licensed Pro element registers', semanticTest, async ({ page }, testInfo) => {
  await ready(page);
  const benchmark = page.locator('pinega-benchmark');
  const source = benchmark.locator('details');
  await source.locator('summary').click();
  const tableBefore = await captureSemanticTree(benchmark.locator('table'));
  await source.locator('summary').click();
  await page.evaluate(() => {
    if (!customElements.get('wa-line-chart')) {
      customElements.define('wa-line-chart', class extends HTMLElement {
        static observedAttributes = ['label'];
        config: unknown;

        connectedCallback(): void {
          this.setAttribute('role', 'img');
          this.#syncLabel();
        }

        attributeChangedCallback(): void {
          this.#syncLabel();
        }

        #syncLabel(): void {
          const label = this.getAttribute('label');
          if (label) this.setAttribute('aria-label', label);
        }
      });
    }
    window.dispatchEvent(new CustomEvent('pinega:webawesome-pro-ready'));
  });
  await expect(benchmark).toHaveAttribute('data-renderer', 'webawesome-pro');
  await expect(benchmark.locator('wa-line-chart')).toHaveAttribute('label', 'Throughput by worker count');
  const config = await benchmark.locator('wa-line-chart').evaluate((element: HTMLElement & { config?: unknown }) => element.config);
  expect(config).toMatchObject({ data: { labels: ['1', '2', '4', '8', '16', '32'] } });
  await expect(benchmark.locator('table')).toBeAttached();
  await expectInteractiveState(page, 'BENCHMARK-PRO', testInfo);

  await source.locator('summary').click();
  await expect(benchmark.locator('table')).toBeVisible();
  const tableAfter = await captureSemanticTree(benchmark.locator('table'));
  await expectSemanticEquivalent(tableBefore, tableAfter, {
    attachmentStem: 'benchmark-pro-table-equivalence',
    message: 'The Pro renderer changed the canonical benchmark table semantics',
    testInfo,
  });
  await expectInteractiveState(page, 'BENCHMARK-PRO-TABLE-OPEN', testInfo);
});

test('native code copy exposes success, error, and reset semantics', semanticTest, async ({ page }, testInfo) => {
  await installClipboardMock(page);
  const codeChunk = await featureChunk(page, 'code-example');
  await page.route('**/component-lab/', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="en"><body>
      <pinega-code-example>
        <header><span>Nushell</span><button type="button" data-native-copy>Copy code</button><wa-copy-button></wa-copy-button></header>
        <pre tabindex="0"><code>^npm run test:aria</code></pre>
      </pinega-code-example>
      <script type="module" src="${codeChunk}"></script>
    </body></html>`,
  }));
  await page.goto('/component-lab/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => customElements.whenDefined('pinega-code-example'));
  const example = page.locator('pinega-code-example');
  const button = example.locator('[data-native-copy]');
  await expect(button).toBeVisible();
  const idle = await expectInteractiveState(page, 'CODE-COPY-NATIVE-IDLE', testInfo);
  if (idle === undefined) throw new TypeError('Native idle state did not produce a semantic reference.');

  await button.click();
  await expect(button).toHaveText('Code copied');
  await expectInteractiveState(page, 'CODE-COPY-NATIVE-SUCCESS', testInfo);
  expect(await page.evaluate(() => (window as Window & { __pinegaClipboardValue?: string }).__pinegaClipboardValue)).toBe('^npm run test:aria');
  await expect(button).toHaveText('Copy code', { timeout: 2_000 });
  await expectInteractiveState(page, 'CODE-COPY-NATIVE-RESET', testInfo, { reference: idle });

  await page.evaluate(() => { (window as Window & { __pinegaClipboardShouldFail?: boolean }).__pinegaClipboardShouldFail = true; });
  await button.click();
  await expect(button).toHaveText('Copy failed');
  await expectInteractiveState(page, 'CODE-COPY-NATIVE-ERROR', testInfo);
  await expect(button).toHaveText('Copy code', { timeout: 2_000 });
});

test('Web Awesome code copy exposes success, error, and reset semantics', semanticTest, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installClipboardMock(page);
  await ready(page);
  const example = page.locator('pinega-code-example');
  const copy = example.locator('wa-copy-button');
  await expect(example).toHaveAttribute('data-copy-renderer', 'webawesome');
  await copy.evaluate((element: HTMLElement & { feedbackDuration?: number }) => { element.feedbackDuration = 2_000; });
  await expect(copy).toHaveAttribute('from', /pinega-code-\d+/u);
  await expect(copy).toHaveAttribute('copy-label', 'Copy code');
  await expect(copy).toHaveAttribute('success-label', 'Code copied');
  await expect(copy).toHaveAttribute('error-label', 'Copy failed');
  await copy.evaluate(element => {
    element.dataset.testWaCopyCount = '0';
    element.dataset.testWaErrorCount = '0';
    element.addEventListener('wa-copy', event => {
      element.dataset.testWaCopyCount = String(Number(element.dataset.testWaCopyCount) + 1);
      element.dataset.testWaCopyValue = (event as CustomEvent<{ value?: string }>).detail?.value ?? '';
    });
    element.addEventListener('wa-error', () => {
      element.dataset.testWaErrorCount = String(Number(element.dataset.testWaErrorCount) + 1);
    });
  });
  const button = copy.locator('button[part="button"]');
  await expect(button).toHaveAttribute('aria-label', 'Copy code');
  const idle = await expectInteractiveState(page, 'CODE-COPY-WEBAWESOME-IDLE', testInfo);
  if (idle === undefined) throw new TypeError('Web Awesome idle state did not produce a semantic reference.');

  await button.click();
  await expect.poll(() => copy.evaluate((element: HTMLElement & { status?: string }) => element.status)).toBe('success');
  await expect(button).toHaveAttribute('aria-label', 'Code copied');
  await expect(copy).toHaveAttribute('data-test-wa-copy-count', '1');
  await expect(copy).toHaveAttribute('data-test-wa-copy-value', /^fn pin_candidate/u);
  await expect(page.locator('[role="log"][aria-live="polite"]')).toContainText('Code copied');
  await expectInteractiveState(page, 'CODE-COPY-WEBAWESOME-SUCCESS', testInfo);
  await expect.poll(() => copy.evaluate((element: HTMLElement & { status?: string }) => element.status), { timeout: 3_000 }).toBe('rest');
  await expect(button).toHaveAttribute('aria-label', 'Copy code');
  await expectInteractiveState(page, 'CODE-COPY-WEBAWESOME-RESET', testInfo, { reference: idle });

  await page.evaluate(() => { (window as Window & { __pinegaClipboardShouldFail?: boolean }).__pinegaClipboardShouldFail = true; });
  await button.click();
  await expect.poll(() => copy.evaluate((element: HTMLElement & { status?: string }) => element.status)).toBe('error');
  await expect(button).toHaveAttribute('aria-label', 'Copy failed');
  await expect(copy).toHaveAttribute('data-test-wa-error-count', '1');
  await expect(page.locator('[role="log"][aria-live="polite"]')).toContainText('Copy failed');
  await expectInteractiveState(page, 'CODE-COPY-WEBAWESOME-ERROR', testInfo);
  await expect.poll(() => copy.evaluate((element: HTMLElement & { status?: string }) => element.status), { timeout: 3_000 }).toBe('rest');
  await expect(button).toHaveAttribute('aria-label', 'Copy code');
  await expectInteractiveState(page, 'CODE-COPY-WEBAWESOME-RESET', testInfo, { reference: idle });
});

test('passes WCAG A and AA automated accessibility checks without serious or critical violations', async ({ page }) => {
  await ready(page);
  await page.addScriptTag({ path: axePath });
  const results = await page.evaluate(async () => {
    const axe = (window as unknown as Window & { axe: { run: (context: Document, options: unknown) => Promise<{ violations: Array<{ impact: string | null; id: string }> }> } }).axe;
    return axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      resultTypes: ['violations'],
    });
  });
  const blocking = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking, blocking.map(violation => violation.id).join(', ')).toEqual([]);
});
