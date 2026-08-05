import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

async function ready(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
}

test('renders durable semantic landmarks and all five foundation compositions', async ({ page }, testInfo) => {
  await ready(page);
  const navigation = page.locator('nav[data-primary-navigation]');
  await expect(navigation).toHaveAttribute('aria-label', 'Primary navigation');
  if (testInfo.project.use.isMobile) {
    await expect(navigation).toBeHidden();
  } else {
    await expect(navigation).toBeVisible();
  }
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

test('mobile navigation progressively enhances and closes with Escape', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.isMobile, 'Mobile behavior is exercised only in the mobile project.');
  await ready(page);
  const toggle = page.locator('[data-navigation-toggle]');
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(toggle).toBeVisible();
  await expect(navigation).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(navigation).toBeHidden();
});

test('theme switch changes Pinega and Web Awesome mode classes', async ({ page }) => {
  await ready(page);
  const toggle = page.locator('[data-theme-toggle]');
  const startedDark = await page.locator('html').evaluate(element => element.classList.contains('pinega-dark'));
  await toggle.click();
  await expect(page.locator('html')).toHaveClass(startedDark ? /pinega-light/u : /pinega-dark/u);
  await expect(page.locator('html')).toHaveClass(startedDark ? /wa-light/u : /wa-dark/u);
});

test('evidence semantics are explicit and not encoded by colour alone', async ({ page }) => {
  await ready(page);
  const expected = ['Confirmed', 'Inferred', 'Hypothesis', 'External evidence', 'Contradicted'];
  const labels = await page.locator('pinega-evidence [data-evidence-label]').allTextContents();
  expect(labels).toEqual(expected);
  for (const evidence of await page.locator('pinega-evidence').all()) {
    await expect(evidence).toHaveAttribute('role', 'note');
  }
});

test('benchmark retains native SVG and semantic table when Pro is unavailable', async ({ page }) => {
  await ready(page);
  const benchmark = page.locator('pinega-benchmark');
  await expect(benchmark).toHaveAttribute('data-renderer', 'svg-fallback');
  const chart = benchmark.locator('svg[data-chart-fallback]');
  await expect(chart).toBeVisible();
  await expect(chart).toHaveAttribute('aria-labelledby', /pinega-benchmark-chart-\d+-title pinega-benchmark-chart-\d+-description/u);
  await expect(benchmark.locator('table')).toBeAttached();
});

test('benchmark progressively upgrades when the licensed Pro element registers', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    if (!customElements.get('wa-line-chart')) {
      customElements.define('wa-line-chart', class extends HTMLElement {
        config: unknown;
      });
    }
    window.dispatchEvent(new CustomEvent('pinega:webawesome-pro-ready'));
  });
  const benchmark = page.locator('pinega-benchmark');
  await expect(benchmark).toHaveAttribute('data-renderer', 'webawesome-pro');
  await expect(benchmark.locator('wa-line-chart')).toHaveAttribute('label', 'Throughput by worker count');
  const config = await benchmark.locator('wa-line-chart').evaluate((element: HTMLElement & { config?: unknown }) => element.config);
  expect(config).toMatchObject({ data: { labels: ['1', '2', '4', '8', '16', '32'] } });
  await expect(benchmark.locator('table')).toBeAttached();
});

test('passes automated accessibility checks without serious or critical violations', async ({ page }) => {
  await ready(page);
  await page.addScriptTag({ path: axePath });
  const results = await page.evaluate(async () => {
    const axe = (window as unknown as Window & {
      axe: {
        run: (
          context: Document,
          options: unknown,
        ) => Promise<{
          violations: Array<{
            impact: string | null;
            id: string;
          }>;
        }>;
      };
    }).axe;
    return axe.run(document, { resultTypes: ['violations'] });
  });
  const blocking = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking, blocking.map(violation => violation.id).join(', ')).toEqual([]);
});
