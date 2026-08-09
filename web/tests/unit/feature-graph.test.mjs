import assert from 'node:assert/strict';
import test from 'node:test';

import { createVerifiedFeatureGraph } from '../../scripts/lib/feature-graph.mjs';

const definition = Object.freeze({
  id: 'diagram-viewer',
  element: 'pinega-diagram-viewer',
  loading: 'viewport',
  implementation: 'lit',
  module: 'src/features/diagram-viewer.ts',
});
const manifest = {
  '_lit-ABCDEFGH.js': { file: 'chunks/lit-ABCDEFGH.js', name: 'lit' },
  'node_modules/@awesome.me/webawesome/dist/translations/ru.js': {
    file: 'chunks/ru-ABCDEFGH.js',
    src: 'node_modules/@awesome.me/webawesome/dist/translations/ru.js',
    isDynamicEntry: true,
  },
  'src/features/diagram-viewer.ts': {
    file: 'chunks/diagram-viewer-ABCDEFGH.js',
    src: 'src/features/diagram-viewer.ts',
    isDynamicEntry: true,
    imports: ['src/main.ts', '_lit-ABCDEFGH.js'],
  },
  'src/main.ts': {
    file: 'main.js',
    src: 'src/main.ts',
    isEntry: true,
    dynamicImports: [
      'src/features/diagram-viewer.ts',
      'src/vendor/webawesome/core.ts',
      'node_modules/@awesome.me/webawesome/dist/translations/ru.js',
    ],
  },
  'src/vendor/webawesome/core.ts': {
    file: 'chunks/core-ABCDEFGH.js',
    src: 'src/vendor/webawesome/core.ts',
    isDynamicEntry: true,
    imports: ['src/main.ts', '_lit-ABCDEFGH.js'],
  },
};
const litModules = [
  '/workspace/web/node_modules/@lit/reactive-element/reactive-element.js',
  '/workspace/web/node_modules/lit-element/lit-element.js',
  '/workspace/web/node_modules/lit-html/lit-html.js',
];
const packageLock = {
  packages: {
    'node_modules/@lit/reactive-element': { version: '2.1.2' },
    'node_modules/lit': { version: '3.3.3' },
    'node_modules/lit-element': { version: '4.2.2' },
    'node_modules/lit-html': { version: '3.3.3' },
  },
};

function bundle(extraChunks = []) {
  return {
    output: [{
      type: 'chunk',
      fileName: 'chunks/lit-ABCDEFGH.js',
      code: '',
      modules: Object.fromEntries(litModules.map(moduleId => [moduleId, {}])),
    }, {
      type: 'chunk',
      fileName: 'main.js',
      code: '',
      modules: { '/workspace/web/src/main.ts': {} },
    }, ...extraChunks],
  };
}

test('verified Vite graph derives viewport requests and explicit shell module-map reuse', () => {
  const verified = createVerifiedFeatureGraph({
    definitions: [definition],
    manifest,
    bundle: bundle(),
    packageLock,
    viteVersion: '8.2.1',
  });
  assert.equal(verified.graph.features[0].chunk, '/assets/chunks/diagram-viewer-ABCDEFGH.js');
  assert.deepEqual(verified.graph.lit, {
    deduplicated: true,
    runtimeChunk: '/assets/chunks/lit-ABCDEFGH.js',
    packages: {
      '@lit/reactive-element': '2.1.2',
      lit: '3.3.3',
      'lit-element': '4.2.2',
      'lit-html': '3.3.3',
    },
    consumers: ['src/vendor/webawesome/core.ts', 'src/features/diagram-viewer.ts'],
  });
  assert.deepEqual(verified.routeRequests('en', ['diagram-viewer']), {
    schemaVersion: 1,
    shell: [
      '/assets/chunks/core-ABCDEFGH.js',
      '/assets/chunks/lit-ABCDEFGH.js',
      '/assets/main.css',
      '/assets/main.js',
    ],
    critical: [],
    deferred: [],
    viewport: ['/assets/chunks/diagram-viewer-ABCDEFGH.js'],
    moduleMapReuse: ['/assets/chunks/lit-ABCDEFGH.js', '/assets/main.js'],
  });
});

test('Vite verification fails if a Lit runtime module is duplicated or a feature entry is omitted', () => {
  assert.throws(() => createVerifiedFeatureGraph({
    definitions: [definition],
    manifest,
    bundle: bundle([{
      type: 'chunk',
      fileName: 'chunks/duplicate-ABCDEFGH.js',
      code: '',
      modules: { [litModules[0]]: {} },
    }]),
    packageLock,
    viteVersion: '8.2.1',
  }), /multiple chunks/u);

  const missing = structuredClone(manifest);
  missing['src/main.ts'].dynamicImports = ['src/vendor/webawesome/core.ts'];
  assert.throws(() => createVerifiedFeatureGraph({
    definitions: [definition],
    manifest: missing,
    bundle: bundle(),
    packageLock,
    viteVersion: '8.2.1',
  }), /dynamic feature entries mismatch/u);
});

test('Vite verification rejects automatic dependency-preload wrappers', () => {
  assert.throws(() => createVerifiedFeatureGraph({
    definitions: [definition],
    manifest,
    bundle: bundle([{
      type: 'chunk',
      fileName: 'chunks/preload-ABCDEFGH.js',
      code: 'const __vite__mapDeps = () => [];',
      modules: {},
    }]),
    packageLock,
    viteVersion: '8.2.1',
  }), /dependency preloading must remain disabled/u);
});
