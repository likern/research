import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import test from 'node:test';

const webRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const repositoryRoot = resolve(webRoot, '..');
const modelRoot = resolve(repositoryRoot, 'design/diagrams/models');
const temp = await mkdtemp(resolve(tmpdir(), 'pinega-academic-diagrams-'));
const rendererPath = resolve(temp, 'renderer.mjs');

await build({
  entryPoints: [resolve(webRoot, 'src/diagrams/index.ts')],
  outfile: rendererPath,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: ['node26'],
  sourcemap: false,
  logLevel: 'silent',
});

const renderer = await import(pathToFileURL(rendererPath).href);
const history = JSON.parse(
  await readFile(resolve(modelRoot, 'linearizability-overlap.json'), 'utf8'),
);
const versions = JSON.parse(
  await readFile(resolve(modelRoot, 'version-chain-snapshot.json'), 'utf8'),
);

test.after(async () => {
  await rm(temp, { recursive: true, force: true });
});

test('version-chain renderer separates references from snapshot evaluation', () => {
  const figure = renderer.renderDiagramFigure(versions);

  assert.match(figure, /data-diagram-role="head-reference"/u);
  assert.match(figure, /data-diagram-role="temporal-relation"/u);
  assert.match(figure, /data-diagram-role="visibility-evaluation"/u);
  assert.match(figure, /data-diagram-role="visibility-result"/u);
  assert.doesNotMatch(figure, /data-diagram-role="snapshot"/u);
});

test('history renderer exposes LP, time, precedence, and proof roles independently', () => {
  const figure = renderer.renderDiagramFigure(history);

  assert.match(figure, /pinega-diagram-time-axis/u);
  assert.match(figure, /data-diagram-role="real-time-precedence"/u);
  assert.match(figure, /pinega-diagram-lp-marker/u);
  assert.match(figure, /data-diagram-role="sequential-witness"/u);
  assert.match(
    figure,
    /Preserves process order and every real-time precedence constraint/u,
  );
});

test('the consolidated system has one canonical model surface', async () => {
  const version = (
    await readFile(resolve(repositoryRoot, 'design/diagrams/VERSION'), 'utf8')
  ).trim();
  const architecture = await readFile(
    resolve(repositoryRoot, 'docs/semantic-diagrams.md'),
    'utf8',
  );

  assert.match(version, /^\d+\.\d+\.\d+$/u);
  assert.match(architecture, /only canonical source is `design\/diagrams\/models\/\*\.json`/u);
  assert.match(architecture, /not a second schema or authoring\s+format/u);
  assert.match(architecture, /layout profiles are versioned presentation configuration/u);

  await assert.rejects(
    access(resolve(repositoryRoot, 'diagrams')),
    (error) => error?.code === 'ENOENT',
  );
});

test('the permanent review workflow verifies baselines and publishes authoring artifacts', async () => {
  const workflow = await readFile(
    resolve(repositoryRoot, '.github/workflows/diagram-academic-review.yml'),
    'utf8',
  );
  const captureScript = await readFile(
    resolve(webRoot, 'scripts/capture-diagram-review.mjs'),
    'utf8',
  );
  const typstReview = await readFile(
    resolve(
      repositoryRoot,
      'ydmp/templates/diagrams/specimens/academic-review.typ',
    ),
    'utf8',
  );

  assert.match(workflow, /push:\n    branches:\n      - main/u);
  assert.match(workflow, /npm run test:visual(?:\n|\r\n)/u);
  assert.doesNotMatch(workflow, /--update-snapshots/u);
  assert.doesNotMatch(workflow, /agent\/scientific-diagram-language/u);
  assert.match(workflow, /design\/diagrams\/VERSION/u);
  assert.match(workflow, /design\/diagrams\/layouts\/\*\.json/u);
  assert.match(workflow, /web\/authoring\/manifest\.json/u);
  assert.match(workflow, /steps\.artifact\.outputs\.name/u);
  assert.match(workflow, /id: upload[\s\S]*actions\/upload-artifact@v7/u);
  assert.match(workflow, /steps\.upload\.outputs\.artifact-id/u);
  assert.match(workflow, /steps\.upload\.outputs\.artifact-digest/u);
  assert.match(workflow, /HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/u);
  assert.match(workflow, /cd "\$review"[\s\S]*find \. -type f ! -name SHA256SUMS/u);
  assert.match(captureScript, /renderDiagramAuthoringSvg/u);
  assert.match(captureScript, /layout-profile-review\.pdf/u);
  assert.match(captureScript, /PINEGA_DIAGRAM_VERSION/u);
  assert.match(typstReview, /sys\.inputs\.at\("diagram-version"/u);
});
