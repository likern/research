export const DEFAULT_ROUTE_CACHE_MAX_ENTRIES = 10;
export const DEFAULT_ROUTE_CACHE_MAX_WEIGHT_BYTES = 2 * 1024 * 1024;
export const ROUTE_CACHE_NODE_WEIGHT_BYTES = 256;

export function estimateRouteWeight(sourceBytes, nodeCount) {
  assertNonNegativeInteger(sourceBytes, 'sourceBytes');
  assertNonNegativeInteger(nodeCount, 'nodeCount');
  return sourceBytes + nodeCount * ROUTE_CACHE_NODE_WEIGHT_BYTES;
}

export function responseAllowsRouteCache(cacheControl) {
  if (cacheControl === null || cacheControl === undefined || cacheControl.trim() === '') return true;
  return !cacheControl.split(',').some(part => part.trim().split('=', 1)[0]?.trim().toLowerCase() === 'no-store');
}

export class NativeRouteCache {
  #entries = new Map();
  #activeKey;
  #weightBytes = 0;

  constructor({
    maxEntries = DEFAULT_ROUTE_CACHE_MAX_ENTRIES,
    maxWeightBytes = DEFAULT_ROUTE_CACHE_MAX_WEIGHT_BYTES,
  } = {}) {
    assertPositiveInteger(maxEntries, 'maxEntries');
    assertPositiveInteger(maxWeightBytes, 'maxWeightBytes');
    this.maxEntries = maxEntries;
    this.maxWeightBytes = maxWeightBytes;
  }

  peek(key) {
    assertKey(key);
    return this.#entries.get(key)?.value;
  }

  insert(key, value, weightBytes) {
    assertKey(key);
    assertNonNegativeInteger(weightBytes, 'weightBytes');
    this.#remove(key);
    if (weightBytes > this.maxWeightBytes) {
      return { stored: false, evictedKeys: [] };
    }
    this.#entries.set(key, { value, weightBytes });
    this.#weightBytes += weightBytes;
    const evictedKeys = this.#enforceBounds();
    return { stored: this.#entries.has(key), evictedKeys };
  }

  commitActive(key, value, weightBytes) {
    assertKey(key);
    assertNonNegativeInteger(weightBytes, 'weightBytes');
    this.#activeKey = key;
    this.#remove(key, { preserveActive: true });
    if (weightBytes <= this.maxWeightBytes) {
      this.#entries.set(key, { value, weightBytes });
      this.#weightBytes += weightBytes;
    }
    const evictedKeys = this.#enforceBounds();
    if (!this.#entries.has(key)) this.#activeKey = undefined;
    return { stored: this.#entries.has(key), evictedKeys };
  }

  activate(key) {
    assertKey(key);
    const entry = this.#entries.get(key);
    if (!entry) return { activated: false, evictedKeys: [] };
    this.#activeKey = key;
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return { activated: true, evictedKeys: this.#enforceBounds() };
  }

  deactivate() {
    this.#activeKey = undefined;
    return { evictedKeys: this.#enforceBounds() };
  }

  delete(key) {
    assertKey(key);
    return this.#remove(key);
  }

  clear() {
    const removed = [...this.#entries.keys()];
    this.#entries.clear();
    this.#activeKey = undefined;
    this.#weightBytes = 0;
    return removed;
  }

  snapshot() {
    return Object.freeze({
      entries: this.#entries.size,
      weightBytes: this.#weightBytes,
      maxEntries: this.maxEntries,
      maxWeightBytes: this.maxWeightBytes,
      activeKey: this.#activeKey ?? null,
      keys: Object.freeze([...this.#entries.keys()]),
    });
  }

  #enforceBounds() {
    const evictedKeys = [];
    while (this.#entries.size > this.maxEntries || this.#weightBytes > this.maxWeightBytes) {
      const candidate = [...this.#entries.keys()].find(key => key !== this.#activeKey);
      if (candidate === undefined) break;
      this.#remove(candidate);
      evictedKeys.push(candidate);
    }
    return evictedKeys;
  }

  #remove(key, { preserveActive = false } = {}) {
    const entry = this.#entries.get(key);
    if (!entry) return false;
    this.#entries.delete(key);
    this.#weightBytes -= entry.weightBytes;
    if (!preserveActive && this.#activeKey === key) this.#activeKey = undefined;
    return true;
  }
}

export class InFlightRoutePreparations {
  #entries = new Map();

  acquire(key, factory) {
    assertKey(key);
    if (typeof factory !== 'function') throw new TypeError('Route preparation factory must be a function.');
    const existing = this.#entries.get(key);
    if (existing) return { promise: existing.promise, reused: true };

    const controller = new AbortController();
    let tracked;
    const promise = Promise.resolve().then(() => factory(controller.signal));
    tracked = promise.finally(() => {
      if (this.#entries.get(key)?.promise === tracked) this.#entries.delete(key);
    });
    this.#entries.set(key, { controller, promise: tracked });
    return { promise: tracked, reused: false };
  }

  abortExcept(retainedKey) {
    if (retainedKey !== undefined) assertKey(retainedKey);
    const abortedKeys = [];
    for (const [key, entry] of this.#entries) {
      if (key === retainedKey) continue;
      this.#entries.delete(key);
      entry.controller.abort();
      abortedKeys.push(key);
    }
    return abortedKeys;
  }

  clear() {
    return this.abortExcept();
  }

  snapshot() {
    return Object.freeze({
      entries: this.#entries.size,
      keys: Object.freeze([...this.#entries.keys()]),
    });
  }
}

function assertKey(key) {
  if (typeof key !== 'string' || key === '') throw new TypeError('Route cache key must be a non-empty string.');
}

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${label} must be a positive safe integer.`);
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative safe integer.`);
}
