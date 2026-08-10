import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { registeredTransitionsFor, temporalRoutes } from './support/accessibility-contract.js';
import {
  captureSemanticTree,
  expectSemanticEquivalent,
} from './support/accessibility-tree.js';
import {
  AssetGate,
  attachPhase,
  capturePhase,
  comparePhases,
  installUnexpectedShiftProbe,
  readUnexpectedShifts,
  waitForAuthoredRender,
  type PhaseCapture,
  type UnexpectedShiftReport,
} from './support/visual-stability.js';

const semanticTransitions = registeredTransitionsFor('temporal');

interface RenderPhase {
  semantic: string;
  visual: PhaseCapture;
}

interface RenderCycle {
  authored: RenderPhase;
  shell: RenderPhase;
  ready: RenderPhase;
  shifts: UnexpectedShiftReport;
}

test.describe('Temporal accessibility-tree equivalence', {
  tag: ['@aria-tree', '@accessibility'],
}, () => {
  for (const representative of temporalRoutes) {
    test(`${representative.id} keeps declared static regions and semantic projection stable through first load and reload`, async ({ page, browserName }, testInfo) => {
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
      await installUnexpectedShiftProbe(page);
      const mainGate = await AssetGate.install(page, '**/assets/main-*.js');
      const webAwesomeGate = await AssetGate.install(page, /\/assets\/chunks\/core-[A-Z0-9]+\.js$/u);

      const initial = await observeRenderCycle(
        page,
        testInfo,
        representative.id,
        'initial',
        mainGate,
        webAwesomeGate,
        browserName === 'chromium',
        () => page.goto(representative.route, { waitUntil: 'commit' }),
      );
      await assertStableCycle(initial, representative.id, testInfo);
      expect(initial.shifts.cls, JSON.stringify(initial.shifts.entries, null, 2)).toBeLessThanOrEqual(0.001);

      const reload = await observeRenderCycle(
        page,
        testInfo,
        representative.id,
        'reload',
        mainGate,
        webAwesomeGate,
        browserName === 'chromium',
        () => page.reload({ waitUntil: 'commit' }),
      );
      await assertStableCycle(reload, representative.id, testInfo);
      expect(reload.shifts.cls, JSON.stringify(reload.shifts.entries, null, 2)).toBeLessThanOrEqual(0.001);
      expect(comparePhases(initial.ready.visual, reload.authored.visual)).toEqual([]);
      expect(comparePhases(initial.ready.visual, reload.ready.visual)).toEqual([]);
      await expectSemanticEquivalent(initial.ready.semantic, reload.authored.semantic, {
        attachmentStem: `${representative.id}-reload-authored-semantic`,
        message: `${representative.id}: reload authored semantics differ from the initial ready document`,
        testInfo,
      });
      await expectSemanticEquivalent(initial.ready.semantic, reload.ready.semantic, {
        attachmentStem: `${representative.id}-reload-ready-semantic`,
        message: `${representative.id}: reload ready semantics differ from the initial ready document`,
        testInfo,
      });
    });
  }
});

test('stored dark theme is selected before CSS and the main module execute', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pinega-color-scheme', 'dark'));
  const mainGate = await AssetGate.install(page, '**/assets/main-*.js');
  const webAwesomeGate = await AssetGate.install(page, /\/assets\/chunks\/core-[A-Z0-9]+\.js$/u);

  await page.goto('/', { waitUntil: 'commit' });
  await mainGate.waitForRequest();
  await waitForAuthoredRender(page);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-js', 'true');
  await expect(page.locator('html')).toHaveClass(/pinega-dark/u);
  await expect(page.locator('[data-theme-toggle]')).toBeVisible();
  await expect(page.locator('[data-theme-label-when="light"]')).toBeHidden();
  await expect(page.locator('[data-theme-label-when="dark"]')).toBeVisible();

  await mainGate.release();
  await webAwesomeGate.waitForRequest();
  await webAwesomeGate.release();
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('aria-label', 'Use light theme');
});

async function observeRenderCycle(
  page: Page,
  testInfo: TestInfo,
  routeId: string,
  cycle: string,
  mainGate: AssetGate,
  webAwesomeGate: AssetGate,
  captureScreenshots: boolean,
  navigate: () => Promise<unknown>,
): Promise<RenderCycle> {
  await navigate();
  await mainGate.waitForRequest();
  await waitForAuthoredRender(page);
  await expect(page.locator('html')).not.toHaveAttribute('data-pinega-ready', /.+/u);
  const authored = await captureRenderPhase(page, `${cycle}-authored`, captureScreenshots);
  await attachPhase(testInfo, routeId, authored.visual);

  await mainGate.release();
  await webAwesomeGate.waitForRequest();
  await waitForAuthoredRender(page);
  await expect(page.locator('html')).not.toHaveAttribute('data-pinega-ready', /.+/u);
  const shell = await captureRenderPhase(page, `${cycle}-shell`, captureScreenshots);
  await attachPhase(testInfo, routeId, shell.visual);

  await webAwesomeGate.release();
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await waitForAuthoredRender(page);
  const ready = await captureRenderPhase(page, `${cycle}-ready`, captureScreenshots);
  await attachPhase(testInfo, routeId, ready.visual);

  return { authored, shell, ready, shifts: await readUnexpectedShifts(page) };
}

async function captureRenderPhase(page: Page, phase: string, captureScreenshots: boolean): Promise<RenderPhase> {
  const visual = await capturePhase(page, phase, captureScreenshots);
  const semantic = await captureSemanticTree(page.locator('body'), {
    registeredTransitions: semanticTransitions,
  });
  return { semantic, visual };
}

async function assertStableCycle(cycle: RenderCycle, routeId: string, testInfo: TestInfo): Promise<void> {
  expect(comparePhases(cycle.authored.visual, cycle.shell.visual)).toEqual([]);
  expect(comparePhases(cycle.authored.visual, cycle.ready.visual)).toEqual([]);
  await expectSemanticEquivalent(cycle.authored.semantic, cycle.shell.semantic, {
    attachmentStem: `${routeId}-${cycle.shell.visual.phase}-semantic`,
    message: `${routeId}: shell upgrade changed semantics outside registered transitions`,
    testInfo,
  });
  await expectSemanticEquivalent(cycle.authored.semantic, cycle.ready.semantic, {
    attachmentStem: `${routeId}-${cycle.ready.visual.phase}-semantic`,
    message: `${routeId}: ready upgrade changed semantics outside registered transitions`,
    testInfo,
  });
}
