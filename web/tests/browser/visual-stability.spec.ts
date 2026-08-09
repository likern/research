import { expect, test, type Page, type TestInfo } from '@playwright/test';
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

const representativeRoutes = [
  { id: 'home-en', route: '/' },
  { id: 'home-ru', route: '/ru/' },
  { id: 'docs-en', route: '/docs/' },
  { id: 'component-lab', route: '/component-lab/' },
] as const;

interface RenderCycle {
  authored: PhaseCapture;
  shell: PhaseCapture;
  ready: PhaseCapture;
  shifts: UnexpectedShiftReport;
}

for (const representative of representativeRoutes) {
  test(`${representative.id} keeps declared static regions stable through first load and reload`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await installUnexpectedShiftProbe(page);
    const mainGate = await AssetGate.install(page, '**/assets/main.js');
    const webAwesomeGate = await AssetGate.install(page, /\/assets\/chunks\/core-[A-Z0-9]+\.js$/u);

    const initial = await observeRenderCycle(
      page,
      testInfo,
      representative.id,
      'initial',
      mainGate,
      webAwesomeGate,
      () => page.goto(representative.route, { waitUntil: 'commit' }),
    );
    assertStableCycle(initial);
    expect(initial.shifts.cls, JSON.stringify(initial.shifts.entries, null, 2)).toBeLessThanOrEqual(0.001);

    const reload = await observeRenderCycle(
      page,
      testInfo,
      representative.id,
      'reload',
      mainGate,
      webAwesomeGate,
      () => page.reload({ waitUntil: 'commit' }),
    );
    assertStableCycle(reload);
    expect(reload.shifts.cls, JSON.stringify(reload.shifts.entries, null, 2)).toBeLessThanOrEqual(0.001);
    expect(comparePhases(initial.ready, reload.authored)).toEqual([]);
    expect(comparePhases(initial.ready, reload.ready)).toEqual([]);
  });
}

test('stored dark theme is selected before CSS and the main module execute', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pinega-color-scheme', 'dark'));
  const mainGate = await AssetGate.install(page, '**/assets/main.js');
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
  navigate: () => Promise<unknown>,
): Promise<RenderCycle> {
  await navigate();
  await mainGate.waitForRequest();
  await waitForAuthoredRender(page);
  await expect(page.locator('html')).not.toHaveAttribute('data-pinega-ready', /.+/u);
  const authored = await capturePhase(page, `${cycle}-authored`);
  await attachPhase(testInfo, routeId, authored);

  await mainGate.release();
  await webAwesomeGate.waitForRequest();
  await waitForAuthoredRender(page);
  await expect(page.locator('html')).not.toHaveAttribute('data-pinega-ready', /.+/u);
  const shell = await capturePhase(page, `${cycle}-shell`);
  await attachPhase(testInfo, routeId, shell);

  await webAwesomeGate.release();
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
  await waitForAuthoredRender(page);
  const ready = await capturePhase(page, `${cycle}-ready`);
  await attachPhase(testInfo, routeId, ready);

  return { authored, shell, ready, shifts: await readUnexpectedShifts(page) };
}

function assertStableCycle(cycle: RenderCycle): void {
  expect(comparePhases(cycle.authored, cycle.shell)).toEqual([]);
  expect(comparePhases(cycle.authored, cycle.ready)).toEqual([]);
}
