import { normalizeRouteUrl, routeCacheKey } from '../../navigation/contract.mjs';
import {
  classifyNavigationIntent,
  type NavigationIntent,
  type NavigationSourceKind,
} from '../../navigation/policy.mjs';
import {
  NavigationTransactionGate,
  type NavigationTransaction,
} from '../../navigation/transaction-gate.mjs';
import {
  InFlightRoutePreparations,
  NativeRouteCache,
  responseAllowsRouteCache,
  type RouteCacheSnapshot,
} from '../../navigation/route-cache.mjs';
import { prepareWebAwesomeLocale } from '../vendor/webawesome/runtime.js';
import {
  RoutePreparationError,
  commitRoute,
  createRouteCommitPlan,
  prepareActiveRouteDocument,
  prepareRouteDocument,
  readActiveRouteState,
  type ActiveRouteState,
  type PreparedRoute,
} from './route-document.js';

const fallbackStorageKey = 'pinega-navigation-hard-fallback-v1';

type HardFallbackReason =
  | 'build-mismatch'
  | 'content-type'
  | 'http-status'
  | 'locale-runtime'
  | 'malformed-contract'
  | 'missing-body'
  | 'redirect'
  | 'response-url'
  | 'route-policy'
  | 'unknown';

interface NavigationCommitDetail {
  url: string;
  routeId: string;
  locale: string;
  navigationType: NavigationType;
  preparation: NavigationPreparationDetail;
  cache: NavigationCacheDetail;
}

interface NavigationFallbackDetail {
  url: string;
  reason: HardFallbackReason;
}

interface PendingAbortSubscription {
  serial: number;
  signal: AbortSignal;
  listener: () => void;
}

interface RememberedScrollPosition {
  left: number;
  top: number;
}

type NavigationPreparationSource = 'cache' | 'in-flight' | 'network';

interface PreparedNavigation {
  prepared: PreparedRoute;
  cacheable: boolean;
  networkMs: number;
  parseMs: number;
}

interface NavigationPreparationDetail {
  source: NavigationPreparationSource;
  networkRequests: 0 | 1;
  parseCalls: 0 | 1;
  materializeCalls: 1;
  networkMs: number;
  parseMs: number;
  materializeMs: number;
  commitMs: number;
  sourceBytes: number;
  nodeCount: number;
  weightBytes: number;
}

interface NavigationCacheDetail {
  stored: boolean;
  entries: number;
  weightBytes: number;
  maxEntries: number;
  maxWeightBytes: number;
  evictedEntries: number;
}

class NavigationPreparationError extends Error {
  readonly reason: HardFallbackReason;

  constructor(reason: HardFallbackReason, message: string) {
    super(message);
    this.name = 'NavigationPreparationError';
    this.reason = reason;
  }
}

export function initializeNavigationCoordinator(): NavigationCoordinator | undefined {
  const root = document.documentElement;
  if (window.__PINEGA_DISABLE_NAVIGATION__ === true) {
    root.dataset.pinegaNavigation = 'disabled';
    return undefined;
  }
  if (
    !('navigation' in window) ||
    typeof window.navigation?.addEventListener !== 'function' ||
    typeof NavigateEvent === 'undefined' ||
    typeof NavigateEvent.prototype.intercept !== 'function'
  ) {
    root.dataset.pinegaNavigation = 'native';
    return undefined;
  }

  try {
    const active = readActiveRouteState(document);
    clearArrivedFallbackGuard(location.href);
    if (active.navigationPolicy === 'native') {
      root.dataset.pinegaNavigation = 'native-policy';
      return undefined;
    }
    const coordinator = new NavigationCoordinator(window.navigation, active);
    coordinator.start();
    root.dataset.pinegaNavigation = 'enhanced';
    root.dataset.pinegaRouteCache = 'native-lru';
    return coordinator;
  } catch (error) {
    root.dataset.pinegaNavigation = 'error';
    console.error('Pinega navigation coordinator could not start.', error);
    return undefined;
  }
}

export class NavigationCoordinator {
  readonly #navigation: Navigation;
  readonly #transactions = new NavigationTransactionGate();
  readonly #cache = new NativeRouteCache<PreparedRoute>();
  readonly #preparations = new InFlightRoutePreparations<PreparedNavigation>();
  readonly #scrollPositions = new Map<string, RememberedScrollPosition>();
  readonly #scrollDisposalKeys = new Set<string>();
  #active: ActiveRouteState;
  #activeDocumentUrl: string;
  #fallbackTarget: string | undefined;
  #pendingAbort: PendingAbortSubscription | undefined;
  #started = false;

