import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BoundedPrefetchScheduler,
  PrefetchTelemetry,
  classifyPrefetchNetworkPolicy,
} from '../../navigation/prefetch.mjs';

test('network policy is conservative for explicit data saving, offline, and 3g-or-slower signals', () => {
  assert.deepEqual(classifyPrefetchNetworkPolicy(), { allowed: true, reason: 'eligible' });
  assert.deepEqual(classifyPrefetchNetworkPolicy({ effectiveType: '4g' }), { allowed: true, reason: 'eligible' });
  assert.deepEqual(classifyPrefetchNetworkPolicy({ effectiveType: 'unknown' }), { allowed: true, reason: 'eligible' });
  assert.deepEqual(classifyPrefetchNetworkPolicy({ online: false }), { allowed: false, reason: 'offline' });
  assert.deepEqual(classifyPrefetchNetworkPolicy({ saveData: true }), { allowed: false, reason: 'save-data' });
  for (const effectiveType of ['slow-2g', '2g', '3g', ' 3G ']) {
    assert.deepEqual(classifyPrefetchNetworkPolicy({ effectiveType }), {
      allowed: false,
      reason: 'slow-network',
    });
  }
});

test('scheduler bounds active and queued work, coalesces keys, and promotes stronger intent', async () => {
  const starts = [];
  const settlements = [];
  const drops = [];
  const releases = new Map();
  const scheduler = new BoundedPrefetchScheduler({
    maxConcurrent: 2,
    maxQueued: 1,
    onStart: entry => starts.push(entry.key),
    onSettle: entry => settlements.push({ key: entry.key, status: entry.status }),
    onDrop: entry => drops.push({ key: entry.key, reason: entry.reason }),
  });
  const task = key => () => new Promise(resolve => releases.set(key, resolve));

  assert.equal(scheduler.schedule('a', 'hover', task('a')).status, 'started');
  assert.equal(scheduler.schedule('b', 'focus', task('b')).status, 'started');
  assert.equal(scheduler.schedule('c', 'hover', task('c')).status, 'queued');
  assert.deepEqual(scheduler.schedule('a', 'pointer', task('duplicate')), {
    status: 'duplicate',
    state: 'active',
    promoted: false,
    droppedKeys: [],
  });
  assert.deepEqual(scheduler.schedule('d', 'pointer', task('d')), {
    status: 'queued',
    state: 'queued',
    promoted: false,
    droppedKeys: ['c'],
  });
  assert.equal(scheduler.schedule('e', 'pointer', task('e')).status, 'rejected');
  assert.deepEqual(scheduler.snapshot(), {
    active: 2,
    queued: 1,
    maxConcurrent: 2,
    maxQueued: 1,
    activeKeys: ['a', 'b'],
    queuedKeys: ['d'],
  });
  assert.deepEqual(drops, [{ key: 'c', reason: 'preempted' }]);

  await Promise.resolve();
  releases.get('a')?.('a');
  await settleTasks();
  assert.deepEqual(starts, ['a', 'b', 'd']);
  assert.deepEqual(settlements, [{ key: 'a', status: 'fulfilled' }]);
  assert.equal(scheduler.snapshot().active, 2);
  assert.equal(scheduler.snapshot().queued, 0);

  releases.get('b')?.('b');
  releases.get('d')?.('d');
  await settleTasks();
  assert.deepEqual(scheduler.snapshot().activeKeys, []);
});

test('scheduler cancellation aborts speculative work except the foreground destination', async () => {
  const settlements = [];
  const scheduler = new BoundedPrefetchScheduler({
    maxConcurrent: 2,
    maxQueued: 2,
    onSettle: entry => settlements.push({ key: entry.key, status: entry.status }),
  });
  const task = key => signal => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException(`${key} aborted`, 'AbortError')), { once: true });
  });
  scheduler.schedule('keep', 'hover', task('keep'));
  scheduler.schedule('abort', 'focus', task('abort'));
  scheduler.schedule('queued', 'hover', task('queued'));
  await Promise.resolve();

  assert.deepEqual(scheduler.cancelExcept('keep', 'foreground-navigation'), {
    queuedKeys: ['queued'],
    activeKeys: ['abort'],
  });
  await settleTasks();
  assert.deepEqual(settlements, [{ key: 'abort', status: 'aborted' }]);
  assert.equal(scheduler.state('keep'), 'active');
  assert.equal(scheduler.state('queued'), 'none');
  scheduler.clear('test-complete');
  await settleTasks();
});

test('telemetry derives hit rate and live versus finalized wasted bytes from route outcomes', () => {
  const telemetry = new PrefetchTelemetry();
  telemetry.recordIntent('hover', 'started');
  telemetry.recordStarted('route-a');
  telemetry.recordCompleted('route-a', {
    sourceBytes: 100,
    transferBytes: 80,
    transferMeasurement: 'resource-timing',
    retained: true,
  });

  assert.deepEqual(telemetry.snapshot().prefetches, {
    started: 1,
    completed: 1,
    failed: 0,
    aborted: 0,
    hits: 0,
    cacheHits: 0,
    inFlightHits: 0,
    retainedUnused: 1,
    finalizedUnused: 0,
    hitRate: 0,
  });
  assert.equal(telemetry.snapshot().bytes.transfer.wasted, 80);

  assert.equal(telemetry.recordConsumed('route-a', 'cache'), true);
  assert.equal(telemetry.snapshot().prefetches.hitRate, 1);
  assert.equal(telemetry.snapshot().bytes.transfer.useful, 80);
  assert.equal(telemetry.snapshot().bytes.transfer.wasted, 0);

  telemetry.recordIntent('focus', 'started');
  telemetry.recordStarted('route-b');
  telemetry.recordCompleted('route-b', {
    sourceBytes: 50,
    transferBytes: 40,
    transferMeasurement: 'source-fallback',
    retained: false,
  });
  assert.equal(telemetry.snapshot().prefetches.hitRate, 0.5);
  assert.equal(telemetry.snapshot().prefetches.finalizedUnused, 1);
  assert.deepEqual(telemetry.snapshot().bytes.transfer, {
    prefetched: 120,
    useful: 80,
    retainedUnused: 0,
    finalizedUnused: 40,
    wasted: 40,
    resourceTimingMeasurements: 1,
    sourceFallbackMeasurements: 1,
  });

  telemetry.recordStarted('route-c');
  telemetry.recordSettledFailure('route-c', 'aborted');
  assert.equal(telemetry.snapshot().prefetches.aborted, 1);

  telemetry.recordStarted('route-d');
  telemetry.recordCompleted('route-d', {
    sourceBytes: 30,
    transferBytes: 20,
    transferMeasurement: 'resource-timing',
    retained: true,
  });
  assert.deepEqual(telemetry.recordEvicted(['ordinary-route', 'route-d']), ['route-d']);
  assert.equal(telemetry.snapshot().prefetches.finalizedUnused, 2);
  assert.equal(telemetry.snapshot().bytes.transfer.finalizedUnused, 60);
});

async function settleTasks() {
  await new Promise(resolve => setImmediate(resolve));
  await Promise.resolve();
}
