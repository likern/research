import { parse } from 'parse5';

import {
  BUILD_ID_PLACEHOLDER,
  DOCUMENT_CONTRACT_VERSION,
  NATIVE_NAVIGATION_ROUTE_IDS,
  SHELL_VERSION,
  classifyPinegaElement,
  featureDefinition,
  isBuildId,
  normalizeRouteUrl,
  parseFeatureList,
} from '../../navigation/contract.mjs';

export function applyDocumentContract(html, route) {
  const { features, criticalFeatures } = deriveRouteFeatures(html);
  let output = addAttributes(html, 'html', {
    'data-pinega-contract': DOCUMENT_CONTRACT_VERSION,
    'data-pinega-build': BUILD_ID_PLACEHOLDER,
    'data-pinega-shell': SHELL_VERSION,
  });
  output = addAttributes(output, 'body', {
    'data-pinega-route': route.id,
  });
  output = addAttributes(output, 'main', {
    'data-pinega-route': route.id,
    'data-pinega-features': features.join(' '),
    'data-pinega-critical-features': criticalFeatures.join(' '),
  });
  return { html: output, features, criticalFeatures };
}

export function deriveRouteFeatures(html) {
  const document = parse(html);
  const main = exactlyOne(findElements(document, element => element.tagName === 'main'), 'main');
  const detected = new Set();
  for (const element of findElements(main, node => node.tagName?.startsWith('pinega-'))) {
    const classification = classifyPinegaElement(element.tagName);
    if (classification.kind === 'unknown') {
      throw new TypeError(`Unclassified Pinega custom element in route main: <${element.tagName}>`);
    }
    if (classification.kind === 'route-feature') detected.add(classification.feature.id);
  }
  const features = [...detected].sort();
  const criticalFeatures = features.filter(feature => featureDefinition(feature)?.loading === 'critical');
  return { features, criticalFeatures };
}

