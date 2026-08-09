export const DEFAULT_ROUTE_CACHE_MAX_ENTRIES: number;
export const DEFAULT_ROUTE_CACHE_MAX_WEIGHT_BYTES: number;
export const ROUTE_CACHE_NODE_WEIGHT_BYTES: number;

export function estimateRouteWeight(sourceBytes: number, nodeCount: number): number;
export function responseAllowsRouteCache(cacheControl: string | null | undefined): boolean;

export interface RouteCacheMutation {
  readonly stored: boolean;
  readonly evictedKeys: string[];
}

export interface RouteCacheActivation {
  readonly activated: boolean;
  readonly evictedKeys: string[];
}

export interface RouteCacheSnapshot {
  readonly entries: number;
  readonly weightBytes: number;
  readonly maxEntries: number;
  readonly maxWeightBytes: number;
  readonly activeKey: string | null;
  readonly keys: readonly string[];
}

export class NativeRouteCache<T> {
  readonly maxEntries: number;
  readonly maxWeightBytes: number;

  constructor(options?: { maxEntries?: number; maxWeightBytes?: number });
  peek(key: string): T | undefined;
  insert(key: string, value: T, weightBytes: number): RouteCacheMutation;
  commitActive(key: string, value: T, weightBytes: number): RouteCacheMutation;
  activate(key: string): RouteCacheActivation;
  deactivate(): { evictedKeys: string[] };
  delete(key: string): boolean;
  clear(): string[];
  snapshot(): RouteCacheSnapshot;
}

export interface InFlightAcquisition<T> {
  readonly promise: Promise<T>;
  readonly reused: boolean;
}

export interface InFlightSnapshot {
  readonly entries: number;
  readonly keys: readonly string[];
}

export class InFlightRoutePreparations<T> {
  acquire(key: string, factory: (signal: AbortSignal) => Promise<T> | T): InFlightAcquisition<T>;
  abortExcept(retainedKey?: string): string[];
  clear(): string[];
  snapshot(): InFlightSnapshot;
}
