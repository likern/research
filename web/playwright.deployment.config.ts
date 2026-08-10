import { defineConfig, devices } from '@playwright/test';

import { releaseReporters } from './playwright.reporters.js';

const baseURL = process.env.PINEGA_PREVIEW_URL;
if (!baseURL) throw new TypeError('PINEGA_PREVIEW_URL is required for deployment smoke tests');

export default defineConfig({
  testDir: 'tests/deployment',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  forbidOnly: true,
  retries: 0,
  reporter: releaseReporters({ htmlOutputFolder: 'playwright-report-deployment', includeHtml: true }),
  outputDir: 'test-results-deployment',
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{
    name: 'chromium-deployment',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
  }],
});