export function validateDocumentContract(html, expected = {}) {
  const document = parse(html);
  const root = exactlyOne(findElements(document, element => element.tagName === 'html'), 'html');
  const head = exactlyOne(findElements(root, element => element.tagName === 'head'), 'head');
  const body = exactlyOne(findElements(root, element => element.tagName === 'body'), 'body');
  const mains = findElements(body, element => element.tagName === 'main');
  const main = exactlyOne(mains, 'main');
  const titles = findElements(head, element => element.tagName === 'title');
  const title = textContent(exactlyOne(titles, 'title')).trim();
  if (!title) throw new TypeError('Document title must not be empty.');

  const rootAttributes = attributes(root);
  const bodyAttributes = attributes(body);
  const mainAttributes = attributes(main);
  const routeId = requiredAttribute(mainAttributes, 'data-pinega-route', 'main');
  if (!/^[a-z][a-z0-9-]*$/u.test(routeId)) throw new TypeError(`Invalid route ID: ${JSON.stringify(routeId)}`);
  if (rootAttributes.get('data-page') !== routeId) throw new TypeError('html[data-page] must equal main[data-pinega-route].');
  if (bodyAttributes.get('data-pinega-route') !== routeId) throw new TypeError('body[data-pinega-route] must equal main[data-pinega-route].');
  if (mainAttributes.get('id') !== 'main-content') throw new TypeError('Route main must use id="main-content".');
  if (mainAttributes.get('tabindex') !== '-1') throw new TypeError('Route main must use tabindex="-1" for focus transfer.');

  const contractVersion = requiredAttribute(rootAttributes, 'data-pinega-contract', 'html');
  const buildId = requiredAttribute(rootAttributes, 'data-pinega-build', 'html');
  const shellVersion = requiredAttribute(rootAttributes, 'data-pinega-shell', 'html');
  const language = requiredAttribute(rootAttributes, 'lang', 'html');
  const locale = requiredAttribute(rootAttributes, 'data-locale', 'html');
  const direction = requiredAttribute(rootAttributes, 'dir', 'html');
  if (contractVersion !== DOCUMENT_CONTRACT_VERSION) throw new TypeError(`Unsupported document contract ${JSON.stringify(contractVersion)}.`);
  if (shellVersion !== SHELL_VERSION) throw new TypeError(`Unsupported shell version ${JSON.stringify(shellVersion)}.`);
  if (!isBuildId(buildId, { allowPlaceholder: expected.allowBuildPlaceholder === true })) {
    throw new TypeError(`Invalid document build ID: ${JSON.stringify(buildId)}`);
  }
  if (language !== locale) throw new TypeError('html[lang] must equal html[data-locale] in the current locale model.');
  if (!['ltr', 'rtl'].includes(direction)) throw new TypeError(`Invalid document direction: ${JSON.stringify(direction)}`);

  const features = parseFeatureList(presentAttribute(mainAttributes, 'data-pinega-features', 'main'));
  const criticalFeatures = parseFeatureList(presentAttribute(mainAttributes, 'data-pinega-critical-features', 'main'));
  const derived = deriveRouteFeatures(html);
  assertSameList(features, derived.features, 'declared and detected route features');
  assertSameList(criticalFeatures, derived.criticalFeatures, 'declared and detected critical route features');
  for (const feature of criticalFeatures) {
    if (!features.includes(feature)) throw new TypeError(`Critical feature ${JSON.stringify(feature)} is not a route feature.`);
  }

  const descriptionNodes = findElements(head, element => element.tagName === 'meta' && attribute(element, 'name') === 'description');
  const description = requiredAttribute(attributes(exactlyOne(descriptionNodes, 'meta[name="description"]')), 'content', 'meta[name="description"]');
  const robotsNodes = findElements(head, element => element.tagName === 'meta' && attribute(element, 'name') === 'robots');
  if (robotsNodes.length > 1) throw new TypeError('Document contains more than one meta[name="robots"].');
  const robots = robotsNodes.length === 1
    ? requiredAttribute(attributes(robotsNodes[0]), 'content', 'meta[name="robots"]')
    : null;
  const canonicalNodes = findElements(head, element => element.tagName === 'link' && relIncludes(element, 'canonical'));
  if (canonicalNodes.length > 1) throw new TypeError('Document contains more than one canonical link.');
  const canonicalUrl = canonicalNodes.length === 1
    ? absoluteMetadataUrl(requiredAttribute(attributes(canonicalNodes[0]), 'href', 'canonical link'), expected.siteOrigin)
    : null;
  const alternateNodes = findElements(head, element => (
    element.tagName === 'link' && relIncludes(element, 'alternate') && attribute(element, 'hreflang') !== undefined
  ));
  const alternates = alternateNodes.map(element => ({
    language: requiredAttribute(attributes(element), 'hreflang', 'alternate link'),
    href: absoluteMetadataUrl(requiredAttribute(attributes(element), 'href', 'alternate link'), expected.siteOrigin),
  }));
  assertUnique(alternates.map(alternate => alternate.language), 'alternate hreflang');
  if (canonicalUrl) {
    const selfAlternate = alternates.find(alternate => alternate.language === language);
    if (!selfAlternate || selfAlternate.href !== canonicalUrl) throw new TypeError('Canonical routes require a matching self hreflang alternate.');
    if (!alternates.some(alternate => alternate.language === 'x-default')) throw new TypeError('Canonical routes require an x-default alternate.');
  } else if (alternates.length > 0) {
    throw new TypeError('Non-canonical routes must not publish hreflang alternates.');
  }

  const primaryNavigation = findElements(body, element => hasAttribute(element, 'data-primary-navigation'));
  if (primaryNavigation.length > 1) throw new TypeError('Document contains more than one primary navigation region.');
  const primaryCurrent = primaryNavigation.length === 0 ? [] : findElements(primaryNavigation[0], element => attribute(element, 'aria-current') === 'page');
  if (primaryCurrent.length > 1) throw new TypeError('Primary navigation contains more than one aria-current="page" item.');

  const siteHeaders = findElements(body, element => element.tagName === 'pinega-site-header');
  if (siteHeaders.length > 1) throw new TypeError('Document contains more than one pinega-site-header.');
  let shellCurrentHref = primaryCurrent.length === 1 ? attribute(primaryCurrent[0], 'href') ?? null : null;
  if (siteHeaders.length === 1) {
    const siteHeader = siteHeaders[0];
    if (findElements(main, element => element === siteHeader).length === 1) {
      throw new TypeError('pinega-site-header must remain outside route main.');
    }
    const languageSwitchers = findElements(siteHeader, element => hasAttribute(element, 'data-pinega-language-switcher'));
    if (languageSwitchers.length !== 1) {
      throw new TypeError(`pinega-site-header requires exactly one language switcher, found ${languageSwitchers.length}.`);
    }
    validateTranslationSlots(siteHeader, languageSwitchers[0]);
    const currentBrands = findElements(siteHeader, element => (
      element.tagName === 'a' && hasClass(element, 'pinega-brand') && attribute(element, 'aria-current') === 'page'
    ));
    if (currentBrands.length + primaryCurrent.length > 1) {
      throw new TypeError('Site header contains more than one route aria-current="page" item.');
    }
    if (currentBrands.length === 1) shellCurrentHref = requiredAttribute(attributes(currentBrands[0]), 'href', 'current Pinega brand');

    const siteFooters = findElements(body, element => element.tagName === 'footer' && hasClass(element, 'pinega-site-footer'));
    if (NATIVE_NAVIGATION_ROUTE_IDS.includes(routeId)) {
      if (siteFooters.length > 1) throw new TypeError('Native document contains more than one Pinega site footer.');
    } else {
      exactlyOne(siteFooters, 'pinega site footer');
    }
    const skipLinks = findElements(body, element => element.tagName === 'a' && hasClass(element, 'pinega-skip-link'));
    const skipLink = exactlyOne(skipLinks, 'pinega skip link');
    if (attribute(skipLink, 'href') !== '#main-content' || !textContent(skipLink).trim()) {
      throw new TypeError('Pinega skip link must name and target main#main-content.');
    }
    const announcers = findElements(body, element => hasAttribute(element, 'data-pinega-navigation-announcer'));
    const announcer = exactlyOne(announcers, 'pinega navigation announcer');
    const announcerAttributes = attributes(announcer);
    if (
      announcerAttributes.get('role') !== 'status' ||
      announcerAttributes.get('aria-live') !== 'polite' ||
      announcerAttributes.get('aria-atomic') !== 'true' ||
      textContent(announcer).trim()
    ) {
      throw new TypeError('Pinega navigation announcer must be an empty polite atomic status region.');
    }
  }
  const openGraph = metadataMap(head, 'property', value => value.startsWith('og:'));
  const twitter = metadataMap(head, 'name', value => value.startsWith('twitter:'));
  const result = {
    contractVersion,
    shellVersion,
    buildId,
    routeId,
    language,
    locale,
    direction,
    title,
    description,
    robots,
    canonicalUrl,
    alternates,
    openGraph,
    twitter,
    features,
    criticalFeatures,
    primaryNavigationCurrentHref: primaryCurrent.length === 1 ? attribute(primaryCurrent[0], 'href') ?? null : null,
    shellCurrentHref,
  };
  assertExpected(result, expected);
  return result;
}

