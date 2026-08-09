import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ClosedFeatureRegistry,
  FeatureRegistryContractError,
} from '../../navigation/feature-registry.mjs';

const definition = Object.freeze({
  id: 'example',
  element: 'pinega-example',
  loading: 'deferred',
  implementation: 'native',
  module: 'src/features/example.ts',
});
const moduleNamespace = Object.freeze({
  featureId: 'example',
  featureElement: 'pinega-example',
  featureImplementation: 'native',
});

test('closed feature registry rejects missing, extra, and non-literal loader mappings', () => {
  assert.throws(
    () => new ClosedFeatureRegistry([definition], {}),
    /no literal dynamic-import loader/u,
  );
  assert.throws(
    () => new ClosedFeatureRegistry([definition], {
      example: { source: 'src/features/other.ts', load: async () => moduleNamespace },
    }),
    /does not match/u,
  );
  assert.throws(
    () => new ClosedFeatureRegistry([definition], {
      example: { source: definition.module, load: async () => moduleNamespace },
      unknown: { source: 'src/features/unknown.ts', load: async () => moduleNamespace },
    }),
    /Unregistered feature loaders/u,
  );
  assert.throws(
    () => new ClosedFeatureRegistry([{ ...definition, loading: 'idle' }], {
      example: { source: definition.module, load: async () => moduleNamespace },
    }),
    FeatureRegistryContractError,
  );
});

test('concurrent feature requests reuse one application promise and one evaluated module', async () => {
  let resolveImport;
  let calls = 0;
  const registry = new ClosedFeatureRegistry([definition], {
    example: {
      source: definition.module,
      load: () => {
        calls += 1;
        return new Promise(resolve => { resolveImport = resolve; });
      },
    },
  });

  const first = registry.load('example');
  const second = registry.load('example');
  assert.strictEqual(first, second);
  assert.equal(registry.status('example'), 'loading');
  await Promise.resolve();
  assert.equal(calls, 1);
  resolveImport(moduleNamespace);
  assert.strictEqual(await first, moduleNamespace);
  assert.equal(registry.status('example'), 'loaded');
  assert.strictEqual(registry.load('example'), first);
});

test('a rejected or contradictory module is never retained as successful registry state', async () => {
  let calls = 0;
  const registry = new ClosedFeatureRegistry([definition], {
    example: {
      source: definition.module,
      load: async () => {
        calls += 1;
        if (calls === 1) throw new TypeError('synthetic chunk failure');
        if (calls === 2) return { ...moduleNamespace, featureElement: 'pinega-wrong' };
        return moduleNamespace;
      },
    },
  });

  await assert.rejects(registry.load('example'), /synthetic chunk failure/u);
  assert.equal(registry.status('example'), 'unloaded');
  await assert.rejects(registry.load('example'), /exports/u);
  assert.equal(registry.status('example'), 'unloaded');
  assert.strictEqual(await registry.load('example'), moduleNamespace);
  assert.equal(registry.status('example'), 'loaded');
  assert.equal(calls, 3);
});

test('untrusted feature IDs cannot become module specifiers', async () => {
  const registry = new ClosedFeatureRegistry([definition], {
    example: { source: definition.module, load: async () => moduleNamespace },
  });
  assert.throws(() => registry.load('../attacker-controlled'), /Unknown route feature/u);
  assert.equal(registry.status('example'), 'unloaded');
});
