import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import test from 'node:test';

import { LIT_ISLAND_POLICY } from '../../navigation/contract.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const repositoryRoot = resolve(root, '..');
const temporary = await mkdtemp(resolve(tmpdir(), 'pinega-lit-island-'));
const inspectorBundle = resolve(temporary, 'model-inspector.mjs');

await build({
  entryPoints: [resolve(root, 'src/components/diagram-viewer/model-inspector.ts')],
  outfile: inspectorBundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: ['node24'],
  sourcemap: false,
  logLevel: 'silent',
});

const inspector = await import(pathToFileURL(inspectorBundle).href);
const versionModel = JSON.parse(await readFile(
  resolve(repositoryRoot, 'design/diagrams/models/version-chain-snapshot.json'),
  'utf8',
));

test.after(async () => {
  await rm(temporary, { recursive: true, force: true });
});

test('semantic model task accepts only the island-owned same-origin endpoint', () => {
  const common = {
    baseUrl: 'https://pinega.example/research/',
    siteOrigin: 'https://pinega.example',
    expectedId: 'version-chain-snapshot',
  };
  assert.equal(inspector.resolveDiagramModelUrl({
    ...common,
    href: '/diagrams/models/version-chain-snapshot.json',
    locale: 'en',
  }).href, 'https://pinega.example/diagrams/models/version-chain-snapshot.json');
  assert.equal(inspector.resolveDiagramModelUrl({
    ...common,
    href: '/content/diagrams/ru/version-chain-snapshot.json',
    locale: 'ru',
  }).href, 'https://pinega.example/content/diagrams/ru/version-chain-snapshot.json');

  for (const request of [
    { ...common, href: 'https://example.com/model.json', locale: 'en' },
    { ...common, href: '/diagrams/models/version-chain-snapshot.json?build=other', locale: 'en' },
    { ...common, href: '/diagrams/models/linearizability-overlap.json', locale: 'en' },
    { ...common, href: '/diagrams/models/version-chain-snapshot.json', locale: 'ru' },
  ]) {
    assert.throws(() => inspector.resolveDiagramModelUrl(request), inspector.DiagramModelRequestError);
  }
});

test('@lit/task payload validates the canonical model and returns a bounded summary', async () => {
  const controller = new AbortController();
  const calls = [];
  const summary = await inspector.loadDiagramModelSummary({
    href: '/diagrams/models/version-chain-snapshot.json',
    baseUrl: 'https://pinega.example/research/',
    siteOrigin: 'https://pinega.example',
    expectedId: 'version-chain-snapshot',
    locale: 'en',
    signal: controller.signal,
    fetcher: async (input, init) => {
      calls.push({ href: String(input), signal: init?.signal, headers: init?.headers });
      return jsonResponse(versionModel);
    },
  });
  assert.deepEqual(summary, {
    schemaVersion: 1,
    id: 'version-chain-snapshot',
    kind: 'version-chain',
    title: 'Newest-to-oldest row-version chain',
    description: versionModel.description,
    itemKind: 'versions',
    itemCount: 3,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].href, 'https://pinega.example/diagrams/models/version-chain-snapshot.json');
  assert.strictEqual(calls[0].signal, controller.signal);
  assert.deepEqual(calls[0].headers, { accept: 'application/json' });
});

