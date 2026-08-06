import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/research/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
});

test('version-chain semantic diagram', async ({ page }) => {
  await expect(page.locator('#pinega-figure-version-chain-snapshot')).toHaveScreenshot('semantic-version-chain.png');
});

test('buffer-frame lifecycle semantic diagram', async ({ page }) => {
  await expect(page.locator('#pinega-figure-buffer-frame-lifecycle')).toHaveScreenshot('semantic-buffer-lifecycle.png');
});

test('linearizability history semantic diagram', async ({ page }) => {
  await expect(page.locator('#pinega-figure-linearizability-overlap')).toHaveScreenshot('semantic-linearizability-history.png');
});
