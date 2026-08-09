import { normalizeRouteUrl } from '../../navigation/contract.mjs';
import {
  classifyNavigationIntent,
  type NavigationIntent,
  type NavigationSourceKind,
} from '../../navigation/policy.mjs';
import {
  NavigationTransactionGate,
  type NavigationTransaction,
} from '../../navigation/transaction-gate.mjs';
import { prepareWebAwesomeLocale } from '../vendor/webawesome/runtime.js';
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
  readonly #transactions = new NavigationTransactionGate();
  #active: ActiveRouteState;
  #activeDocumentUrl: string;
  #fallbackTarget: string | undefined;
  #started = false;

  constructor(navigation: Navigation, active: ActiveRouteState) {
    this.#navigation = navigation;
    this.#active = active;
    this.#activeDocumentUrl = normalizeRouteUrl(location.href, location.origin);
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
      return;
    }
    if (decision.action === 'cancel') {
      this.#transactions.invalidate();
      event.preventDefault();
      return;
    }

    const transaction = this.#transactions.begin(event.signal);
    const target = new URL(decision.url);
    try {
      event.intercept({
        focusReset: 'manual',
        scroll: 'after-transition',
        handler: () => this.#navigate(event, target, transaction),
      });
    } catch (error) {
      console.error('Pinega could not intercept an eligible navigation; the browser will retain native handling.', error);
    }
  };

  async #navigate(event: NavigateEvent, target: URL, transaction: NavigationTransaction): Promise<void> {
    try {
      const response = await fetch(target.href, {
        method: 'GET',
        credentials: 'same-origin',
        redirect: 'follow',
        headers: { Accept: 'text/html' },
        signal: event.signal,
      });
      if (!this.#transactions.isCurrent(transaction)) return;

      const envelopeFailure = classifyResponseEnvelope(response, target);
      if (envelopeFailure) {
        this.#hardNavigate(transaction, target, envelopeFailure);
        return;
      }

      const html = await response.text();
      if (!this.#transactions.isCurrent(transaction)) return;
      if (!html) {
        this.#hardNavigate(transaction, target, 'missing-body');
        return;
      }

      const prepared = prepareRouteDocument(html, target.href, this.#active);
      if (!this.#transactions.isCurrent(transaction)) return;
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
      const plan = createRouteCommitPlan(prepared, document);
      if (!this.#transactions.isCurrent(transaction)) return;

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
          navigationPolicy: 'enhanced',
        };
        this.#activeDocumentUrl = normalizeRouteUrl(target, location.origin);
        if (event.navigationType !== 'traverse') nextMain.focus({ preventScroll: true });
        return {
          url: target.href,
          routeId: prepared.routeId,
          locale: prepared.locale,
          navigationType: event.navigationType,
        } satisfies NavigationCommitDetail;
      });
      if (outcome.committed) {
        window.dispatchEvent(new CustomEvent<NavigationCommitDetail>('pinega:navigation-commit', { detail: outcome.value }));
      }
    } catch (error) {
      if (!this.#transactions.isCurrent(transaction) || isAbortError(error)) return;
      const reason = error instanceof RoutePreparationError ? error.reason : 'unknown';
      this.#hardNavigate(transaction, target, reason);
    }
  }

  #hardNavigate(transaction: NavigationTransaction, target: URL, reason: HardFallbackReason): void {
    this.#transactions.commit(transaction, () => {
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
