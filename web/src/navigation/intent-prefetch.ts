import { routeCacheKey } from '../../navigation/contract.mjs';
import {
  BoundedPrefetchScheduler,
  DEFAULT_PREFETCH_MAX_CONCURRENCY,
  DEFAULT_PREFETCH_MAX_QUEUE,
  HOVER_PREFETCH_DELAY_MS,
  PrefetchTelemetry,
  SLOW_EFFECTIVE_CONNECTION_TYPES,
  classifyPrefetchNetworkPolicy,
  type PrefetchIntentSignal,
  type PrefetchNetworkDecision,
  type PrefetchTelemetrySnapshot,
} from '../../navigation/prefetch.mjs';
import {
  classifyPrefetchIntent,
  type NavigationSourceKind,
  type PrefetchIntent,
} from '../../navigation/policy.mjs';

export interface PrefetchLoadResult {
  readonly sourceBytes: number;
  readonly transferBytes: number;
  readonly transferMeasurement: 'resource-timing' | 'source-fallback';
  readonly retained: boolean;
  readonly evictedKeys: readonly string[];
}

export interface PrefetchMetricsDetail extends PrefetchTelemetrySnapshot {
  readonly schemaVersion: 1;
  readonly kind: 'pinega-intent-prefetch-metrics';
  readonly policy: {
    readonly hoverDelayMs: number;
    readonly maxConcurrent: number;
    readonly maxQueued: number;
    readonly slowEffectiveTypes: readonly string[];
    readonly routePriority: 'low';
  };
  readonly network: {
    readonly apiSupported: boolean;
    readonly online: boolean;
    readonly saveData: boolean | null;
    readonly effectiveType: string | null;
    readonly allowed: boolean;
    readonly reason: string;
  };
  readonly scheduler: {
    readonly active: number;
    readonly queued: number;
    readonly maxConcurrent: number;
    readonly maxQueued: number;
    readonly activeKeys: readonly string[];
    readonly queuedKeys: readonly string[];
  };
}

export interface PrefetchCommitOutcome {
  readonly hit: boolean;
  readonly source: 'cache' | 'in-flight' | null;
  readonly metrics: PrefetchMetricsDetail;
}

interface NetworkInformationLike extends EventTarget {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
}

interface IntentPrefetchOptions {
  readonly activeBuildId: () => string;
  readonly activeDocumentUrl: () => string;
  readonly fallbackTarget: () => string | undefined;
  readonly routeState: (key: string) => 'cached' | 'in-flight' | 'cold';
  readonly load: (target: URL, key: string, signal: AbortSignal) => Promise<PrefetchLoadResult>;
}

interface HoverIntent {
  readonly timer: number;
}

export class IntentPrefetchController {
  readonly #options: IntentPrefetchOptions;
  readonly #telemetry = new PrefetchTelemetry();
  readonly #scheduler: BoundedPrefetchScheduler<PrefetchLoadResult>;
  readonly #hoverIntents = new Map<HTMLAnchorElement | HTMLAreaElement, HoverIntent>();
  readonly #lifecycle = new AbortController();
  readonly #connection: NetworkInformationLike | undefined;
  #started = false;

