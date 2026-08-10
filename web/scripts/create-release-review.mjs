import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { verifyReleaseManifest } from './lib/release-contract.mjs';

const root = resolve(import.meta.dirname, '..');
const outputRoot = resolve(root, process.env.PINEGA_RELEASE_REVIEW_ROOT ?? 'artifacts/release-review');
const paths = {
  browser: resolve(outputRoot, 'browser.json'),
  visual: resolve(outputRoot, 'visual.json'),
  performanceTests: resolve(outputRoot, 'performance-tests.json'),
  performance: resolve(outputRoot, 'performance.json'),
  release: resolve(root, 'dist/.well-known/pinega-release.json'),
};
const [browser, visual, performanceTests, performance, release] = await Promise.all(
  [paths.browser, paths.visual, paths.performanceTests, paths.performance, paths.release].map(path => readJson(path)),
);

const browserTests = collectTests(browser.suites);
const visualTests = collectTests(visual.suites);
const baselineTests = collectTests(performanceTests.suites);
assertGreenReport(browser, browserTests, 'browser/accessibility');
assertGreenReport(visual, visualTests, 'visual');
assertGreenReport(performanceTests, baselineTests, 'navigation/performance baseline');
const requiredProjects = ['chromium-desktop', 'chromium-mobile', 'firefox-desktop', 'webkit-desktop'];
const observedProjects = new Set(browserTests.filter(passed).map(test => test.projectName));
assert.deepEqual([...observedProjects].toSorted(), requiredProjects.toSorted(), 'cross-browser report is incomplete');

const accessibility = browserTests.filter(test => /accessib|axe|keyboard/iu.test(test.title));
assert.ok(accessibility.length > 0, 'browser report contains no accessibility evidence');
for (const project of requiredProjects) {
  assert.ok(accessibility.some(test => test.projectName === project && passed(test)), `missing passing accessibility evidence for ${project}`);
}
const keyboard = browserTests.filter(test => /keyboard navigation is trap-free/iu.test(test.title));
assert.equal(keyboard.filter(passed).length, requiredProjects.length, 'keyboard-trap review is incomplete');
const mixedBuild = browserTests.filter(test => /two-build deployment race hard-reloads once/iu.test(test.title));
assert.equal(mixedBuild.filter(passed).length, requiredProjects.length, 'mixed-build recovery review is incomplete');

assert.equal(performance.kind, 'pinega-gate-4.7-performance-review');
assert.equal(performance.buildId, release.buildId);
assert.equal(performance.inventorySha256, release.inventory.sha256);
assert.equal(performance.observations.length, 4);
for (const profile of ['desktop', 'mobile']) {
  for (const cycle of ['cold', 'warm']) {
    const observation = performance.observations.find(entry => entry.profile === profile && entry.cycle === cycle);
    assert.ok(observation, `missing ${profile}/${cycle} performance observation`);
    for (const [metric, value] of Object.entries(observation.metrics)) {
      assert.ok(Number.isFinite(value) && value >= 0, `invalid ${profile}/${cycle} ${metric}`);
    }
  }
}
await verifyReleaseManifest(resolve(root, 'dist'), release);

const review = {
  schemaVersion: 1,
  kind: 'pinega-gate-4.7-release-review',
  generatedAt: new Date().toISOString(),
  buildId: release.buildId,
  inventorySha256: release.inventory.sha256,
  inventoryFiles: release.inventory.fileCount,
  readiness: 'candidate-pending-remote-verification',
  gates: {
    exactArtifact: { status: 'pass', manifest: '/.well-known/pinega-release.json' },
    http: { status: 'pending-remote', localContract: 'pass', verification: 'full deployed byte/header/ETag verification runs after Direct Upload' },
    crossBrowser: { status: 'pass', projects: requiredProjects, retries: 0 },
    accessibility: { status: 'pass', blockingWcagAAIssues: 0, keyboardTraps: 0, evidenceTests: accessibility.filter(passed).length },
    visual: { status: 'pass', unexpectedDiffs: 0, evidenceTests: visualTests.filter(passed).length },
    performance: {
      status: 'pass',
      mode: 'diagnostic',
      profiles: ['desktop', 'mobile'],
      cycles: ['cold', 'warm'],
      structuralBaselineTests: baselineTests.filter(passed).length,
    },
  },
  policy: {
    serviceWorker: false,
    lighthouseSoleReleaseOracle: false,
    productionRebuildAllowed: false,
  },
};
await Promise.all([
  writeFile(resolve(outputRoot, 'release-review.json'), `${JSON.stringify(review, null, 2)}\n`, 'utf8'),
  writeFile(resolve(outputRoot, 'release-review.md'), renderMarkdown(review, performance), 'utf8'),
]);
console.log(`Gate 4.7 release review passed for ${release.buildId}.`);

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function collectTests(suites = [], output = []) {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) output.push({ ...test, title: spec.title });
    }
    collectTests(suite.suites, output);
  }
  return output;
}

function passed(test) {
  return test.results?.at(-1)?.status === 'passed';
}

function assertGreenReport(report, tests, label) {
  assert.ok((report.config?.projects ?? []).length > 0, `${label} report contains no projects`);
  assert.ok(report.config.projects.every(project => project.retries === 0), `${label} retries must be zero`);
  assert.equal(report.errors?.length ?? 0, 0, `${label} report contains top-level errors`);
  assert.equal(report.stats?.unexpected ?? 0, 0, `${label} report contains unexpected tests`);
  assert.equal(report.stats?.flaky ?? 0, 0, `${label} report contains flaky tests`);
  assert.ok((report.stats?.expected ?? 0) > 0, `${label} report contains no passing tests`);
  assert.ok(tests.every(test => (test.results?.length ?? 0) <= 1), `${label} report contains retried tests`);
}

function renderMarkdown(review, performance) {
  const rows = performance.observations.map(observation => {
    const metrics = observation.metrics;
    return `| ${observation.profile} | ${observation.cycle} | ${round(metrics.firstContentfulPaintMs)} | ${round(metrics.largestContentfulPaintMs)} | ${metrics.cumulativeLayoutShift.toFixed(4)} | ${round(metrics.speedIndexMs)} | ${round(metrics.totalBlockingTimeMs)} |`;
  }).join('\n');
  return `# Gate 4.7 release candidate review\n\n- Build: \`${review.buildId}\`\n- Inventory: \`${review.inventorySha256}\` (${review.inventoryFiles} public files)\n- Exact local artifact, cross-browser, accessibility, visual, and performance evidence: **pass**\n- Deployed byte/header/ETag verification: **pending Direct Upload**\n- Browser retries: **0**; blocking accessibility issues: **0**; keyboard traps: **0**; unexpected visual diffs: **0**\n- Lighthouse is diagnostic evidence, not the sole release oracle.\n\n| Profile | Cache | FCP (ms) | LCP (ms) | CLS | Speed Index (ms) | TBT (ms) |\n| --- | --- | ---: | ---: | ---: | ---: | ---: |\n${rows}\n`;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
