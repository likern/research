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
const paths = Object.freeze({
  main: 'dist/assets/main.js',
  css: 'dist/assets/main.css',
  core: 'dist/assets/chunks/core-ABCDEFGH.js',
  russian: 'dist/assets/chunks/ru-ABCDEFGH.js',
  diagram: 'dist/assets/chunks/diagram-viewer-ABCDEFGH.js',
  lit: 'dist/assets/chunks/lit-ABCDEFGH.js',
});
const litModules = [
  'node_modules/@lit/reactive-element/reactive-element.js',
  'node_modules/lit-element/lit-element.js',
  'node_modules/lit-html/lit-html.js',
];
const packageLock = {
  packages: {
    'node_modules/@lit/reactive-element': { version: '2.1.2' },
    'node_modules/lit': { version: '3.3.3' },
    'node_modules/lit-element': { version: '4.2.2' },
    'node_modules/lit-html': { version: '3.3.3' },
  },
};

function metafile(extraOutputs = {}) {
  return {
    inputs: {},
    outputs: {
      [paths.main]: {
        entryPoint: 'src/main.ts',
        cssBundle: paths.css,
        imports: [
          { path: paths.core, kind: 'dynamic-import' },
          { path: paths.russian, kind: 'dynamic-import' },
          { path: paths.diagram, kind: 'dynamic-import' },
        ],
        inputs: { 'src/main.ts': { bytesInOutput: 10 } },
      },
      [paths.css]: { imports: [], inputs: {} },
      [paths.core]: {
        entryPoint: 'src/vendor/webawesome/core.ts',
        imports: [{ path: paths.lit, kind: 'import-statement' }],
        inputs: { 'src/vendor/webawesome/core.ts': { bytesInOutput: 10 } },
      },
      [paths.russian]: {
        entryPoint: 'node_modules/@awesome.me/webawesome/dist/translations/ru.js',
        imports: [],
        inputs: {},
      },
      [paths.diagram]: {
        entryPoint: 'src/features/diagram-viewer.ts',
        imports: [{ path: paths.lit, kind: 'import-statement' }],
        inputs: { 'src/features/diagram-viewer.ts': { bytesInOutput: 10 } },
      },
      [paths.lit]: {
        imports: [],
        inputs: Object.fromEntries(litModules.map(moduleId => [moduleId, { bytesInOutput: 10 }])),
      },
      ...extraOutputs,
    },
  };
}

test('verified esbuild graph derives viewport requests and explicit shell module-map reuse', () => {
  const verified = createVerifiedFeatureGraph({
    definitions: [definition],
    metafile: metafile(),
    packageLock,
    esbuildVersion: '0.28.1',
  });
  assert.deepEqual(verified.graph.bundler, {
    name: 'esbuild',
    version: '0.28.1',
    metafile: '/assets/bundle-manifest.json',
    format: 'esm',
    splitting: true,
    minified: true,
    dynamicImports: 'native',
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
    moduleMapReuse: ['/assets/chunks/lit-ABCDEFGH.js'],
  });
});

test('esbuild verification fails if a Lit runtime module is duplicated or a feature entry is omitted', () => {
  assert.throws(() => createVerifiedFeatureGraph({
    definitions: [definition],
    metafile: metafile({
      'dist/assets/chunks/duplicate-ABCDEFGH.js': {
        imports: [],
        inputs: { [litModules[0]]: { bytesInOutput: 10 } },
      },
    }),
    packageLock,
    esbuildVersion: '0.28.1',
  }), /multiple chunks/u);

  const missing = metafile();
  missing.outputs[paths.main].imports = missing.outputs[paths.main].imports
    .filter(imported => imported.path !== paths.diagram);
  assert.throws(() => createVerifiedFeatureGraph({
    definitions: [definition],
    metafile: missing,
    packageLock,
    esbuildVersion: '0.28.1',
  }), /not reachable/u);
});

test('esbuild verification rejects static feature edges and external production imports', () => {
  const staticFeature = metafile();
  staticFeature.outputs[paths.main].imports.find(imported => imported.path === paths.diagram).kind = 'import-statement';
  assert.throws(() => createVerifiedFeatureGraph({
    definitions: [definition],
    metafile: staticFeature,
    packageLock,
    esbuildVersion: '0.28.1',
  }), /native dynamic-import edges/u);

  const external = metafile();
  external.outputs[paths.main].imports.push({
    path: 'https://example.invalid/runtime.js',
    kind: 'dynamic-import',
    external: true,
  });
  assert.throws(() => createVerifiedFeatureGraph({
    definitions: [definition],
    metafile: external,
    packageLock,
    esbuildVersion: '0.28.1',
  }), /must be self-contained/u);
});
