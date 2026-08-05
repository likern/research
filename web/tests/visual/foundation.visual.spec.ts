import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/component-lab/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
});

test('hero and header visual contract', async ({ page }) => {
  await expect(page.locator('pinega-site-header')).toHaveScreenshot('site-header.png');
  await expect(page.locator('pinega-hero')).toHaveScreenshot('hero.png');
});

test('domain components visual contract', async ({ page }) => {
  await expect(page.locator('#evidence')).toHaveScreenshot('evidence-system.png');
  await expect(page.locator('pinega-code-example')).toHaveScreenshot('code-example.png');
  await expect(page.locator('pinega-benchmark')).toHaveScreenshot('benchmark-fallback.png');
});

test('dark mode remains coherent', async ({ page }) => {
  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveClass(/pinega-dark/u);
  await expect(page.locator('#evidence')).toHaveScreenshot('evidence-dark.png');
});
