export const DEFAULT_PREFETCH_MAX_CONCURRENCY = 2;
export const DEFAULT_PREFETCH_MAX_QUEUE = 8;
export const HOVER_PREFETCH_DELAY_MS = 80;
export const SLOW_EFFECTIVE_CONNECTION_TYPES = Object.freeze(['slow-2g', '2g', '3g']);

const priorities = Object.freeze({ hover: 1, focus: 2, pointer: 3 });
const intentSignals = new Set(Object.keys(priorities));
const slowEffectiveTypes = new Set(SLOW_EFFECTIVE_CONNECTION_TYPES);

export function classifyPrefetchNetworkPolicy({
  online = true,
  saveData = false,
  effectiveType,
} = {}) {
  if (online === false) return Object.freeze({ allowed: false, reason: 'offline' });
  if (saveData === true) return Object.freeze({ allowed: false, reason: 'save-data' });
  const normalizedType = typeof effectiveType === 'string' ? effectiveType.trim().toLowerCase() : '';
  if (slowEffectiveTypes.has(normalizedType)) {
    return Object.freeze({ allowed: false, reason: 'slow-network' });
  }
  return Object.freeze({ allowed: true, reason: 'eligible' });
}

export class BoundedPrefetchScheduler {
  #active = new Map();
  #queue = new Map();
  #sequence = 0;
  #onStart;
  #onSettle;
  #onDrop;

  constructor({
    maxConcurrent = DEFAULT_PREFETCH_MAX_CONCURRENCY,
    maxQueued = DEFAULT_PREFETCH_MAX_QUEUE,
    onStart = () => {},
    onSettle = () => {},
    onDrop = () => {},
  } = {}) {
    assertPositiveInteger(maxConcurrent, 'maxConcurrent');
    assertNonNegativeInteger(maxQueued, 'maxQueued');
    assertFunction(onStart, 'onStart');
    assertFunction(onSettle, 'onSettle');
    assertFunction(onDrop, 'onDrop');
    this.maxConcurrent = maxConcurrent;
    this.maxQueued = maxQueued;
    this.#onStart = onStart;
    this.#onSettle = onSettle;
    this.#onDrop = onDrop;
  }

