import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, route: string) {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
}

test('homepage product narrative and architecture', async ({ page }) => {
  await open(page, '/');
  await expect(page.locator('pinega-hero')).toHaveScreenshot('home-hero.png');
  await expect(page.locator('#architecture')).toHaveScreenshot('home-architecture.png');
});

test('documentation landing and search map', async ({ page }) => {
  await open(page, '/docs/');
  await expect(page.locator('.pinega-doc-hero')).toHaveScreenshot('docs-hero.png');
  await expect(page.locator('pinega-doc-search')).toHaveScreenshot('docs-map.png');
});

test('getting-started article shell', async ({ page }) => {
  await open(page, '/docs/getting-started/');
  await expect(page.locator('.pinega-doc-shell')).toHaveScreenshot('getting-started.png');
});

test('research programme', async ({ page }) => {
  await open(page, '/research/');
  await expect(page.locator('.pinega-research-hero')).toHaveScreenshot('research-hero.png');
  await expect(page.locator('#concurrent-lifetimes')).toHaveScreenshot('research-lifetimes.png');
});

test('homepage dark mode remains coherent', async ({ page }) => {
  await open(page, '/');
  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveClass(/pinega-dark/u);
  await expect(page.locator('.pinega-home-status')).toHaveScreenshot('home-status-dark.png');
});
