import { defineConfig, devices } from '@playwright/test';

import { releaseReporters } from './playwright.reporters.js';

const chromiumExecutablePath = process.env.PINEGA_PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const chromiumLaunch = chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {};

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  ...(process.env.CI ? { workers: 1, timeout: 45_000 } : { timeout: 30_000 }),
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: releaseReporters(),
  outputDir: 'test-results',
  expect: {
    timeout: 5_000,
    toMatchAriaSnapshot: {
      children: 'deep-equal',
      pathTemplate: 'tests/accessibility/snapshots/{testFilePath}/{arg}{ext}',
    },
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.015,
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run serve',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], ...chromiumLaunch, viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'], ...chromiumLaunch },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 1000 } },
    },
  ],
});
