export const DOCUMENT_CONTRACT_VERSION = '1';
export const SHELL_VERSION = '4.0';
export const BUILD_ID_ALGORITHM = 'sha256-normalized-artifact-v1';
export const BUILD_ID_PLACEHOLDER = '__PINEGA_BUILD_ID__';

export const NATIVE_NAVIGATION_ROUTE_IDS = Object.freeze([
  'component-lab',
  'not-found',
]);

export const ROUTE_FEATURE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'benchmark',
    element: 'pinega-benchmark',
    loading: 'critical',
    implementation: 'native',
  }),
  Object.freeze({
    id: 'code-example',
    element: 'pinega-code-example',
    loading: 'deferred',
    implementation: 'native',
  }),
  Object.freeze({
    id: 'diagram-viewer',
    element: 'pinega-diagram-viewer',
    loading: 'viewport',
    implementation: 'lit',
  }),
  Object.freeze({
    id: 'doc-topic-filter',
    element: 'pinega-doc-search',
    loading: 'deferred',
    implementation: 'native',
  }),
]);

export const SHELL_CUSTOM_ELEMENTS = Object.freeze([
  'pinega-evidence',
  'pinega-hero',
  'pinega-site-header',
]);

export const ROUTE_OWNED_METADATA = Object.freeze([
  'title',
  'meta[name="description"]',
  'meta[name="robots"]',
  'link[rel="canonical"]',
  'link[rel="alternate"][hreflang]',
  'meta[property^="og:"]',
  'meta[name^="twitter:"]',
  'html[lang][dir][data-page][data-locale]',
  'body[data-pinega-route]',
  'pinega-site-header [data-pinega-language-switcher]',
  'pinega-site-header [data-translation-notice]',
  'pinega-site-header .pinega-brand[aria-current="page"]',
  '[data-primary-navigation] [aria-current="page"]',
]);

const featureByElement = new Map(ROUTE_FEATURE_DEFINITIONS.map(feature => [feature.element, feature]));
const featureById = new Map(ROUTE_FEATURE_DEFINITIONS.map(feature => [feature.id, feature]));
const shellElements = new Set(SHELL_CUSTOM_ELEMENTS);

export function classifyPinegaElement(elementName) {
  const feature = featureByElement.get(elementName);
  if (feature) return { kind: 'route-feature', feature };
  if (shellElements.has(elementName)) return { kind: 'shell' };
  return { kind: 'unknown' };
}

export function featureDefinition(featureId) {
  return featureById.get(featureId);
}

export function normalizeRouteUrl(input, siteOrigin) {
  const origin = new URL(siteOrigin);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new TypeError(`Invalid site origin: ${JSON.stringify(siteOrigin)}`);
  }

  const url = new URL(input, origin);
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError(`Route URL must use HTTP(S): ${url.href}`);
  if (url.origin !== origin.origin) throw new TypeError(`Route URL must remain on ${origin.origin}: ${url.href}`);
  if (url.username || url.password) throw new TypeError('Route URL must not contain credentials.');

  url.hash = '';
  return url.href;
}

export function routeCacheKey(buildId, input, siteOrigin) {
  if (!isBuildId(buildId)) throw new TypeError(`Invalid build ID: ${JSON.stringify(buildId)}`);
  return `${buildId}\u0000${normalizeRouteUrl(input, siteOrigin)}`;
}

export function parseFeatureList(value) {
  if (typeof value !== 'string') throw new TypeError('Feature list must be a string.');
  const features = value.trim() === '' ? [] : value.trim().split(/\s+/u);
  if (new Set(features).size !== features.length) throw new TypeError(`Feature list contains duplicates: ${JSON.stringify(value)}`);
  const canonical = [...features].sort();
  if (features.some((feature, index) => feature !== canonical[index])) {
    throw new TypeError(`Feature list must use canonical lexical order: ${JSON.stringify(value)}`);
  }
  for (const feature of features) {
    if (!featureById.has(feature)) throw new TypeError(`Unknown route feature: ${JSON.stringify(feature)}`);
  }
  return features;
}

export function isBuildId(value, { allowPlaceholder = false } = {}) {
  return typeof value === 'string' && (
    /^sha256-[a-f0-9]{64}$/u.test(value) ||
    (allowPlaceholder && value === BUILD_ID_PLACEHOLDER)
  );
}
