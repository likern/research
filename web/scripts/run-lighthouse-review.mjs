import { chromium } from '@playwright/test';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { startPinegaServer } from './serve.mjs';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(webRoot, process.env.PINEGA_RELEASE_REVIEW_ROOT ?? 'artifacts/release-review');
const lighthouseRoot = resolve(outputRoot, 'lighthouse');
const releaseManifest = JSON.parse(await readFile(resolve(webRoot, 'dist/.well-known/pinega-release.json'), 'utf8'));

await mkdir(lighthouseRoot, { recursive: true });
const server = await startPinegaServer({ root: resolve(webRoot, 'dist'), port: 0, log: false });
const observations = [];

try {
  for (const profile of [
    { id: 'desktop', formFactor: 'desktop', screenEmulation: { mobile: false, width: 1440, height: 1000, deviceScaleFactor: 1, disabled: false } },
    { id: 'mobile', formFactor: 'mobile', screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3, disabled: false } },
  ]) {
    const chrome = await launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    });
    try {
      for (const cycle of ['cold', 'warm']) {
        const result = await lighthouse(`${server.url}/`, {
          port: chrome.port,
          logLevel: 'info',
          output: ['json', 'html'],
          onlyCategories: ['performance'],
          ...(profile.id === 'desktop' ? { preset: 'desktop' } : {}),
          formFactor: profile.formFactor,
          screenEmulation: profile.screenEmulation,
          disableStorageReset: cycle === 'warm',
        });
        if (!result) throw new Error(`Lighthouse returned no ${profile.id}/${cycle} result`);
        const reports = Array.isArray(result.report) ? result.report : [result.report];
        const [jsonReport, htmlReport] = reports;
        if (typeof jsonReport !== 'string' || typeof htmlReport !== 'string') {
          throw new TypeError(`Lighthouse did not produce JSON and HTML for ${profile.id}/${cycle}`);
        }
        await Promise.all([
          writeFile(resolve(lighthouseRoot, `${profile.id}-${cycle}.json`), jsonReport, 'utf8'),
          writeFile(resolve(lighthouseRoot, `${profile.id}-${cycle}.html`), htmlReport, 'utf8'),
        ]);
        observations.push(readObservation(result.lhr, profile.id, cycle));
      }
    } finally {
      await chrome.kill();
    }
  }
} finally {
  await server.close();
}

const summary = {
  schemaVersion: 1,
  kind: 'pinega-gate-4.7-performance-review',
  generatedAt: new Date().toISOString(),
  buildId: releaseManifest.buildId,
  inventorySha256: releaseManifest.inventory.sha256,
  policy: {
    profiles: ['desktop', 'mobile'],
    cycles: ['cold', 'warm'],
    numericBudgetsEnforced: false,
    interpretation: 'Lighthouse is diagnostic lab evidence; build budgets and functional release gates remain independently enforced.',
  },
  observations,
};
await writeFile(resolve(outputRoot, 'performance.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(`Recorded ${observations.length} cold/warm Lighthouse observations for ${releaseManifest.buildId}.`);

function readObservation(lhr, profile, cycle) {
  const metricIds = {
    firstContentfulPaintMs: 'first-contentful-paint',
    largestContentfulPaintMs: 'largest-contentful-paint',
    cumulativeLayoutShift: 'cumulative-layout-shift',
    speedIndexMs: 'speed-index',
    totalBlockingTimeMs: 'total-blocking-time',
  };
  const metrics = {};
  for (const [name, auditId] of Object.entries(metricIds)) {
    const value = lhr.audits[auditId]?.numericValue;
    if (!Number.isFinite(value) || value < 0) throw new TypeError(`Invalid Lighthouse ${auditId} for ${profile}/${cycle}`);
    metrics[name] = value;
  }
  return {
    profile,
    cycle,
    requestedUrl: lhr.requestedUrl,
    finalUrl: lhr.finalUrl,
    lighthouseVersion: lhr.lighthouseVersion,
    userAgent: lhr.userAgent,
    fetchTime: lhr.fetchTime,
    performanceScore: lhr.categories.performance.score,
    settings: {
      formFactor: lhr.configSettings.formFactor,
      throttlingMethod: lhr.configSettings.throttlingMethod,
      throttling: lhr.configSettings.throttling,
      screenEmulation: lhr.configSettings.screenEmulation,
    },
    metrics,
  };
}
