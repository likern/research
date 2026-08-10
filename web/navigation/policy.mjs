import { normalizeRouteUrl } from './contract.mjs';

const linkSources = new Set(['anchor', 'area']);
const interceptedNavigationTypes = new Set(['push', 'replace']);

export function classifyNavigationIntent(intent) {
  if (!intent || typeof intent !== 'object') throw new TypeError('Navigation intent must be an object.');

  let current;
  let activeDocumentIdentity;
  let destination;
  try {
    current = new URL(intent.currentUrl);
    destination = new URL(intent.destinationUrl, current);
    activeDocumentIdentity = normalizeRouteUrl(intent.activeDocumentUrl, current.origin);
  } catch {
    return native('invalid-url');
  }

  if (!['http:', 'https:'].includes(destination.protocol) || destination.username || destination.password) {
    return native('non-http');
  }
  if (destination.origin !== current.origin) return native('cross-origin');
  if (intent.canIntercept !== true) return native('cannot-intercept');

  const destinationIdentity = normalizeRouteUrl(destination, current.origin);
  if (intent.fallbackTarget) {
    try {
      if (normalizeRouteUrl(intent.fallbackTarget, current.origin) === destinationIdentity) {
        return native('fallback-guard');
      }
    } catch {
      // A corrupt optional guard must not make an otherwise valid link unsafe.
    }
  }

  if (intent.navigationType === 'reload') return native('reload');
  if (intent.hashChange === true && destinationIdentity === activeDocumentIdentity) return native('fragment');
  if (intent.downloadRequested === true) return native('download');
  if (intent.hasFormData === true || intent.sourceKind === 'form') return native('form');

  if (intent.navigationType === 'traverse') {
    return destinationIdentity === activeDocumentIdentity
      ? native('active-document-traverse')
      : intercept(destination.href);
  }
  if (!interceptedNavigationTypes.has(intent.navigationType)) return native('navigation-type');
  if (!linkSources.has(intent.sourceKind)) return native('source');
  if (intent.hasTarget === true) return native('target');

  if (destination.href === current.href && destinationIdentity === activeDocumentIdentity) {
    return intent.cancelable === true
      ? { action: 'cancel', reason: 'active-route', url: destination.href }
      : native('active-route-not-cancelable');
  }

  return intercept(destination.href);
}

export function classifyPrefetchIntent(intent) {
  if (!intent || typeof intent !== 'object') throw new TypeError('Prefetch intent must be an object.');

  let current;
  let activeDocumentIdentity;
  let destination;
  try {
    current = new URL(intent.currentUrl);
    destination = new URL(intent.destinationUrl, current);
    activeDocumentIdentity = normalizeRouteUrl(intent.activeDocumentUrl, current.origin);
  } catch {
    return skipPrefetch('invalid-url');
  }

  if (!['http:', 'https:'].includes(destination.protocol)) return skipPrefetch('non-http');
  if (destination.username || destination.password) return skipPrefetch('url-credentials');
  if (destination.origin !== current.origin) return skipPrefetch('cross-origin');

  const destinationIdentity = normalizeRouteUrl(destination, current.origin);
  if (intent.fallbackTarget) {
    try {
      if (normalizeRouteUrl(intent.fallbackTarget, current.origin) === destinationIdentity) {
        return skipPrefetch('fallback-guard');
      }
    } catch {
      // A corrupt optional guard must not make an otherwise valid link unsafe.
    }
  }

  if (!linkSources.has(intent.sourceKind)) return skipPrefetch('source');
  if (intent.downloadRequested === true) return skipPrefetch('download');
  if (intent.hasTarget === true) return skipPrefetch('target');
  if (intent.disabled === true) return skipPrefetch('disabled');
  if (destinationIdentity === activeDocumentIdentity) return skipPrefetch('active-route');

  return { action: 'prefetch', reason: 'eligible', url: destination.href };
}

function native(reason) {
  return { action: 'native', reason };
}

function intercept(url) {
  return { action: 'intercept', reason: 'eligible', url };
}

function skipPrefetch(reason) {
  return { action: 'skip', reason };
}