export function classifyNavigationResponse(response, current) {
  try {
    if (!response || typeof response !== 'object') throw new TypeError('Navigation response descriptor must be an object.');
    if (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300) {
      return fallback('http-status');
    }
    if (response.redirected === true) return fallback('redirect');
    const requestUrl = normalizeRouteUrl(response.requestUrl, current.siteOrigin);
    const responseUrl = normalizeRouteUrl(response.responseUrl, current.siteOrigin);
    if (requestUrl !== responseUrl) return fallback('response-url');
    const mediaType = String(response.contentType ?? '').split(';', 1)[0].trim().toLowerCase();
    if (mediaType !== 'text/html') return fallback('content-type');
    if (typeof response.body !== 'string') return fallback('missing-body');
    const contract = validateDocumentContract(response.body, { siteOrigin: current.siteOrigin });
    if (contract.buildId !== current.buildId || contract.shellVersion !== current.shellVersion) {
      return fallback('build-mismatch');
    }
    return { outcome: 'prepared', contract };
  } catch (error) {
    return { outcome: 'hard-navigation', reason: 'malformed-contract', error };
  }
}

function fallback(reason) {
  return { outcome: 'hard-navigation', reason };
}

function addAttributes(html, tagName, values) {
  const expression = new RegExp(`<${tagName}\\b([^>]*)>`, 'u');
  const matches = [...html.matchAll(new RegExp(expression.source, 'gu'))];
  if (matches.length !== 1) throw new TypeError(`Expected exactly one <${tagName}> opening tag, found ${matches.length}.`);
  return html.replace(expression, (match, sourceAttributes) => {
    for (const name of Object.keys(values)) {
      if (new RegExp(`\\s${escapeRegex(name)}(?:\\s*=|\\s|$)`, 'u').test(sourceAttributes)) {
        throw new TypeError(`<${tagName}> already defines ${name}.`);
      }
    }
    const rendered = Object.entries(values).map(([name, value]) => `${name}="${escapeAttribute(value)}"`).join(' ');
    return `<${tagName}${sourceAttributes} ${rendered}>`;
  });
}

function findElements(node, predicate, output = []) {
  if (node?.tagName && predicate(node)) output.push(node);
  for (const child of node?.childNodes ?? []) findElements(child, predicate, output);
  return output;
}