  schedule(key, signal, task) {
    assertKey(key);
    assertIntentSignal(signal);
    assertFunction(task, 'task');
    const priority = priorities[signal];
    const active = this.#active.get(key);
    if (active) {
      return Object.freeze({ status: 'duplicate', state: 'active', promoted: false, droppedKeys: Object.freeze([]) });
    }
    const queued = this.#queue.get(key);
    if (queued) {
      const promoted = priority > queued.priority;
      if (promoted) {
        queued.priority = priority;
        queued.signal = signal;
      }
      return Object.freeze({ status: 'duplicate', state: 'queued', promoted, droppedKeys: Object.freeze([]) });
    }

    const entry = { key, signal, priority, task, sequence: this.#sequence += 1 };
    if (this.#active.size < this.maxConcurrent) {
      this.#start(entry);
      return Object.freeze({ status: 'started', state: 'active', promoted: false, droppedKeys: Object.freeze([]) });
    }

    const droppedKeys = [];
    if (this.#queue.size >= this.maxQueued) {
      const candidate = [...this.#queue.values()].sort(compareDropCandidates)[0];
      if (!candidate || priority <= candidate.priority) {
        return Object.freeze({ status: 'rejected', state: 'none', promoted: false, droppedKeys: Object.freeze([]) });
      }
      this.#queue.delete(candidate.key);
      droppedKeys.push(candidate.key);
      this.#onDrop(Object.freeze({ key: candidate.key, signal: candidate.signal, reason: 'preempted' }));
    }
    this.#queue.set(key, entry);
    return Object.freeze({
      status: 'queued',
      state: 'queued',
      promoted: false,
      droppedKeys: Object.freeze(droppedKeys),
    });
  }

  state(key) {
    assertKey(key);
    if (this.#active.has(key)) return 'active';
    if (this.#queue.has(key)) return 'queued';
    return 'none';
  }

  cancelQueued(key, reason = 'cancelled') {
    assertKey(key);
    const entry = this.#queue.get(key);
    if (!entry) return false;
    this.#queue.delete(key);
    this.#onDrop(Object.freeze({ key, signal: entry.signal, reason }));
    return true;
  }

  cancelExcept(retainedKey, reason = 'cancelled') {
    if (retainedKey !== undefined) assertKey(retainedKey);
    const queuedKeys = [];
    const activeKeys = [];
    for (const [key, entry] of this.#queue) {
      if (key === retainedKey) continue;
      this.#queue.delete(key);
      queuedKeys.push(key);
      this.#onDrop(Object.freeze({ key, signal: entry.signal, reason }));
    }
    for (const [key, entry] of this.#active) {
      if (key === retainedKey || entry.controller.signal.aborted) continue;
      activeKeys.push(key);
      entry.controller.abort();
    }
    return Object.freeze({ queuedKeys: Object.freeze(queuedKeys), activeKeys: Object.freeze(activeKeys) });
  }

  clear(reason = 'cancelled') {
    return this.cancelExcept(undefined, reason);
  }

  snapshot() {
    return Object.freeze({
      active: this.#active.size,
      queued: this.#queue.size,
      maxConcurrent: this.maxConcurrent,
      maxQueued: this.maxQueued,
      activeKeys: Object.freeze([...this.#active.keys()]),
      queuedKeys: Object.freeze([...this.#queue.values()].sort(compareRunCandidates).map(entry => entry.key)),
    });
  }

  #start(entry) {
    const controller = new AbortController();
    this.#active.set(entry.key, { ...entry, controller });
    let operation;
    try {
      operation = Promise.resolve(entry.task(controller.signal));
    } catch (error) {
      operation = Promise.reject(error);
    }
    this.#onStart(Object.freeze({ key: entry.key, signal: entry.signal }));
    void operation
      .then(
        value => Object.freeze({ key: entry.key, signal: entry.signal, status: 'fulfilled', value }),
        error => Object.freeze({
          key: entry.key,
          signal: entry.signal,
          status: controller.signal.aborted || isAbortError(error) ? 'aborted' : 'rejected',
          error,
        }),
      )
      .then(outcome => {
        if (this.#active.get(entry.key)?.controller === controller) this.#active.delete(entry.key);
        this.#drain();
        this.#onSettle(outcome);
      });
  }

  #drain() {
    while (this.#active.size < this.maxConcurrent && this.#queue.size > 0) {
      const next = [...this.#queue.values()].sort(compareRunCandidates)[0];
      if (!next) return;
      this.#queue.delete(next.key);
      this.#start(next);
    }
  }
}

export class PrefetchTelemetry {
  #intents = new Map();
  #outcomes = new Map();
  #records = new Map();
  #started = 0;
  #completed = 0;
  #failed = 0;
  #aborted = 0;
  #hits = 0;
  #cacheHits = 0;
  #inFlightHits = 0;
  #finalizedUnused = 0;
  #prefetchedSourceBytes = 0;
  #prefetchedTransferBytes = 0;
  #usefulSourceBytes = 0;
  #usefulTransferBytes = 0;
  #finalizedUnusedSourceBytes = 0;
  #finalizedUnusedTransferBytes = 0;
  #resourceTimingMeasurements = 0;
  #sourceFallbackMeasurements = 0;

  recordIntent(signal, outcome) {
    assertIntentSignal(signal);
    increment(this.#intents, signal);
    this.recordOutcome(outcome);
  }

  recordOutcome(outcome) {
    assertLabel(outcome, 'outcome');
    increment(this.#outcomes, outcome);
  }

  recordStarted(key) {
    assertKey(key);
    if (this.#records.has(key)) throw new TypeError(`Prefetch telemetry already owns ${JSON.stringify(key)}.`);
    this.#records.set(key, {
      state: 'active',
      sourceBytes: 0,
      transferBytes: 0,
    });
    this.#started += 1;
  }

  recordCompleted(key, {
    sourceBytes,
    transferBytes,
    transferMeasurement,
    retained,
  }) {
    assertNonNegativeInteger(sourceBytes, 'sourceBytes');
    assertNonNegativeInteger(transferBytes, 'transferBytes');
    if (transferMeasurement !== 'resource-timing' && transferMeasurement !== 'source-fallback') {
      throw new TypeError(`Unknown transfer measurement ${JSON.stringify(transferMeasurement)}.`);
    }
    const record = this.#records.get(key);
    if (!record || (record.state !== 'active' && record.state !== 'consumed-pending')) {
      throw new TypeError(`Prefetch telemetry cannot complete ${JSON.stringify(key)} from its current state.`);
    }
    record.sourceBytes = sourceBytes;
    record.transferBytes = transferBytes;
    this.#completed += 1;
    this.#prefetchedSourceBytes += sourceBytes;
    this.#prefetchedTransferBytes += transferBytes;
    if (transferMeasurement === 'resource-timing') this.#resourceTimingMeasurements += 1;
    else this.#sourceFallbackMeasurements += 1;

    if (record.state === 'consumed-pending') {
      this.#usefulSourceBytes += sourceBytes;
      this.#usefulTransferBytes += transferBytes;
      this.#records.delete(key);
    } else if (retained === true) {
      record.state = 'retained';
    } else {
      this.#finalizeUnused(key, record);
    }
  }

  recordSettledFailure(key, status) {
    assertKey(key);
    if (status !== 'aborted' && status !== 'rejected') throw new TypeError(`Invalid failure status ${JSON.stringify(status)}.`);
    const record = this.#records.get(key);
    if (!record) return;
    this.#records.delete(key);
    if (status === 'aborted') this.#aborted += 1;
    else this.#failed += 1;
  }

  recordConsumed(key, source) {
    assertKey(key);
    if (source !== 'cache' && source !== 'in-flight') return false;
    const record = this.#records.get(key);
    if (!record || (record.state !== 'active' && record.state !== 'retained')) return false;
    this.#hits += 1;
    if (source === 'cache') this.#cacheHits += 1;
    else this.#inFlightHits += 1;
    if (record.state === 'active') {
      record.state = 'consumed-pending';
    } else {
      this.#usefulSourceBytes += record.sourceBytes;
      this.#usefulTransferBytes += record.transferBytes;
      this.#records.delete(key);
    }
    return true;
  }

  recordEvicted(keys) {
    const finalizedKeys = [];
    for (const key of keys) {
      assertKey(key);
      const record = this.#records.get(key);
      if (!record || record.state !== 'retained') continue;
      this.#finalizeUnused(key, record);
      finalizedKeys.push(key);
    }
    return Object.freeze(finalizedKeys);
  }

  snapshot() {
    const retained = [...this.#records.values()].filter(record => record.state === 'retained');
    const retainedUnusedSourceBytes = retained.reduce((total, record) => total + record.sourceBytes, 0);
    const retainedUnusedTransferBytes = retained.reduce((total, record) => total + record.transferBytes, 0);
    return Object.freeze({
      intents: Object.freeze({
        hover: this.#intents.get('hover') ?? 0,
        focus: this.#intents.get('focus') ?? 0,
        pointer: this.#intents.get('pointer') ?? 0,
        outcomes: Object.freeze(Object.fromEntries([...this.#outcomes].sort(([left], [right]) => left.localeCompare(right)))),
      }),
      prefetches: Object.freeze({
        started: this.#started,
        completed: this.#completed,
        failed: this.#failed,
        aborted: this.#aborted,
        hits: this.#hits,
        cacheHits: this.#cacheHits,
        inFlightHits: this.#inFlightHits,
        retainedUnused: retained.length,
        finalizedUnused: this.#finalizedUnused,
        hitRate: this.#completed === 0 ? null : this.#hits / this.#completed,
      }),
      bytes: Object.freeze({
        source: Object.freeze({
          prefetched: this.#prefetchedSourceBytes,
          useful: this.#usefulSourceBytes,
          retainedUnused: retainedUnusedSourceBytes,
          finalizedUnused: this.#finalizedUnusedSourceBytes,
          wasted: this.#prefetchedSourceBytes - this.#usefulSourceBytes,
        }),
        transfer: Object.freeze({
          prefetched: this.#prefetchedTransferBytes,
          useful: this.#usefulTransferBytes,
          retainedUnused: retainedUnusedTransferBytes,
          finalizedUnused: this.#finalizedUnusedTransferBytes,
          wasted: this.#prefetchedTransferBytes - this.#usefulTransferBytes,
          resourceTimingMeasurements: this.#resourceTimingMeasurements,
          sourceFallbackMeasurements: this.#sourceFallbackMeasurements,
        }),
      }),
    });
  }

  #finalizeUnused(key, record) {
    this.#records.delete(key);
    this.#finalizedUnused += 1;
    this.#finalizedUnusedSourceBytes += record.sourceBytes;
    this.#finalizedUnusedTransferBytes += record.transferBytes;
  }
}

function compareRunCandidates(left, right) {
  return right.priority - left.priority || left.sequence - right.sequence;
}

function compareDropCandidates(left, right) {
  return left.priority - right.priority || left.sequence - right.sequence;
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function assertIntentSignal(signal) {
  if (!intentSignals.has(signal)) throw new TypeError(`Unknown prefetch intent signal ${JSON.stringify(signal)}.`);
}

function assertKey(key) {
  if (typeof key !== 'string' || key === '') throw new TypeError('Prefetch key must be a non-empty string.');
}

function assertLabel(value, label) {
  if (typeof value !== 'string' || value === '') throw new TypeError(`${label} must be a non-empty string.`);
}

function assertFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
}

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${label} must be a positive safe integer.`);
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative safe integer.`);
}

function isAbortError(error) {
  return error instanceof DOMException && error.name === 'AbortError';
}