  constructor(navigation: Navigation, active: ActiveRouteState) {
    this.#navigation = navigation;
    this.#active = active;
    this.#activeDocumentUrl = normalizeRouteUrl(location.href, location.origin);
    if (window.__PINEGA_INITIAL_RESPONSE_NO_STORE__ !== true) {
      const bootRoute = prepareActiveRouteDocument(document, active);
      const bootKey = routeCacheKey(active.buildId, this.#activeDocumentUrl, location.origin);
      this.#cache.commitActive(bootKey, bootRoute, bootRoute.weightBytes);
    }
  }

  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#navigation.addEventListener('navigate', this.#handleNavigate);
  }

  #handleNavigate = (event: NavigateEvent): void => {
    this.#rememberActiveScrollPosition();
    const source = describeSource(event.sourceElement);
    const fallbackTarget = this.#currentFallbackTarget();
    const intent: NavigationIntent = {
      currentUrl: location.href,
      activeDocumentUrl: this.#activeDocumentUrl,
      destinationUrl: event.destination.url,
      navigationType: event.navigationType,
      sourceKind: source.kind,
      canIntercept: event.canIntercept,
      cancelable: event.cancelable,
      hashChange: event.hashChange,
      downloadRequested: event.downloadRequest !== null || source.download,
      hasFormData: event.formData !== null,
      hasTarget: source.hasTarget,
      ...(fallbackTarget ? { fallbackTarget } : {}),
    };
    const decision = classifyNavigationIntent(intent);

    if (decision.action === 'native') {
      this.#transactions.invalidate();
      this.#preparations.clear();
      this.#clearPending();
      return;
    }
    if (decision.action === 'cancel') {
      this.#transactions.invalidate();
      this.#preparations.clear();
      this.#clearPending();
      event.preventDefault();
      return;
    }

    const target = new URL(decision.url);
    const key = routeCacheKey(this.#active.buildId, target, location.origin);
    this.#preparations.abortExcept(key);
    const transaction = this.#transactions.begin(event.signal);
    try {
      event.intercept({
        focusReset: 'manual',
        scroll: 'manual',
        handler: () => this.#navigate(event, target, key, transaction),
      });
      this.#markPending(transaction);
    } catch (error) {
      this.#transactions.invalidate();
      this.#preparations.clear();
      this.#clearPending();
      console.error('Pinega could not intercept an eligible navigation; the browser will retain native handling.', error);
    }
  };

