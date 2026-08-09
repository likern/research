import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InFlightRoutePreparations,
  NativeRouteCache,
  ROUTE_CACHE_NODE_WEIGHT_BYTES,
  estimateRouteWeight,
  responseAllowsRouteCache,
} from '../../navigation/route-cache.mjs';

test('native route cache uses post-commit activation as the LRU recency boundary', () => {
  const cache = new NativeRouteCache({ maxEntries: 3, maxWeightBytes: 1_000 });
  cache.commitActive('a', { route: 'a' }, 100);
  cache.insert('b', { route: 'b' }, 100);
  cache.insert('c', { route: 'c' }, 100);

  assert.equal(cache.peek('a')?.route, 'a');
  assert.deepEqual(cache.snapshot().keys, ['a', 'b', 'c'], 'peek must not change recency before commit');
  assert.deepEqual(cache.activate('a'), { activated: true, evictedKeys: [] });
  assert.deepEqual(cache.snapshot().keys, ['b', 'c', 'a']);

  assert.deepEqual(cache.insert('d', { route: 'd' }, 100), { stored: true, evictedKeys: ['b'] });
  assert.equal(cache.peek('b'), undefined);
  assert.deepEqual(cache.snapshot().keys, ['c', 'a', 'd']);
});

test('entry and estimated-weight bounds evict independently while pinning the active route', () => {
  const byEntries = new NativeRouteCache({ maxEntries: 2, maxWeightBytes: 10_000 });
  byEntries.commitActive('active', 1, 100);
  byEntries.insert('old', 2, 100);
  assert.deepEqual(byEntries.insert('new', 3, 100), { stored: true, evictedKeys: ['old'] });
  assert.equal(byEntries.peek('active'), 1);
  assert.deepEqual(byEntries.snapshot().keys, ['active', 'new']);

  const byWeight = new NativeRouteCache({ maxEntries: 10, maxWeightBytes: 250 });
  byWeight.commitActive('active', 1, 150);
  assert.deepEqual(byWeight.insert('candidate', 2, 150), { stored: false, evictedKeys: ['candidate'] });
  assert.deepEqual(byWeight.snapshot(), {
    entries: 1,
    weightBytes: 150,
    maxEntries: 10,
    maxWeightBytes: 250,
    activeKey: 'active',
    keys: ['active'],
  });

  assert.deepEqual(byWeight.commitActive('next', 3, 150), { stored: true, evictedKeys: ['active'] });
  assert.equal(byWeight.peek('active'), undefined);
  assert.equal(byWeight.peek('next'), 3);
});

test('oversized and no-store routes never become application-cache entries', () => {
  const cache = new NativeRouteCache({ maxEntries: 2, maxWeightBytes: 100 });
  cache.commitActive('boot', 1, 50);
  assert.deepEqual(cache.commitActive('oversized', 2, 101), { stored: false, evictedKeys: [] });
  assert.equal(cache.peek('oversized'), undefined);
  assert.equal(cache.snapshot().activeKey, null);

  assert.equal(responseAllowsRouteCache(null), true);
  assert.equal(responseAllowsRouteCache('public, max-age=0, must-revalidate'), true);
  assert.equal(responseAllowsRouteCache('private, NO-STORE, max-age=0'), false);
  assert.equal(responseAllowsRouteCache('max-age=0, no-store="field"'), false);
});

test('route weight combines exact UTF-8 source bytes with the conservative node heuristic', () => {
  assert.equal(estimateRouteWeight(1_024, 10), 1_024 + 10 * ROUTE_CACHE_NODE_WEIGHT_BYTES);
  assert.throws(() => estimateRouteWeight(-1, 1), /sourceBytes/u);
  assert.throws(() => estimateRouteWeight(1, 0.5), /nodeCount/u);
});

test('in-flight preparation is shared by one route and cancellation is coordinator-owned', async () => {
  const preparations = new InFlightRoutePreparations();
  let factoryCalls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });

  const first = preparations.acquire('route-a', async signal => {
    factoryCalls += 1;
    await gate;
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return 'prepared-a';
  });
  const repeated = preparations.acquire('route-a', () => assert.fail('duplicate preparation started'));

  assert.equal(first.reused, false);
  assert.equal(repeated.reused, true);
  assert.equal(first.promise, repeated.promise);
  assert.equal(factoryCalls, 0, 'factory starts in a microtask after the registry publishes ownership');
  assert.deepEqual(preparations.abortExcept('route-a'), [], 'the replacement consumer retains the shared route');
  release();
  assert.equal(await repeated.promise, 'prepared-a');
  assert.equal(factoryCalls, 1);
  assert.deepEqual(preparations.snapshot(), { entries: 0, keys: [] });
});

test('a different destination aborts orphaned preparation without poisoning its replacement', async () => {
  const preparations = new InFlightRoutePreparations();
  const orphan = preparations.acquire('route-a', signal => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));

  await Promise.resolve();
  assert.deepEqual(preparations.abortExcept('route-b'), ['route-a']);
  await assert.rejects(orphan.promise, error => error instanceof DOMException && error.name === 'AbortError');

  const replacement = preparations.acquire('route-b', async () => 'prepared-b');
  assert.equal(replacement.reused, false);
  assert.equal(await replacement.promise, 'prepared-b');
  assert.deepEqual(preparations.snapshot(), { entries: 0, keys: [] });
});
