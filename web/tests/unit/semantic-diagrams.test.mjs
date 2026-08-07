import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const repositoryRoot = resolve(root, '..');
const modelRoot = resolve(repositoryRoot, 'design/diagrams/models');
const layoutRoot = resolve(repositoryRoot, 'design/diagrams/layouts');
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
const layoutCatalogue = JSON.parse(await readFile(resolve(layoutRoot, 'profiles.json'), 'utf8'));

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
    'layoutProfile', 'strategy', 'layerOrder',
  ]);
  for (const { name, value } of models) inspect(value, name, rendererKeys);
});

test('layout profiles are versioned presentation data outside the semantic schema', () => {
  assert.equal(layoutCatalogue.profileSchemaVersion, 1);
  assert.deepEqual(layoutCatalogue.layerOrder, ['background', 'relations', 'objects', 'annotations', 'proof']);
  for (const kind of ['history', 'version-chain', 'lifecycle']) {
    const profiles = renderer.listDiagramLayoutProfiles(kind);
    assert.ok(profiles.length >= 2, `${kind} must expose production and candidate profiles`);
    assert.equal(profiles.filter(profile => profile.status === 'production').length, 1);
    assert.ok(profiles.some(profile => profile.status === 'candidate'));
    assert.equal(renderer.defaultLayoutProfileId(kind), layoutCatalogue.defaults[kind]);
  }
});

test('web figures are deterministic, accessible, and retain textual fallbacks', () => {
  for (const { value } of models) {
    const first = renderer.renderDiagramFigure(value);
    const second = renderer.renderDiagramFigure(structuredClone(value));
    assert.equal(first, second);
    assert.match(first, /<figure class="pinega-semantic-diagram"/u);
    assert.match(first, /data-layout-profile="production-v0\.2"/u);
    assert.match(first, /<svg[^>]+role="img" aria-labelledby="[^"]+"[^>]*><title[^>]*>[^<]+<\/title><desc[^>]*>[^<]+<\/desc>/u);
    assert.match(first, /<figcaption>[^<]+<\/figcaption>/u);
    assert.match(first, /<details class="pinega-diagram-transcript">/u);
    assert.match(first, /<pre tabindex="0"><code>/u);
    assert.match(first, /href="\/diagrams\/models\/[a-z0-9-]+\.json" download/u);
    assert.doesNotMatch(first, /undefined|\[object Object\]/u);
  }
});

test('authoring SVG is layered, semantic, standalone, and raster-free', () => {
  for (const { value } of models) {
    const model = renderer.validateDiagramModel(value);
    for (const profile of renderer.listDiagramLayoutProfiles(model.kind)) {
      const first = renderer.renderDiagramAuthoringSvg(model, { profile: profile.id, systemVersion: '0.3.0' });
      const second = renderer.renderDiagramAuthoringSvg(structuredClone(model), { profile: profile.id, systemVersion: '0.3.0' });
      assert.equal(first, second);
      assert.match(first, /^<\?xml version="1\.0" encoding="UTF-8"\?>/u);
      assert.match(first, /xmlns:inkscape="http:\/\/www\.inkscape\.org\/namespaces\/inkscape"/u);
      assert.match(first, /data-authoring-format="pinega-svg-v1"/u);
      assert.match(first, new RegExp(`data-layout-profile="${escapeRegex(profile.id)}"`, 'u'));
      assert.match(first, /inkscape:label="Background"/u);
      assert.match(first, /inkscape:label="Relations"/u);
      assert.match(first, /inkscape:label="Objects"/u);
      assert.match(first, /inkscape:label="Annotations"/u);
      assert.match(first, /inkscape:label="Proof"/u);
      assert.match(first, /data-semantic-id="/u);
      assert.match(first, /<text\b/u);
      assert.doesNotMatch(first, /<image\b|<script\b|javascript:|(?:href|xlink:href)="https?:\/\//u);
      const scene = renderer.renderDiagramScene(model, { profile: profile.id });
      assert.equal(scene.layoutProfile, profile.id);
      assert.ok(scene.elements.some(element => element.semanticId));
    }
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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