  async #navigate(
    event: NavigateEvent,
    target: URL,
    key: string,
    transaction: NavigationTransaction,
  ): Promise<void> {
    try {
      const cached = this.#cache.peek(key);
      let result: PreparedNavigation;
      let source: NavigationPreparationSource;
      if (cached) {
        result = { prepared: cached, cacheable: true, networkMs: 0, parseMs: 0 };
        source = 'cache';
      } else {
        const acquisition = this.#preparations.acquire(key, signal => this.#fetchAndPrepare(target, signal));
        result = await acquisition.promise;
        source = acquisition.reused ? 'in-flight' : 'network';
      }
      if (!this.#transactions.isCurrent(transaction)) return;
      const { prepared } = result;
      this.#validatePreparedCompatibility(prepared);
      if (prepared.locale !== this.#active.locale) {
        try {
          await prepareWebAwesomeLocale(prepared.locale);
        } catch (error) {
          throw new RoutePreparationError(
            'locale-runtime',
            `Pinega could not prepare the ${JSON.stringify(prepared.locale)} locale runtime.`,
            { cause: error },
          );
        }
      }
      if (!this.#transactions.isCurrent(transaction)) return;
      const materializeStarted = performance.now();
      const plan = createRouteCommitPlan(prepared, document);
      const materializeMs = performance.now() - materializeStarted;
      if (!this.#transactions.isCurrent(transaction)) return;

      const commitStarted = performance.now();
      const outcome = this.#transactions.commit(transaction, () => {
        const nextMain = commitRoute(plan);
        document.documentElement.dataset.webawesomeLocale = prepared.locale;
        this.#active = {
          buildId: prepared.buildId,
          contractVersion: prepared.contractVersion,
          shellVersion: prepared.shellVersion,
          routeId: prepared.routeId,
          language: prepared.language,
          locale: prepared.locale,
          siteLocales: this.#active.siteLocales,
          defaultLocale: this.#active.defaultLocale,
          metadataOrigin: this.#active.metadataOrigin,
          navigationPolicy: 'enhanced',
        };
        this.#activeDocumentUrl = normalizeRouteUrl(target, location.origin);
        let stored: boolean;
        let evictedEntries: number;
        if (source === 'cache') {
          const activation = this.#cache.activate(key);
          stored = activation.activated;
          evictedEntries = activation.evictedKeys.length;
        } else if (result.cacheable) {
          const mutation = this.#cache.commitActive(key, prepared, prepared.weightBytes);
          stored = mutation.stored;
          evictedEntries = mutation.evictedKeys.length;
        } else {
          const mutation = this.#cache.deactivate();
          stored = false;
          evictedEntries = mutation.evictedKeys.length;
        }
        const cache = cacheDetail(this.#cache.snapshot(), stored, evictedEntries);
        this.#clearPending(transaction);
        applyPostCommitScroll(event, target, this.#rememberedDestinationScroll(event));
        if (event.navigationType !== 'traverse') nextMain.focus({ preventScroll: true });
        return {
          url: target.href,
          routeId: prepared.routeId,
          locale: prepared.locale,
          navigationType: event.navigationType,
          preparation: {
            source,
            networkRequests: source === 'cache' ? 0 : 1,
            parseCalls: source === 'cache' ? 0 : 1,
            materializeCalls: 1,
            networkMs: result.networkMs,
            parseMs: result.parseMs,
            materializeMs,
            commitMs: 0,
            sourceBytes: prepared.sourceBytes,
            nodeCount: prepared.nodeCount,
            weightBytes: prepared.weightBytes,
          },
          cache,
        } satisfies NavigationCommitDetail;
      });
      if (outcome.committed) {
        outcome.value.preparation.commitMs = performance.now() - commitStarted;
        window.dispatchEvent(new CustomEvent<NavigationCommitDetail>('pinega:navigation-commit', { detail: outcome.value }));
      }
    } catch (error) {
      if (!this.#transactions.isCurrent(transaction) || isAbortError(error)) return;
      const reason = error instanceof RoutePreparationError || error instanceof NavigationPreparationError
        ? error.reason
        : 'unknown';
      if (reason === 'build-mismatch') this.#cache.clear();
      this.#hardNavigate(transaction, target, reason);
    }
  }

  async #fetchAndPrepare(target: URL, signal: AbortSignal): Promise<PreparedNavigation> {
    const networkStarted = performance.now();
    const response = await fetch(target.href, {
      method: 'GET',
      credentials: 'same-origin',
      redirect: 'follow',
      headers: { Accept: 'text/html' },
      signal,
    });
    const envelopeFailure = classifyResponseEnvelope(response, target);
    if (envelopeFailure) {
      throw new NavigationPreparationError(envelopeFailure, `Route response failed the ${envelopeFailure} boundary.`);
    }
    const html = await response.text();
    const networkMs = performance.now() - networkStarted;
    if (!html) throw new NavigationPreparationError('missing-body', 'Route response has no HTML body.');

    const parseStarted = performance.now();
    const prepared = prepareRouteDocument(html, target.href, this.#active);
    const parseMs = performance.now() - parseStarted;
    return Object.freeze({
      prepared,
      cacheable: responseAllowsRouteCache(response.headers.get('cache-control')),
      networkMs,
      parseMs,
    });
  }

  #validatePreparedCompatibility(prepared: PreparedRoute): void {
    if (prepared.buildId !== this.#active.buildId || prepared.shellVersion !== this.#active.shellVersion) {
      this.#cache.clear();
      throw new RoutePreparationError('build-mismatch', 'Cached route build or shell is incompatible with the active document.');
    }
    if (prepared.contractVersion !== this.#active.contractVersion) {
      throw new RoutePreparationError('malformed-contract', 'Cached route document contract is incompatible with the active document.');
    }
  }

  #hardNavigate(transaction: NavigationTransaction, target: URL, reason: HardFallbackReason): void {
    this.#transactions.commit(transaction, () => {
      this.#preparations.clear();
      const identity = normalizeRouteUrl(target, location.origin);
      this.#fallbackTarget = identity;
      writeFallbackGuard(identity);
      const detail: NavigationFallbackDetail = { url: target.href, reason };
      window.dispatchEvent(new CustomEvent<NavigationFallbackDetail>('pinega:navigation-fallback', { detail }));

      if (normalizeRouteUrl(location.href, location.origin) === identity) {
        location.reload();
      } else {
        location.assign(target.href);
      }
    });
  }

  #currentFallbackTarget(): string | undefined {
    return this.#fallbackTarget ?? readFallbackGuard();
  }

  #rememberActiveScrollPosition(): void {
    const entry = this.#navigation.currentEntry;
    if (!entry) return;
    this.#scrollPositions.set(entry.key, { left: scrollX, top: scrollY });
    if (this.#scrollDisposalKeys.has(entry.key)) return;
    this.#scrollDisposalKeys.add(entry.key);
    entry.addEventListener('dispose', () => {
      this.#scrollPositions.delete(entry.key);
      this.#scrollDisposalKeys.delete(entry.key);
    }, { once: true });
  }

  #rememberedDestinationScroll(event: NavigateEvent): RememberedScrollPosition | undefined {
    if (event.navigationType !== 'traverse' || !event.destination.key) return undefined;
    return this.#scrollPositions.get(event.destination.key);
  }

  #markPending(transaction: NavigationTransaction): void {
    if (!this.#transactions.isCurrent(transaction)) return;
    this.#clearPending();
    const listener = (): void => this.#clearPending(transaction);
    this.#pendingAbort = { serial: transaction.serial, signal: transaction.signal, listener };
    transaction.signal.addEventListener('abort', listener, { once: true });
    if (transaction.signal.aborted) {
      this.#clearPending(transaction);
      return;
    }
    document.documentElement.dataset.pinegaNavigationPending = 'true';
    document.querySelector<HTMLElement>('main')?.setAttribute('aria-busy', 'true');
  }

  #clearPending(transaction?: NavigationTransaction): void {
    if (transaction && this.#pendingAbort?.serial !== transaction.serial) return;
    if (this.#pendingAbort) {
      this.#pendingAbort.signal.removeEventListener('abort', this.#pendingAbort.listener);
      this.#pendingAbort = undefined;
    }
    delete document.documentElement.dataset.pinegaNavigationPending;
    document.querySelector<HTMLElement>('main')?.removeAttribute('aria-busy');
  }
}

