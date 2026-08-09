import { normalizeRouteUrl } from '../../navigation/contract.mjs';
import {
  classifyNavigationIntent,
  type NavigationIntent,
  type NavigationSourceKind,
} from '../../navigation/policy.mjs';
import {
  RoutePreparationError,
  commitRoute,
  createRouteCommitPlan,
  prepareRouteDocument,
  readActiveRouteState,
  type ActiveRouteState,
} from './route-document.js';

const fallbackStorageKey = 'pinega-navigation-hard-fallback-v1';

type HardFallbackReason =
  | 'build-mismatch'
  | 'content-type'
  | 'http-status'
  | 'locale-mismatch'
  | 'malformed-contract'
  | 'missing-body'
  | 'redirect'
  | 'response-url'
  | 'route-policy'
  | 'unknown';

interface NavigationCommitDetail {
  url: string;
  routeId: string;
  navigationType: NavigationType;
}

interface NavigationFallbackDetail {
  url: string;
  reason: HardFallbackReason;
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
    return coordinator;
  } catch (error) {
    root.dataset.pinegaNavigation = 'error';
    console.error('Pinega navigation coordinator could not start.', error);
    return undefined;
  }
}

export class NavigationCoordinator {
  readonly #navigation: Navigation;
  #active: ActiveRouteState;
  #serial = 0;
  #fallbackTarget: string | undefined;
  #started = false;

  constructor(navigation: Navigation, active: ActiveRouteState) {
    this.#navigation = navigation;
    this.#active = active;
  }

  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#navigation.addEventListener('navigate', this.#handleNavigate);
  }

  #handleNavigate = (event: NavigateEvent): void => {
    const source = describeSource(event.sourceElement);
    const fallbackTarget = this.#currentFallbackTarget();
    const intent: NavigationIntent = {
      currentUrl: location.href,
      destinationUrl: event.destination.url,
      currentLanguage: this.#active.language,
      navigationType: event.navigationType,
      sourceKind: source.kind,
      canIntercept: event.canIntercept,
      cancelable: event.cancelable,
      hashChange: event.hashChange,
      downloadRequested: event.downloadRequest !== null || source.download,
      hasFormData: event.formData !== null,
      hasTarget: source.hasTarget,
      ...(source.language ? { sourceLanguage: source.language } : {}),
      ...(fallbackTarget ? { fallbackTarget } : {}),
    };
    const decision = classifyNavigationIntent(intent);

    if (decision.action === 'native') return;
    if (decision.action === 'cancel') {
      event.preventDefault();
      return;
    }

    const serial = ++this.#serial;
    const target = new URL(decision.url);
    try {
      event.intercept({
        handler: () => this.#navigate(event, target, serial),
      });
    } catch (error) {
      console.error('Pinega could not intercept an eligible navigation; the browser will retain native handling.', error);
    }
  };

  async #navigate(event: NavigateEvent, target: URL, serial: number): Promise<void> {
    try {
      const response = await fetch(target.href, {
        method: 'GET',
        credentials: 'same-origin',
        redirect: 'follow',
        headers: { Accept: 'text/html' },
        signal: event.signal,
      });
      if (this.#superseded(event, serial)) return;

      const envelopeFailure = classifyResponseEnvelope(response, target);
      if (envelopeFailure) {
        this.#hardNavigate(target, envelopeFailure);
        return;
      }

      const html = await response.text();
      if (this.#superseded(event, serial)) return;
      if (!html) {
        this.#hardNavigate(target, 'missing-body');
        return;
      }

      const prepared = prepareRouteDocument(html, target.href, this.#active);
      if (this.#superseded(event, serial)) return;
      const plan = createRouteCommitPlan(prepared, document);
      if (this.#superseded(event, serial)) return;

      commitRoute(plan);
      this.#active = {
        buildId: prepared.buildId,
        contractVersion: prepared.contractVersion,
        shellVersion: prepared.shellVersion,
        routeId: prepared.routeId,
        language: prepared.language,
        locale: prepared.locale,
        navigationPolicy: 'enhanced',
      };
      const detail: NavigationCommitDetail = {
        url: target.href,
        routeId: prepared.routeId,
        navigationType: event.navigationType,
      };
      window.dispatchEvent(new CustomEvent<NavigationCommitDetail>('pinega:navigation-commit', { detail }));
    } catch (error) {
      if (this.#superseded(event, serial) || isAbortError(error)) return;
      const reason = error instanceof RoutePreparationError ? error.reason : 'unknown';
      this.#hardNavigate(target, reason);
    }
  }

  #superseded(event: NavigateEvent, serial: number): boolean {
    return event.signal.aborted || serial !== this.#serial;
  }

  #hardNavigate(target: URL, reason: HardFallbackReason): void {
    const identity = normalizeRouteUrl(target, location.origin);
    this.#fallbackTarget = identity;
    writeFallbackGuard(identity);
    const detail: NavigationFallbackDetail = { url: target.href, reason };
    window.dispatchEvent(new CustomEvent<NavigationFallbackDetail>('pinega:navigation-fallback', { detail }));

    if (normalizeRouteUrl(location.href, location.origin) === identity) {
      location.reload();
    } else {
      location.replace(target.href);
    }
  }

  #currentFallbackTarget(): string | undefined {
    return this.#fallbackTarget ?? readFallbackGuard();
  }
}

function describeSource(source: Element | null): {
  kind: NavigationSourceKind;
  language?: string;
  hasTarget: boolean;
  download: boolean;
} {
  if (source instanceof HTMLAnchorElement) {
    return {
      kind: 'anchor',
      hasTarget: source.hasAttribute('target'),
      download: source.hasAttribute('download'),
      ...(source.hreflang ? { language: source.hreflang } : {}),
    };
  }
  if (source instanceof HTMLAreaElement) {
    const language = source.getAttribute('hreflang') ?? '';
    return {
      kind: 'area',
      hasTarget: source.hasAttribute('target'),
      download: source.hasAttribute('download'),
      ...(language ? { language } : {}),
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
