import { expect, type Page } from '@playwright/test';

const testOrigin = 'http://127.0.0.1:4173';

export async function openReadyDocument(page: Page, route: string, expectedStatus = 200): Promise<void> {
  const target = new URL(route, testOrigin).href;
  const probe = await page.request.head(target);
  expect(probe.status(), `${route} should return HTTP ${expectedStatus}`).toBe(expectedStatus);
  await probe.dispose();

  await page.evaluate(targetUrl => {
    const link = document.createElement('a');
    link.href = targetUrl;
    link.target = '_self';
    link.dataset.pinegaDirectDocument = 'true';
    link.setAttribute('aria-hidden', 'true');
    link.tabIndex = -1;
    link.style.cssText = 'position:fixed;left:0;top:0;display:block;width:1px;height:1px;overflow:hidden';
    document.body.append(link);
  }, target);
  await page.locator('a[data-pinega-direct-document="true"]').click({
    force: true,
    noWaitAfter: true,
  });

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
