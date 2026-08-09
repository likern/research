import { expect, test, type Page, type Request } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

interface TransitionResult {
  id: string;
  actionDurationMs: number;
  finalUrl: string;
  routeId: string;
  locale: string;
  requestTypes: string[];
  documentRequests: number;
  htmlFetchRequests: number;
  commitCount: number;
  timeOriginBefore: number;
  timeOriginAfter: number;
  navigationEntries: number;
  shellPreserved: boolean;
  mainFocused: boolean;
  announcement: string;
}

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const artifactPath = resolve(webRoot, 'artifacts/baseline/gate-4.2-transaction-baseline.json');

test('records the Gate 4.2 cold transactional-navigation structural baseline', async ({ page, browserName }) => {
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-pinega-navigation', 'enhanced');
  await page.locator('pinega-site-header').evaluate((header: HTMLElement) => {
    header.dataset.baselineShell = 'persistent';
  });
  await page.evaluate(() => {
    document.documentElement.dataset.baselineCommits = '0';
    window.addEventListener('pinega:navigation-commit', () => {
      const root = document.documentElement;
      root.dataset.baselineCommits = String(Number(root.dataset.baselineCommits ?? 0) + 1);
    });
  });

  const buildId = await page.locator('html').getAttribute('data-pinega-build');
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));
  const transitions: TransitionResult[] = [];

  transitions.push(await measureTransition(page, requests, {
    id: 'home-to-technology',
    pathname: '/technology/',
    run: async () => {
      await page.locator('[data-primary-navigation] a[href="/technology/"]').click();
      await expect(page).toHaveURL(/\/technology\/$/u);
      await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'technology');
    },
  }));
  transitions.push(await measureTransition(page, requests, {
    id: 'back-to-home',
    pathname: '/',
    run: async () => {
      await page.evaluate(() => history.back());
      await expect(page).toHaveURL(/127\.0\.0\.1:4173\/$/u);
      await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'home');
    },
  }));
  transitions.push(await measureTransition(page, requests, {
    id: 'english-to-russian-home',
    pathname: '/ru/',
    run: async () => {
      await page.locator('[data-pinega-language-switcher] a[href="/ru/"]').click();
      await expect(page).toHaveURL(/\/ru\/$/u);
      await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'home');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    },
  }));
  transitions.push(await measureTransition(page, requests, {
    id: 'back-to-english-home',
    pathname: '/',
    run: async () => {
      await page.evaluate(() => history.back());
      await expect(page).toHaveURL(/127\.0\.0\.1:4173\/$/u);
      await expect(page.locator('main')).toHaveAttribute('data-pinega-route', 'home');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    },
  }));

  for (const transition of transitions) {
    expect(transition.documentRequests, transition.id).toBe(0);
    expect(transition.htmlFetchRequests, transition.id).toBe(1);
    expect(transition.timeOriginAfter, transition.id).toBe(transition.timeOriginBefore);
    expect(transition.navigationEntries, transition.id).toBe(1);
    expect(transition.shellPreserved, transition.id).toBe(true);
  }
  expect(transitions.map(transition => transition.commitCount)).toEqual([1, 2, 3, 4]);
  expect(transitions.map(transition => transition.locale)).toEqual(['en', 'en', 'ru', 'en']);
  expect(transitions.filter(transition => ['home-to-technology', 'english-to-russian-home'].includes(transition.id)).every(transition => transition.mainFocused)).toBe(true);
  expect(buildId).toMatch(/^sha256-[a-f0-9]{64}$/u);

  const payload = {
    schemaVersion: 1,
    kind: 'pinega-gate-4.2-transaction-baseline',
    generatedAt: new Date().toISOString(),
    source: {
      repository: process.env.GITHUB_REPOSITORY ?? 'local-checkout',
      sourceSha: process.env.PINEGA_DEPLOYMENT_SOURCE_SHA || process.env.GITHUB_SHA || null,
      testedSha: process.env.PINEGA_DEPLOYMENT_TESTED_SHA || process.env.GITHUB_SHA || null,
    },
    profile: {
      name: process.env.PINEGA_BASELINE_PROFILE ?? 'local-uncontrolled',
      browserName,
      browserVersion: await page.context().browser()?.version(),
      viewport: page.viewportSize(),
    },
    policy: {
      numericBudgetsEnforced: false,
      cache: 'cold-route; no route cache exists in Gate 4.2',
      focus: 'push/replace focuses main; traversal leaves focus restoration to the history policy',
      scroll: 'Navigation API after-transition semantics: push/replace top or fragment, traversal entry restoration',
      note: 'Structural gate: each current transaction preserves the Document and site-header instance, issues one HTML fetch, and performs one visible route/locale commit.',
    },
    buildId,
    transitions,
  };
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
});

async function measureTransition(
  page: Page,
  requests: Request[],
  scenario: { id: string; pathname: string; run: () => Promise<void> },
): Promise<TransitionResult> {
  const requestStart = requests.length;
  const timeOriginBefore = await page.evaluate(() => performance.timeOrigin);
  const started = performance.now();
  await scenario.run();
  const actionDurationMs = performance.now() - started;
  const transitionRequests = requests.slice(requestStart).filter(request => new URL(request.url()).pathname === scenario.pathname);
  const state = await page.evaluate(() => ({
    routeId: document.querySelector<HTMLElement>('main')?.dataset.pinegaRoute ?? '',
    locale: document.documentElement.dataset.locale ?? '',
    commitCount: Number(document.documentElement.dataset.baselineCommits ?? 0),
    timeOriginAfter: performance.timeOrigin,
    navigationEntries: performance.getEntries().filter(entry => String(entry.entryType) === 'navigation').length,
    shellPreserved: document.querySelector<HTMLElement>('pinega-site-header')?.dataset.baselineShell === 'persistent',
    mainFocused: document.activeElement === document.querySelector('main'),
    announcement: document.querySelector('[data-pinega-navigation-announcer]')?.textContent ?? '',
  }));
  return {
    id: scenario.id,
    actionDurationMs,
    finalUrl: page.url(),
    routeId: state.routeId,
    locale: state.locale,
    requestTypes: transitionRequests.map(request => request.resourceType()),
    documentRequests: transitionRequests.filter(request => request.resourceType() === 'document').length,
    htmlFetchRequests: transitionRequests.filter(request => request.resourceType() === 'fetch').length,
    commitCount: state.commitCount,
    timeOriginBefore,
    timeOriginAfter: state.timeOriginAfter,
    navigationEntries: state.navigationEntries,
    shellPreserved: state.shellPreserved,
    mainFocused: state.mainFocused,
    announcement: state.announcement,
  };
}
