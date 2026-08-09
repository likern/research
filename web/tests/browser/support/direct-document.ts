import { expect, type Page } from '@playwright/test';

const testOrigin = 'http://127.0.0.1:4173';

export async function openReadyDocument(page: Page, route: string, expectedStatus = 200): Promise<void> {
  const target = new URL(route, testOrigin).href;
  const probe = await page.request.head(target);
  expect(probe.status(), `${route} should return HTTP ${expectedStatus}`).toBe(expectedStatus);
  await probe.dispose();

  const controller = new AbortController();
  let navigationFailure: unknown;
  const navigation = page.goto(target, {
    signal: controller.signal,
    timeout: 0,
    waitUntil: 'commit',
  }).catch(error => {
    navigationFailure = error;
    return null;
  });

  try {
    await expect.poll(async () => {
      if (navigationFailure) throw navigationFailure;
      try {
        return await page.evaluate(() => ({
          href: location.href,
          ready: document.documentElement.dataset.pinegaReady,
        }));
      } catch {
        return undefined;
      }
    }).toEqual({ href: target, ready: 'true' });
  } finally {
    controller.abort('Pinega application readiness observed');
    await navigation;
  }
}
