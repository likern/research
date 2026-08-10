import { expect, type Page } from '@playwright/test';

const testOrigin = 'http://127.0.0.1:4173';

export async function openReadyDocument(page: Page, route: string, expectedStatus = 200): Promise<void> {
  const target = new URL(route, testOrigin).href;
  const response = await page.goto(target, { waitUntil: 'commit' });
  expect(response, `${route} should return a main-resource response`).not.toBeNull();
  expect(response?.status(), `${route} should return HTTP ${expectedStatus}`).toBe(expectedStatus);

  await expect.poll(async () => {
    try {
      return await page.evaluate(() => ({
        href: location.href,
        ready: document.documentElement.dataset.pinegaReady,
      }));
    } catch {
      return undefined;
    }
  }).toEqual({ href: target, ready: 'true' });
}