function cacheDetail(
  snapshot: RouteCacheSnapshot,
  stored: boolean,
  evictedEntries: number,
): NavigationCacheDetail {
  return {
    stored,
    entries: snapshot.entries,
    weightBytes: snapshot.weightBytes,
    maxEntries: snapshot.maxEntries,
    maxWeightBytes: snapshot.maxWeightBytes,
    evictedEntries,
  };
}

function applyPostCommitScroll(
  event: NavigateEvent,
  target: URL,
  remembered?: RememberedScrollPosition,
): void {
  event.scroll();
  if (event.navigationType === 'traverse' && remembered) {
    // A warm template can commit in the same task that starts a traversal.
    // Reapply the entry's observed viewport after the native restoration call
    // so WebKit does not leave an otherwise restorable warm entry at the top.
    window.scrollTo({ left: remembered.left, top: remembered.top, behavior: 'instant' });
  }
  if (event.navigationType === 'traverse' || !target.hash || hasFragmentScrollTarget(target.hash)) return;

  // WebKit can retain the previous entry's scroll offset when the destination
  // fragment does not exist. The HTML fallback for that case is the top of the
  // document, so normalize it synchronously after the destination DOM exists.
  window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
}

function hasFragmentScrollTarget(hash: string): boolean {
  const encodedFragment = hash.slice(1);
  if (!encodedFragment) return true;
  if (encodedFragment.includes(':~:text=')) return true;

  let fragment: string;
  try {
    fragment = decodeURIComponent(encodedFragment);
  } catch {
    return false;
  }
  if (fragment.toLowerCase() === 'top') return true;
  return document.getElementById(fragment) !== null || document.getElementsByName(fragment).length > 0;
}

function describeSource(source: Element | null): {
  kind: NavigationSourceKind;
  hasTarget: boolean;
  download: boolean;
} {
  if (source instanceof HTMLAnchorElement) {
    return {
      kind: 'anchor',
      hasTarget: source.hasAttribute('target'),
      download: source.hasAttribute('download'),
    };
  }
  if (source instanceof HTMLAreaElement) {
    return {
      kind: 'area',
      hasTarget: source.hasAttribute('target'),
      download: source.hasAttribute('download'),
    };
  }
  if (source instanceof HTMLFormElement || source?.closest('form')) {
    return { kind: 'form', hasTarget: source.hasAttribute('target'), download: false };
  }
  return { kind: source ? 'other' : 'none', hasTarget: false, download: false };
}

function classifyResponseEnvelope(response: Response, target: URL): HardFallbackReason | undefined {
  if (response.status < 200 || response.status >= 300) return 'http-status';
  if (response.redirected) return 'redirect';
  try {
    if (normalizeRouteUrl(response.url, location.origin) !== normalizeRouteUrl(target, location.origin)) return 'response-url';
  } catch {
    return 'response-url';
  }
  const mediaType = (response.headers.get('content-type') ?? '').split(';', 1)[0]?.trim().toLocaleLowerCase();
  return mediaType === 'text/html' ? undefined : 'content-type';
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function readFallbackGuard(): string | undefined {
  try {
    return sessionStorage.getItem(fallbackStorageKey) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeFallbackGuard(value: string): void {
  try {
    sessionStorage.setItem(fallbackStorageKey, value);
  } catch {
    // The in-memory guard still protects the active Document.
  }
}

function clearArrivedFallbackGuard(currentUrl: string): void {
  const guard = readFallbackGuard();
  if (!guard) return;
  try {
    if (normalizeRouteUrl(guard, location.origin) !== normalizeRouteUrl(currentUrl, location.origin)) return;
    sessionStorage.removeItem(fallbackStorageKey);
  } catch {
    // Storage and malformed stale guards are optional; native navigation still works.
  }
}
