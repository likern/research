import { errors, expect, type Page, type Response } from '@playwright/test';

const testOrigin = 'http://127.0.0.1:4173';
const navigationCommitTimeoutMs = 5_000;

interface ReadyDocumentState {
  href: string;
  ready: string | undefined;
  readyState: DocumentReadyState;
}

export async function openReadyDocument(page: Page, route: string, expectedStatus = 200): Promise<void> {
  const target = new URL(route, testOrigin).href;
  let response: Response | null;
  let recoveredFirefoxNavigation = false;

  try {
    response = await page.goto(target, {
      timeout: navigationCommitTimeoutMs,
      waitUntil: 'commit',
    });
  } catch (error) {
    if (!await canRecoverFirefoxNavigation(page, target, error)) throw error;
    recoveredFirefoxNavigation = true;

    // Playwright #42183 can leave Firefox's driver-side navigation bookkeeping
    // pending after the new document is already complete. A same-URL navigation
    // is the upstream reporter's measured recovery; the proof above prevents it
    // from masking a slow, incomplete, or wrong document.
    response = await page.goto(target, {
      timeout: navigationCommitTimeoutMs,
      waitUntil: 'commit',
    });
  }

  expect(response, `${route} should return a main-resource response`).not.toBeNull();
  const acceptedStatuses = recoveredFirefoxNavigation && expectedStatus === 200
    ? [200, 304]
    : [expectedStatus];
  expect(
    acceptedStatuses,
    `${route} should return HTTP ${acceptedStatuses.join(' or ')}`,
  ).toContain(response?.status());

  await expect.poll(() => readReadyDocumentState(page)).toEqual({
    href: target,
    ready: 'true',
    readyState: 'complete',
  });
}

async function canRecoverFirefoxNavigation(page: Page, target: string, error: unknown): Promise<boolean> {
  if (!(error instanceof errors.TimeoutError)) return false;
  if (page.context().browser()?.browserType().name() !== 'firefox') return false;

  const state = await readReadyDocumentState(page);
  return state?.href === target && state.ready === 'true' && state.readyState === 'complete';
}

async function readReadyDocumentState(page: Page): Promise<ReadyDocumentState | undefined> {
  try {
    return await page.evaluate(() => ({
      href: location.href,
      ready: document.documentElement.dataset.pinegaReady,
      readyState: document.readyState,
    }));
  } catch {
    return undefined;
  }
}
