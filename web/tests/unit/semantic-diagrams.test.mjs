import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const modelRoot = resolve(root, '../design/diagrams/models');
const temp = await mkdtemp(resolve(tmpdir(), 'pinega-diagrams-'));
const rendererPath = resolve(temp, 'renderer.mjs');

await build({
  entryPoints: [resolve(root, 'src/diagrams/index.ts')],
  outfile: rendererPath,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: ['node26'],
  sourcemap: false,
  logLevel: 'silent',
});

const renderer = await import(pathToFileURL(rendererPath).href);
const modelFiles = (await readdir(modelRoot))
  .filter(name => name.endsWith('.json'))
  .sort();
const models = await Promise.all(modelFiles.map(async name => ({
  name,
  value: JSON.parse(await readFile(resolve(modelRoot, name), 'utf8')),
})));

test.after(async () => {
  await rm(temp, { recursive: true, force: true });
});

test('all shared models validate and have stable renderer-independent identities', () => {
  const validated = models.map(({ name, value }) => {
    const model = renderer.validateDiagramModel(value);
    assert.equal(`${model.id}.json`, name);
    return model;
  });
  assert.deepEqual(validated.map(model => model.kind).sort(), ['history', 'lifecycle', 'version-chain']);
});

test('semantic models contain no renderer coordinates or presentation values', () => {
  const rendererKeys = new Set([
    'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'd',
    'width', 'height', 'viewBox', 'font', 'color', 'fill', 'stroke',
  ]);
  for (const { name, value } of models) inspect(value, name, rendererKeys);
});

test('web figures are deterministic, accessible, and retain textual fallbacks', () => {
  for (const { value } of models) {
    const first = renderer.renderDiagramFigure(value);
    const second = renderer.renderDiagramFigure(structuredClone(value));
    assert.equal(first, second);
    assert.match(first, /<figure class="pinega-semantic-diagram"/u);
    assert.match(first, /<svg[^>]+role="img" aria-labelledby="[^"]+"[^>]*><title[^>]*>[^<]+<\/title><desc[^>]*>[^<]+<\/desc>/u);
    assert.match(first, /<figcaption>[^<]+<\/figcaption>/u);
    assert.match(first, /<details class="pinega-diagram-transcript">/u);
    assert.match(first, /<pre tabindex="0"><code>/u);
    assert.match(first, /href="\/diagrams\/models\/[a-z0-9-]+\.json" download/u);
    assert.doesNotMatch(first, /undefined|\[object Object\]/u);
  }
});

test('history validation rejects temporal and cross-reference violations', () => {
  const history = structuredClone(models.find(model => model.value.kind === 'history')?.value);
  assert.ok(history);
  history.operations[0].linearization = 99;
  assert.throws(
    () => renderer.validateDiagramModel(history),
    /linearization follows response/u,
  );

  const unknownLane = structuredClone(models.find(model => model.value.kind === 'history')?.value);
  unknownLane.operations[0].lane = 'missing-lane';
  assert.throws(
    () => renderer.validateDiagramModel(unknownLane),
    /unknown lane/u,
  );
});

test('version and lifecycle validation reject broken identity graphs', () => {
  const versions = structuredClone(models.find(model => model.value.kind === 'version-chain')?.value);
  versions.snapshot.visibleVersion = 'missing-version';
  assert.throws(
    () => renderer.validateDiagramModel(versions),
    /unknown version/u,
  );

  const lifecycle = structuredClone(models.find(model => model.value.kind === 'lifecycle')?.value);
  lifecycle.transitions = lifecycle.transitions.filter(transition => transition.id !== 'quiesce');
  assert.throws(
    () => renderer.validateDiagramModel(lifecycle),
    /unreachable states/u,
  );
});

function inspect(value, path, rendererKeys) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspect(item, `${path}[${index}]`, rendererKeys));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    assert.ok(!rendererKeys.has(key), `${path} contains renderer key ${key}`);
    inspect(nested, `${path}.${key}`, rendererKeys);
  }
}
