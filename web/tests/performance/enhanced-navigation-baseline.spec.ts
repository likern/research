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
  requestTypes: string[];
  documentRequests: number;
  htmlFetchRequests: number;
  commitCount: number;
  timeOriginBefore: number;
  timeOriginAfter: number;
  navigationEntries: number;
  shellPreserved: boolean;
}

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const artifactPath = resolve(webRoot, 'artifacts/baseline/gate-4.1-navigation-baseline.json');

test('records the Gate 4.1 cold same-document structural baseline', async ({ page, browserName }) => {
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

  for (const transition of transitions) {
    expect(transition.documentRequests, transition.id).toBe(0);
    expect(transition.htmlFetchRequests, transition.id).toBe(1);
    expect(transition.timeOriginAfter, transition.id).toBe(transition.timeOriginBefore);
    expect(transition.navigationEntries, transition.id).toBe(1);
    expect(transition.shellPreserved, transition.id).toBe(true);
  }
  expect(transitions.map(transition => transition.commitCount)).toEqual([1, 2]);
  expect(buildId).toMatch(/^sha256-[a-f0-9]{64}$/u);

  const payload = {
    schemaVersion: 1,
    kind: 'pinega-gate-4.1-navigation-baseline',
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
      cache: 'cold-route; no route cache exists in Gate 4.1',
      note: 'Structural gate: each transition must preserve the Document and shell, issue one HTML fetch, and perform one visible commit.',
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
    commitCount: Number(document.documentElement.dataset.baselineCommits ?? 0),
    timeOriginAfter: performance.timeOrigin,
    navigationEntries: performance.getEntries().filter(entry => String(entry.entryType) === 'navigation').length,
    shellPreserved: document.querySelector<HTMLElement>('pinega-site-header')?.dataset.baselineShell === 'persistent',
  }));
  return {
    id: scenario.id,
    actionDurationMs,
    finalUrl: page.url(),
    routeId: state.routeId,
    requestTypes: transitionRequests.map(request => request.resourceType()),
    documentRequests: transitionRequests.filter(request => request.resourceType() === 'document').length,
    htmlFetchRequests: transitionRequests.filter(request => request.resourceType() === 'fetch').length,
    commitCount: state.commitCount,
    timeOriginBefore,
    timeOriginAfter: state.timeOriginAfter,
    navigationEntries: state.navigationEntries,
    shellPreserved: state.shellPreserved,
  };
}