  constructor(options: IntentPrefetchOptions) {
    this.#options = options;
    this.#connection = networkInformation();
    this.#scheduler = new BoundedPrefetchScheduler<PrefetchLoadResult>({
      onStart: entry => {
        this.#telemetry.recordStarted(entry.key);
        this.#emitMetrics();
      },
      onSettle: entry => {
        if (entry.status === 'aborted' || entry.status === 'rejected') {
          this.#telemetry.recordSettledFailure(entry.key, entry.status);
          this.#telemetry.recordOutcome(entry.status);
        }
        this.#emitMetrics();
      },
      onDrop: entry => {
        this.#telemetry.recordOutcome(`dropped:${entry.reason}`);
        this.#emitMetrics();
      },
    });
  }

  start(): void {
    if (this.#started) return;
    this.#started = true;
    const root = document.documentElement;
    if (window.__PINEGA_DISABLE_PREFETCH__ === true) {
      root.dataset.pinegaPrefetch = 'disabled';
      return;
    }

    root.dataset.pinegaPrefetch = 'intent';
    const options = { capture: true, signal: this.#lifecycle.signal } as const;
    document.addEventListener('pointerover', this.#handlePointerOver, options);
    document.addEventListener('pointerout', this.#handlePointerOut, options);
    document.addEventListener('pointerdown', this.#handlePointerDown, options);
    document.addEventListener('focusin', this.#handleFocusIn, options);
    document.addEventListener('visibilitychange', this.#handleVisibilityChange, { signal: this.#lifecycle.signal });
    window.addEventListener('online', this.#handleNetworkChange, { signal: this.#lifecycle.signal });
    window.addEventListener('offline', this.#handleNetworkChange, { signal: this.#lifecycle.signal });
    window.addEventListener('pagehide', this.#handlePageHide, { signal: this.#lifecycle.signal });
    this.#connection?.addEventListener('change', this.#handleNetworkChange, { signal: this.#lifecycle.signal });
    this.#emitMetrics();
  }

  prepareForNavigation(key?: string): void {
    this.#clearHoverIntents('foreground-navigation');
    this.#scheduler.cancelExcept(key, 'foreground-navigation');
    if (key) this.#scheduler.cancelQueued(key, 'foreground-selected');
    this.#emitMetrics();
  }

  recordCommit(
    key: string,
    source: 'cache' | 'in-flight' | 'network',
    evictedKeys: readonly string[],
  ): PrefetchCommitOutcome {
    this.#telemetry.recordEvicted(evictedKeys);
    const hit = this.#telemetry.recordConsumed(key, source);
    return Object.freeze({
      hit,
      source: hit && (source === 'cache' || source === 'in-flight') ? source : null,
      metrics: this.snapshot(),
    });
  }

  publish(): void {
    this.#emitMetrics();
  }

  recordEvictions(keys: readonly string[]): void {
    if (this.#telemetry.recordEvicted(keys).length > 0) this.#emitMetrics();
  }

  snapshot(): PrefetchMetricsDetail {
    const connection = this.#connection;
    const online = navigator.onLine !== false;
    const saveData = typeof connection?.saveData === 'boolean' ? connection.saveData : null;
    const effectiveType = typeof connection?.effectiveType === 'string' ? connection.effectiveType : null;
    const network = this.#networkPolicy();
    const telemetry = this.#telemetry.snapshot();
    return Object.freeze({
      schemaVersion: 1,
      kind: 'pinega-intent-prefetch-metrics',
      policy: Object.freeze({
        hoverDelayMs: HOVER_PREFETCH_DELAY_MS,
        maxConcurrent: DEFAULT_PREFETCH_MAX_CONCURRENCY,
        maxQueued: DEFAULT_PREFETCH_MAX_QUEUE,
        slowEffectiveTypes: SLOW_EFFECTIVE_CONNECTION_TYPES,
        routePriority: 'low',
      }),
      network: Object.freeze({
        apiSupported: connection !== undefined,
        online,
        saveData,
        effectiveType,
        allowed: network.allowed,
        reason: network.reason,
      }),
      scheduler: this.#scheduler.snapshot(),
      ...telemetry,
    });
  }

  #handlePointerOver = (event: PointerEvent): void => {
    if (!event.isPrimary || event.buttons !== 0 || !['mouse', 'pen'].includes(event.pointerType)) return;
    const link = eventLink(event);
    if (!link || containsRelatedTarget(link, event.relatedTarget)) return;
    this.#cancelHoverIntent(link, false);
    const timer = window.setTimeout(() => {
      this.#hoverIntents.delete(link);
      this.#request(link, 'hover');
    }, HOVER_PREFETCH_DELAY_MS);
    this.#hoverIntents.set(link, { timer });
  };

  #handlePointerOut = (event: PointerEvent): void => {
    const link = eventLink(event);
    if (!link || containsRelatedTarget(link, event.relatedTarget)) return;
    this.#cancelHoverIntent(link, true);
  };

  #handlePointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0 || hasModifier(event)) return;
    const link = eventLink(event);
    if (!link) return;
    this.#cancelHoverIntent(link, false);
    this.#request(link, 'pointer');
  };

  #handleFocusIn = (event: FocusEvent): void => {
    const link = eventLink(event);
    if (!link) return;
    this.#cancelHoverIntent(link, false);
    this.#request(link, 'focus');
  };

  #handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.#emitMetrics();
      return;
    }
    this.#clearHoverIntents('hidden');
    this.#scheduler.clear('hidden');
    this.#emitMetrics();
  };

  #handleNetworkChange = (): void => {
    const policy = this.#networkPolicy();
    if (!policy.allowed) {
      this.#clearHoverIntents(policy.reason);
      this.#scheduler.clear(`policy:${policy.reason}`);
    }
    this.#emitMetrics();
  };

  #handlePageHide = (event: PageTransitionEvent): void => {
    if (event.persisted) return;
    this.#clearHoverIntents('document-discard');
    this.#scheduler.clear('document-discard');
  };

  #request(link: HTMLAnchorElement | HTMLAreaElement, signal: PrefetchIntentSignal): void {
    const decision = this.#classify(link);
    if (decision.action === 'skip') {
      this.#telemetry.recordIntent(signal, `skipped:${decision.reason}`);
      this.#emitMetrics();
      return;
    }
    if (document.visibilityState !== 'visible') {
      this.#telemetry.recordIntent(signal, 'skipped:hidden');
      this.#emitMetrics();
      return;
    }
    const network = this.#networkPolicy();
    if (!network.allowed) {
      this.#telemetry.recordIntent(signal, `skipped:${network.reason}`);
      this.#emitMetrics();
      return;
    }

    const target = new URL(decision.url);
    const key = routeCacheKey(this.#options.activeBuildId(), target, location.origin);
    const scheduledState = this.#scheduler.state(key);
    if (scheduledState === 'none') {
      const routeState = this.#options.routeState(key);
      if (routeState !== 'cold') {
        this.#telemetry.recordIntent(signal, `skipped:${routeState}`);
        this.#emitMetrics();
        return;
      }
    }

    const result = this.#scheduler.schedule(key, signal, async abortSignal => {
      const loaded = await this.#options.load(target, key, abortSignal);
      this.#telemetry.recordCompleted(key, loaded);
      this.#telemetry.recordEvicted(loaded.evictedKeys);
      this.#emitMetrics();
      return loaded;
    });
    this.#telemetry.recordIntent(signal, result.status === 'rejected' ? 'rejected:queue-full' : result.status);
    this.#emitMetrics();
  }

  #classify(link: HTMLAnchorElement | HTMLAreaElement): ReturnType<typeof classifyPrefetchIntent> {
    const sourceKind: NavigationSourceKind = link instanceof HTMLAnchorElement ? 'anchor' : 'area';
    const fallbackTarget = this.#options.fallbackTarget();
    const intent: PrefetchIntent = {
      currentUrl: location.href,
      activeDocumentUrl: this.#options.activeDocumentUrl(),
      destinationUrl: link.href,
      sourceKind,
      downloadRequested: link.hasAttribute('download'),
      hasTarget: link.hasAttribute('target'),
      disabled: link.matches('[aria-disabled="true"]') || link.closest('[inert]') !== null,
      ...(fallbackTarget ? { fallbackTarget } : {}),
    };
    return classifyPrefetchIntent(intent);
  }

  #networkPolicy(): PrefetchNetworkDecision {
    return classifyPrefetchNetworkPolicy({
      online: navigator.onLine !== false,
      saveData: this.#connection?.saveData === true,
      ...(this.#connection?.effectiveType ? { effectiveType: this.#connection.effectiveType } : {}),
    });
  }

  #cancelHoverIntent(link: HTMLAnchorElement | HTMLAreaElement, recordCancellation: boolean): void {
    const intent = this.#hoverIntents.get(link);
    if (!intent) return;
    clearTimeout(intent.timer);
    this.#hoverIntents.delete(link);
    if (recordCancellation) {
      this.#telemetry.recordIntent('hover', 'cancelled:dwell');
      this.#emitMetrics();
    }
  }

  #clearHoverIntents(reason: string): void {
    if (this.#hoverIntents.size === 0) return;
    for (const intent of this.#hoverIntents.values()) clearTimeout(intent.timer);
    const count = this.#hoverIntents.size;
    this.#hoverIntents.clear();
    for (let index = 0; index < count; index += 1) {
      this.#telemetry.recordIntent('hover', `cancelled:${reason}`);
    }
  }

  #emitMetrics(): void {
    const detail = this.snapshot();
    window.__PINEGA_PREFETCH_METRICS__ = detail;
    document.documentElement.dataset.pinegaPrefetchPolicy = detail.network.allowed ? 'allowed' : detail.network.reason;
    window.dispatchEvent(new CustomEvent<PrefetchMetricsDetail>('pinega:prefetch-metrics', { detail }));
  }
}

function networkInformation(): NetworkInformationLike | undefined {
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

function eventLink(event: Event): HTMLAnchorElement | HTMLAreaElement | undefined {
  for (const target of event.composedPath()) {
    if (target instanceof HTMLAnchorElement || target instanceof HTMLAreaElement) return target;
    if (target instanceof Element) {
      const link = target.closest<HTMLAnchorElement | HTMLAreaElement>('a[href], area[href]');
      if (link) return link;
    }
  }
  return undefined;
}

function containsRelatedTarget(
  link: HTMLAnchorElement | HTMLAreaElement,
  relatedTarget: EventTarget | null,
): boolean {
  return relatedTarget instanceof Node && link.contains(relatedTarget);
}

function hasModifier(event: PointerEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}