function exactlyOne(values, label) {
  if (values.length !== 1) throw new TypeError(`Expected exactly one ${label}, found ${values.length}.`);
  return values[0];
}

function attributes(element) {
  return new Map((element?.attrs ?? []).map(item => [item.name, item.value]));
}

function attribute(element, name) {
  return attributes(element).get(name);
}

function hasAttribute(element, name) {
  return attributes(element).has(name);
}

function hasClass(element, name) {
  return (attribute(element, 'class') ?? '').split(/\s+/u).includes(name);
}

function requiredAttribute(values, name, element) {
  const value = values.get(name);
  if (value === undefined || value === '') throw new TypeError(`${element} requires a non-empty ${name} attribute.`);
  return value;
}

function presentAttribute(values, name, element) {
  const value = values.get(name);
  if (value === undefined) throw new TypeError(`${element} requires a ${name} attribute.`);
  return value;
}

function relIncludes(element, token) {
  return (attribute(element, 'rel') ?? '').toLowerCase().split(/\s+/u).includes(token);
}

function textContent(node) {
  if (node?.nodeName === '#text') return node.value ?? '';
  return (node?.childNodes ?? []).map(textContent).join('');
}

function metadataMap(head, attributeName, predicate) {
  const values = {};
  for (const element of findElements(head, node => node.tagName === 'meta')) {
    const name = attribute(element, attributeName);
    if (!name || !predicate(name)) continue;
    if (Object.hasOwn(values, name)) throw new TypeError(`Duplicate metadata field ${JSON.stringify(name)}.`);
    values[name] = requiredAttribute(attributes(element), 'content', `meta[${attributeName}="${name}"]`);
  }
  return values;
}

function absoluteMetadataUrl(value, siteOrigin) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new TypeError(`Invalid route metadata URL: ${JSON.stringify(value)}`);
  }
  if (siteOrigin && url.origin !== new URL(siteOrigin).origin) {
    throw new TypeError(`Route metadata URL must remain on ${new URL(siteOrigin).origin}: ${url.href}`);
  }
  return url.href;
}

function assertSameList(actual, expected, label) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new TypeError(`Mismatched ${label}: ${JSON.stringify(actual)} versus ${JSON.stringify(expected)}.`);
  }
}

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) throw new TypeError(`Duplicate ${label}: ${JSON.stringify(values)}.`);
}

function validateTranslationSlots(siteHeader, languageSwitcher) {
  const notices = findElements(siteHeader, element => hasAttribute(element, 'data-translation-notice'));
  const noticesById = new Map();
  for (const notice of notices) {
    const id = requiredAttribute(attributes(notice), 'id', 'translation notice');
    if (noticesById.has(id)) throw new TypeError(`Duplicate translation notice ID ${JSON.stringify(id)}.`);
    noticesById.set(id, notice);
  }
  const unavailableLinks = findElements(languageSwitcher, element => hasAttribute(element, 'data-translation-unavailable'));
  const controlledNoticeIds = [];
  for (const link of unavailableLinks) {
    const noticeId = requiredAttribute(attributes(link), 'aria-controls', 'unavailable translation link');
    if (!noticesById.has(noticeId)) throw new TypeError(`Unavailable translation link references missing notice ${JSON.stringify(noticeId)}.`);
    controlledNoticeIds.push(noticeId);
  }
  assertUnique(controlledNoticeIds, 'controlled translation notice');
  if (controlledNoticeIds.length !== noticesById.size) {
    throw new TypeError('Every translation notice must be controlled by exactly one language-switcher link.');
  }
}

function assertExpected(actual, expected) {
  for (const field of ['routeId', 'buildId', 'language', 'locale', 'direction', 'title', 'description', 'canonicalUrl']) {
    if (Object.hasOwn(expected, field) && actual[field] !== expected[field]) {
      throw new TypeError(`Document contract ${field} mismatch: ${JSON.stringify(actual[field])} versus ${JSON.stringify(expected[field])}.`);
    }
  }
  if (expected.features) assertSameList(actual.features, expected.features, 'route features');
  if (expected.criticalFeatures) assertSameList(actual.criticalFeatures, expected.criticalFeatures, 'critical route features');
  if (expected.alternates) {
    const actualAlternates = actual.alternates.map(alternate => `${alternate.language}:${alternate.href}`);
    const expectedAlternates = expected.alternates.map(alternate => `${alternate.language}:${new URL(alternate.href).href}`);
    assertSameList(actualAlternates, expectedAlternates, 'route alternates');
  }
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