test('component-local model task rejects invalid media, identity, size, and cancellation', async () => {
  const request = fetcher => ({
    href: '/diagrams/models/version-chain-snapshot.json',
    baseUrl: 'https://pinega.example/research/',
    siteOrigin: 'https://pinega.example',
    expectedId: 'version-chain-snapshot',
    locale: 'en',
    signal: new AbortController().signal,
    fetcher,
  });
  await assert.rejects(
    inspector.loadDiagramModelSummary(request(async () => new Response('{}', {
      headers: { 'content-type': 'text/html' },
    }))),
    /media type/u,
  );
  await assert.rejects(
    inspector.loadDiagramModelSummary(request(async () => jsonResponse({ ...versionModel, id: 'other-model' }))),
    /does not match/u,
  );
  await assert.rejects(
    inspector.loadDiagramModelSummary(request(async () => new Response('{}', {
      headers: {
        'content-length': String(inspector.MAX_DIAGRAM_MODEL_BYTES + 1),
        'content-type': 'application/json',
      },
    }))),
    /component limit/u,
  );
  await assert.rejects(
    inspector.loadDiagramModelSummary(request(async () => new Response(
      JSON.stringify({ padding: 'x'.repeat(inspector.MAX_DIAGRAM_MODEL_BYTES) }),
      { headers: { 'content-type': 'application/json' } },
    ))),
    /component limit/u,
  );

  const controller = new AbortController();
  const reason = new DOMException('unit disconnect', 'AbortError');
  controller.abort(reason);
  await assert.rejects(inspector.loadDiagramModelSummary({
    ...request(async () => jsonResponse(versionModel)),
    signal: controller.signal,
  }), error => error === reason);
});

test('Lit and @lit/task remain feature-local and the package graph stays deduplicated', async () => {
  assert.deepEqual(LIT_ISLAND_POLICY, {
    schemaVersion: 1,
    ownership: 'component-local',
    routeLoading: false,
    router: false,
    globalRendering: false,
    globalHydration: false,
    taskPackage: '@lit/task',
    islands: [{
      id: 'semantic-diagram-inspector',
      element: 'pinega-diagram-viewer',
      feature: 'diagram-viewer',
      fallback: 'canonical-light-dom',
      asyncScope: 'component-local-model',
      reconnect: true,
    }],
  });
  const sourceFiles = await walk(resolve(root, 'src'));
  const taskOwners = [];
  for (const path of sourceFiles.filter(path => path.endsWith('.ts'))) {
    const source = await readFile(path, 'utf8');
    if (/from ['"]@lit\/task['"]/u.test(source)) taskOwners.push(relative(root, path));
  }
  assert.deepEqual(taskOwners, ['src/components/diagram-viewer/diagram-viewer.ts']);

  const component = await readFile(resolve(root, taskOwners[0]), 'utf8');
  assert.match(component, /autoRun:\s*false/u);
  assert.match(component, /connectedCallback\(\)[\s\S]*const listenerOptions = \{ signal: this\.#connectionController\.signal \}/u);
  assert.match(component, /window\.addEventListener\(['"]keydown['"], this\.#handleWindowKeydown, listenerOptions\)/u);
  assert.match(component, /disconnectedCallback\(\)[\s\S]*#modelTask\.abort/u);
  assert.match(component, /createRenderRoot\(\)[\s\S]*data-pinega-island-root/u);
  assert.doesNotMatch(component, /unsafeHTML|hydrate\s*\(|render\s*\(\s*document/u);

  for (const owner of ['src/main.ts', 'src/navigation/coordinator.ts', 'src/navigation/route-document.ts']) {
    const source = await readFile(resolve(root, owner), 'utf8');
    assert.doesNotMatch(source, /from ['"](?:lit|@lit\/task|@lit-labs\/ssr|lit-html)/u, owner);
    assert.doesNotMatch(source, /lit-router|hydrate\s*\(/u, owner);
  }

  const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
  for (const name of ['@lit/reactive-element', '@lit/task', 'lit', 'lit-element', 'lit-html']) {
    const rootPath = `node_modules/${name}`;
    const installations = Object.keys(lock.packages).filter(path => path === rootPath || path.endsWith(`/node_modules/${name}`));
    assert.deepEqual(installations, [rootPath], `${name} must have one root installation`);
  }
  assert.equal(lock.packages['node_modules/@lit/task'].version, '1.0.3');
});

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else if (entry.isFile()) paths.push(path);
  }
  return paths.toSorted();
}
