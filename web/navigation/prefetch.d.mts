export const DEFAULT_PREFETCH_MAX_CONCURRENCY: number;
export const DEFAULT_PREFETCH_MAX_QUEUE: number;
export const HOVER_PREFETCH_DELAY_MS: number;
export const SLOW_EFFECTIVE_CONNECTION_TYPES: readonly string[];

export type PrefetchIntentSignal = 'hover' | 'focus' | 'pointer';
export type PrefetchNetworkReason = 'eligible' | 'offline' | 'save-data' | 'slow-network';

export interface PrefetchNetworkInput {
  readonly online?: boolean;
  readonly saveData?: boolean;
  readonly effectiveType?: string;
}

export type PrefetchNetworkDecision =
  | { readonly allowed: true; readonly reason: 'eligible' }
  | { readonly allowed: false; readonly reason: Exclude<PrefetchNetworkReason, 'eligible'> };

export function classifyPrefetchNetworkPolicy(input?: PrefetchNetworkInput): PrefetchNetworkDecision;

export interface PrefetchSchedulerSnapshot {
  readonly active: number;
  readonly queued: number;
  readonly maxConcurrent: number;
  readonly maxQueued: number;
  readonly activeKeys: readonly string[];
  readonly queuedKeys: readonly string[];
}

export interface PrefetchScheduleResult {
  readonly status: 'started' | 'queued' | 'duplicate' | 'rejected';
  readonly state: 'active' | 'queued' | 'none';
  readonly promoted: boolean;
  readonly droppedKeys: readonly string[];
}

export interface PrefetchSchedulerEntry<T = unknown> {
  readonly key: string;
  readonly signal: PrefetchIntentSignal;
  readonly status: 'fulfilled' | 'aborted' | 'rejected';
  readonly value?: T;
  readonly error?: unknown;
}

export interface PrefetchDrop {
  readonly key: string;
  readonly signal: PrefetchIntentSignal;
  readonly reason: string;
}

export class BoundedPrefetchScheduler<T = unknown> {
  readonly maxConcurrent: number;
  readonly maxQueued: number;

  constructor(options?: {
    maxConcurrent?: number;
    maxQueued?: number;
    onStart?: (entry: { readonly key: string; readonly signal: PrefetchIntentSignal }) => void;
    onSettle?: (entry: PrefetchSchedulerEntry<T>) => void;
    onDrop?: (entry: PrefetchDrop) => void;
  });
  schedule(
    key: string,
    signal: PrefetchIntentSignal,
    task: (abortSignal: AbortSignal) => Promise<T> | T,
  ): PrefetchScheduleResult;
  state(key: string): 'active' | 'queued' | 'none';
  cancelQueued(key: string, reason?: string): boolean;
  cancelExcept(retainedKey?: string, reason?: string): {
    readonly queuedKeys: readonly string[];
    readonly activeKeys: readonly string[];
  };
  clear(reason?: string): {
    readonly queuedKeys: readonly string[];
    readonly activeKeys: readonly string[];
  };
  snapshot(): PrefetchSchedulerSnapshot;
}

export interface PrefetchTelemetrySnapshot {
  readonly intents: {
    readonly hover: number;
    readonly focus: number;
    readonly pointer: number;
    readonly outcomes: Readonly<Record<string, number>>;
  };
  readonly prefetches: {
    readonly started: number;
    readonly completed: number;
    readonly failed: number;
    readonly aborted: number;
    readonly hits: number;
    readonly cacheHits: number;
    readonly inFlightHits: number;
    readonly retainedUnused: number;
    readonly finalizedUnused: number;
    readonly hitRate: number | null;
  };
  readonly bytes: {
    readonly source: {
      readonly prefetched: number;
      readonly useful: number;
      readonly retainedUnused: number;
      readonly finalizedUnused: number;
      readonly wasted: number;
    };
    readonly transfer: {
      readonly prefetched: number;
      readonly useful: number;
      readonly retainedUnused: number;
      readonly finalizedUnused: number;
      readonly wasted: number;
      readonly resourceTimingMeasurements: number;
      readonly sourceFallbackMeasurements: number;
    };
  };
}

export class PrefetchTelemetry {
  recordIntent(signal: PrefetchIntentSignal, outcome: string): void;
  recordOutcome(outcome: string): void;
  recordStarted(key: string): void;
  recordCompleted(key: string, result: {
    sourceBytes: number;
    transferBytes: number;
    transferMeasurement: 'resource-timing' | 'source-fallback';
    retained: boolean;
  }): void;
  recordSettledFailure(key: string, status: 'aborted' | 'rejected'): void;
  recordConsumed(key: string, source: 'cache' | 'in-flight' | 'network'): boolean;
  recordEvicted(keys: readonly string[]): readonly string[];
  snapshot(): PrefetchTelemetrySnapshot;
}
