import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, route: string) {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
}

test('homepage master-brand narrative and programme catalogue', async ({ page }) => {
  await open(page, '/');
  await expect(page.locator('pinega-hero')).toHaveScreenshot('home-master-brand-hero.png');
  await expect(page.locator('#programmes')).toHaveScreenshot('home-programmes.png');
  await expect(page.locator('#pinega-engine')).toHaveScreenshot('home-engine.png');
});

test('technology catalogue and Pinega Engine boundary', async ({ page }) => {
  await open(page, '/technology/');
  await expect(page.locator('.pinega-research-hero')).toHaveScreenshot('technology-hero.png');
  await expect(page.locator('#engine-architecture')).toHaveScreenshot('technology-engine-architecture.png');
});

test('documentation landing and topic filter', async ({ page }) => {
  await open(page, '/docs/');
  await expect(page.locator('.pinega-doc-hero')).toHaveScreenshot('docs-hero.png');
  await expect(page.locator('pinega-doc-search')).toHaveScreenshot('docs-topics.png');
});

test('getting-started article shell', async ({ page }) => {
  await open(page, '/docs/getting-started/');
  await expect(page.locator('.pinega-doc-shell')).toHaveScreenshot('getting-started.png');
});

test('research catalogue and active studies', async ({ page }) => {
  await open(page, '/research/');
  await expect(page.locator('.pinega-research-hero')).toHaveScreenshot('research-hero.png');
  await expect(page.locator('#research-areas')).toHaveScreenshot('research-areas.png');
  await expect(page.locator('#concurrent-lifetimes')).toHaveScreenshot('research-lifetimes.png');
});

test('about and company-boundary narrative', async ({ page }) => {
  await open(page, '/about/');
  await expect(page.locator('.pinega-research-hero')).toHaveScreenshot('about-hero.png');
  await expect(page.locator('.pinega-section-contrast')).toHaveScreenshot('about-principles.png');
});

test('homepage dark mode remains coherent', async ({ page }) => {
  await open(page, '/');
  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveClass(/pinega-dark/u);
  await expect(page.locator('.pinega-home-status')).toHaveScreenshot('home-status-dark.png');
});
