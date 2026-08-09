import {
  DOCUMENT_CONTRACT_VERSION,
  NATIVE_NAVIGATION_ROUTE_IDS,
  SHELL_VERSION,
  classifyPinegaElement,
  featureDefinition,
  isBuildId,
  parseFeatureList,
} from '../../navigation/contract.mjs';

export type RoutePreparationFailure =
  | 'build-mismatch'
  | 'locale-runtime'
  | 'malformed-contract'
  | 'route-policy';

export interface ActiveRouteState {
  buildId: string;
  contractVersion: string;
  shellVersion: string;
  routeId: string;
  language: string;
  locale: string;
  navigationPolicy: 'enhanced' | 'native';
}

export interface PreparedRoute {
  buildId: string;
  contractVersion: string;
  shellVersion: string;
  routeId: string;
  language: string;
  locale: string;
  direction: 'ltr' | 'rtl';
  title: string;
  features: string[];
  criticalFeatures: string[];
  page: string;
  main: HTMLElement;
  routeMetadata: Element[];
  siteHeader: HTMLElement;
  siteFooter: HTMLElement;
  skipLink: HTMLAnchorElement;
  languageSwitcher: HTMLElement;
  translationNotices: HTMLElement[];
  shellCurrentHref: string | null;
}

interface RouteCommitPlan {
  prepared: PreparedRoute;
  localeChanged: boolean;
  root: HTMLElement;
  body: HTMLElement;
  activeMain: HTMLElement;
  nextMain: HTMLElement;
  activeHeader: HTMLElement;
  nextHeaderChildren: Node[];
  activeSiteFooter: HTMLElement;
  nextSiteFooter: HTMLElement;
  activeSkipLink: HTMLAnchorElement;
  nextSkipLink: HTMLAnchorElement;
  activeAnnouncer: HTMLElement;
  activeLanguageSwitcher: HTMLElement;
  nextLanguageSwitcher: HTMLElement;
  activeTranslationNotices: HTMLElement[];
  nextTranslationNotices: HTMLElement[];
  activeRouteMetadata: Element[];
  nextRouteMetadata: Element[];
  activeRouteMarkers: HTMLElement[];
  nextRouteMarker?: HTMLElement;
}

export class RoutePreparationError extends Error {
  readonly reason: RoutePreparationFailure;

  constructor(reason: RoutePreparationFailure, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RoutePreparationError';
    this.reason = reason;
  }
}

export function readActiveRouteState(document: Document): ActiveRouteState {
  const root = document.documentElement;
  const body = document.body;
  const main = exactlyOne([...body.querySelectorAll<HTMLElement>('main')], 'active route main');
  const contractVersion = requiredAttribute(root, 'data-pinega-contract', 'active html');
  const buildId = requiredAttribute(root, 'data-pinega-build', 'active html');
  const shellVersion = requiredAttribute(root, 'data-pinega-shell', 'active html');
  const page = requiredAttribute(root, 'data-page', 'active html');
  const language = requiredAttribute(root, 'lang', 'active html');
  const locale = requiredAttribute(root, 'data-locale', 'active html');
  const routeId = requiredAttribute(main, 'data-pinega-route', 'active main');

  if (contractVersion !== DOCUMENT_CONTRACT_VERSION) throw new TypeError(`Unsupported active document contract ${JSON.stringify(contractVersion)}.`);
  if (shellVersion !== SHELL_VERSION) throw new TypeError(`Unsupported active shell version ${JSON.stringify(shellVersion)}.`);
  if (!isBuildId(buildId)) throw new TypeError(`Invalid active build ID ${JSON.stringify(buildId)}.`);
  if (page !== routeId || body.dataset.pinegaRoute !== routeId) throw new TypeError('Active route identity is inconsistent.');
  if (language !== locale) throw new TypeError('Active document language and locale are inconsistent.');

  return {
    buildId,
    contractVersion,
    shellVersion,
    routeId,
    language,
    locale,
    navigationPolicy: NATIVE_NAVIGATION_ROUTE_IDS.includes(routeId) ? 'native' : 'enhanced',
  };
}

export function prepareRouteDocument(
  html: string,
  destinationUrl: string,
  active: ActiveRouteState,
): PreparedRoute {
  const destination = routeUrl(destinationUrl, 'destination URL');
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const root = parsed.documentElement;
  const head = parsed.head;
  const body = parsed.body;
  const main = exactlyOne([...body.querySelectorAll<HTMLElement>('main')], 'route main');

  if (head.querySelector('base')) throw malformed('Route documents must not define a base URL.');
  if (main.querySelector('script, style, base, link[rel~="stylesheet"], pinega-site-header')) {
    throw malformed('Route main contains executable resources or shell-owned elements.');
  }

  const contractVersion = requiredAttribute(root, 'data-pinega-contract', 'html');
  const buildId = requiredAttribute(root, 'data-pinega-build', 'html');
  const shellVersion = requiredAttribute(root, 'data-pinega-shell', 'html');
  const page = requiredAttribute(root, 'data-page', 'html');
  const language = requiredAttribute(root, 'lang', 'html');
  const locale = requiredAttribute(root, 'data-locale', 'html');
  const direction = requiredAttribute(root, 'dir', 'html');
  const routeId = requiredAttribute(main, 'data-pinega-route', 'main');

  if (contractVersion !== DOCUMENT_CONTRACT_VERSION) throw malformed(`Unsupported document contract ${JSON.stringify(contractVersion)}.`);
  if (!isBuildId(buildId)) throw malformed(`Invalid document build ID ${JSON.stringify(buildId)}.`);
  if (shellVersion !== SHELL_VERSION) throw malformed(`Unsupported shell version ${JSON.stringify(shellVersion)}.`);
  if (!/^[a-z][a-z0-9-]*$/u.test(routeId)) throw malformed(`Invalid route ID ${JSON.stringify(routeId)}.`);
  if (page !== routeId || body.dataset.pinegaRoute !== routeId) throw malformed('Destination route identity is inconsistent.');
  if (main.id !== 'main-content' || main.getAttribute('tabindex') !== '-1') {
    throw malformed('Destination main must use id="main-content" and tabindex="-1".');
  }
  if (language !== locale) throw malformed('Destination language and locale are inconsistent.');
  if (direction !== 'ltr' && direction !== 'rtl') throw malformed(`Invalid direction ${JSON.stringify(direction)}.`);

  if (buildId !== active.buildId || shellVersion !== active.shellVersion) {
    throw new RoutePreparationError('build-mismatch', 'Destination build or shell is incompatible with the active document.');
  }
  if (NATIVE_NAVIGATION_ROUTE_IDS.includes(routeId)) {
    throw new RoutePreparationError('route-policy', `Route ${JSON.stringify(routeId)} requires native document navigation.`);
  }
  const features = parseFeatureList(presentAttribute(main, 'data-pinega-features', 'main'));
  const criticalFeatures = parseFeatureList(presentAttribute(main, 'data-pinega-critical-features', 'main'));
  const derived = deriveRouteFeatures(main);
  assertSameList(features, derived.features, 'declared and detected route features');
  assertSameList(criticalFeatures, derived.criticalFeatures, 'declared and detected critical route features');

  const titleNodes = [...head.querySelectorAll('title')];
  const title = exactlyOne(titleNodes, 'route title').textContent?.trim() ?? '';
  if (!title) throw malformed('Route title must not be empty.');
  validateRouteMetadata(head, language, destination);

  const siteHeader = exactlyOne([...body.querySelectorAll<HTMLElement>('pinega-site-header')], 'route site header');
  exactlyOne(
    [...siteHeader.children].filter(element => element.localName === 'header'),
    'route site-header header',
  );
  const languageSwitcher = exactlyOne(
    [...siteHeader.querySelectorAll<HTMLElement>('[data-pinega-language-switcher]')],
    'route language switcher',
  );
  const translationNotices = [...siteHeader.querySelectorAll<HTMLElement>('[data-translation-notice]')];
  validateTranslationSlots(languageSwitcher, translationNotices, language);
  const primaryNavigations = [...siteHeader.querySelectorAll<HTMLElement>('[data-primary-navigation]')];
  const primaryNavigation = exactlyOne(primaryNavigations, 'route primary navigation region');
  const routeMarkers = routeMarkerElements(siteHeader);
  if (routeMarkers.length !== 1) {
    throw malformed(`Route site header requires exactly one route aria-current="page" marker, found ${routeMarkers.length}.`);
  }
  const shellCurrentUrl = routeUrl(
    resolveShellHref(requiredAttribute(routeMarkers[0], 'href', 'current route marker'), destination.href),
    'current route marker',
  );
  if (
    shellCurrentUrl.origin !== destination.origin ||
    shellCurrentUrl.search ||
    shellCurrentUrl.hash ||
    !shellMarkerMatchesDestination(shellCurrentUrl, destination)
  ) {
    throw malformed('Route site-header current marker is inconsistent with the destination URL.');
  }
  const shellCurrentHref = shellCurrentUrl.href;
  const siteFooter = exactlyOne(
    [...body.querySelectorAll<HTMLElement>('footer.pinega-site-footer')],
    'route site footer',
  );
  const skipLink = exactlyOne(
    [...body.querySelectorAll<HTMLAnchorElement>('a.pinega-skip-link')],
    'route skip link',
  );
  if (skipLink.getAttribute('href') !== '#main-content' || !skipLink.textContent?.trim()) {
    throw malformed('Route skip link must name and target main#main-content.');
  }
  const announcer = exactlyOne(
    [...body.querySelectorAll<HTMLElement>('[data-pinega-navigation-announcer]')],
    'route navigation announcer',
  );
  if (
    announcer.getAttribute('role') !== 'status' ||
    announcer.getAttribute('aria-live') !== 'polite' ||
    announcer.getAttribute('aria-atomic') !== 'true' ||
    announcer.textContent?.trim()
  ) {
    throw malformed('Route navigation announcer must be an empty polite atomic status region.');
  }
  validateLocaleShell(siteHeader, siteFooter, primaryNavigation, language, destination);

  return {
    buildId,
    contractVersion,
    shellVersion,
    routeId,
    language,
    locale,
    direction,
    title,
    features,
    criticalFeatures,
    page,
    main,
    routeMetadata: [...head.children].filter(isRouteMetadataElement),
    siteHeader,
    siteFooter,
    skipLink,
    languageSwitcher,
    translationNotices,
    shellCurrentHref,
  };
}

export function createRouteCommitPlan(prepared: PreparedRoute, document: Document): RouteCommitPlan {
  const root = document.documentElement;
  const body = document.body;
  const activeMain = exactlyOne([...body.querySelectorAll<HTMLElement>('main')], 'active route main');
  const activeHeader = exactlyOne([...body.querySelectorAll<HTMLElement>('pinega-site-header')], 'active site header');
  const activeSiteFooter = exactlyOne(
    [...body.querySelectorAll<HTMLElement>('footer.pinega-site-footer')],
    'active site footer',
  );
  const activeSkipLink = exactlyOne(
    [...body.querySelectorAll<HTMLAnchorElement>('a.pinega-skip-link')],
    'active skip link',
  );
  const activeAnnouncer = exactlyOne(
    [...body.querySelectorAll<HTMLElement>('[data-pinega-navigation-announcer]')],
    'active navigation announcer',
  );
  const activeLanguageSwitcher = exactlyOne(
    [...activeHeader.querySelectorAll<HTMLElement>('[data-pinega-language-switcher]')],
    'active language switcher',
  );
  const activeRouteMarkers = routeMarkerElements(activeHeader);
  const localeChanged = prepared.locale !== root.dataset.locale || prepared.language !== root.lang;
  let nextRouteMarker: HTMLElement | undefined;

  if (!localeChanged && prepared.shellCurrentHref) {
    nextRouteMarker = routeMarkerCandidates(activeHeader).find(element => (
      resolveShellHref(requiredAttribute(element, 'href', 'active route marker candidate'), location.href) === prepared.shellCurrentHref
    ));
    if (!nextRouteMarker) throw malformed(`Active shell cannot represent current route ${JSON.stringify(prepared.shellCurrentHref)}.`);
  }

  return {
    prepared,
    localeChanged,
    root,
    body,
    activeMain,
    nextMain: document.importNode(prepared.main, true),
    activeHeader,
    nextHeaderChildren: [...prepared.siteHeader.childNodes].map(node => document.importNode(node, true)),
    activeSiteFooter,
    nextSiteFooter: document.importNode(prepared.siteFooter, true),
    activeSkipLink,
    nextSkipLink: document.importNode(prepared.skipLink, true),
    activeAnnouncer,
    activeLanguageSwitcher,
    nextLanguageSwitcher: document.importNode(prepared.languageSwitcher, true),
    activeTranslationNotices: [...activeHeader.querySelectorAll<HTMLElement>('[data-translation-notice]')],
    nextTranslationNotices: prepared.translationNotices.map(notice => document.importNode(notice, true)),
    activeRouteMetadata: [...document.head.children].filter(isRouteMetadataElement),
    nextRouteMetadata: prepared.routeMetadata.map(element => document.importNode(element, true)),
    activeRouteMarkers,
    ...(nextRouteMarker ? { nextRouteMarker } : {}),
  };
}

export function commitRoute(plan: RouteCommitPlan): HTMLElement {
  const { prepared } = plan;

  document.title = prepared.title;
  for (const element of plan.activeRouteMetadata) element.remove();
  document.head.append(...plan.nextRouteMetadata);

  plan.root.lang = prepared.language;
  plan.root.dir = prepared.direction;
  plan.root.dataset.page = prepared.page;
  plan.root.dataset.locale = prepared.locale;
  plan.body.dataset.pinegaRoute = prepared.routeId;

  if (plan.localeChanged) {
    plan.activeSkipLink.replaceWith(plan.nextSkipLink);
    plan.activeHeader.replaceChildren(...plan.nextHeaderChildren);
    plan.activeSiteFooter.replaceWith(plan.nextSiteFooter);
  } else {
    for (const marker of plan.activeRouteMarkers) marker.removeAttribute('aria-current');
    plan.nextRouteMarker?.setAttribute('aria-current', 'page');
    plan.activeLanguageSwitcher.replaceWith(plan.nextLanguageSwitcher);
    for (const notice of plan.activeTranslationNotices) notice.remove();
    plan.activeHeader.append(...plan.nextTranslationNotices);
  }
  plan.activeMain.replaceWith(plan.nextMain);
  plan.activeAnnouncer.textContent = prepared.title;
  return plan.nextMain;
}

function deriveRouteFeatures(main: HTMLElement): { features: string[]; criticalFeatures: string[] } {
  const detected = new Set<string>();
  for (const element of main.querySelectorAll<HTMLElement>('*')) {
    if (!element.localName.startsWith('pinega-')) continue;
    const classification = classifyPinegaElement(element.localName);
    if (classification.kind === 'unknown') throw malformed(`Unclassified Pinega custom element <${element.localName}>.`);
    if (classification.kind === 'route-feature') detected.add(classification.feature.id);
  }
  const features = [...detected].sort();
  const criticalFeatures = features.filter(feature => featureDefinition(feature)?.loading === 'critical');
  return { features, criticalFeatures };
}

function validateRouteMetadata(head: HTMLHeadElement, language: string, destination: URL): void {
  const descriptions = [...head.querySelectorAll<HTMLMetaElement>('meta[name="description"]')];
  const description = requiredAttribute(exactlyOne(descriptions, 'meta[name="description"]'), 'content', 'meta[name="description"]');
  if (!description.trim()) throw malformed('Route description must not be empty.');
  const robots = [...head.querySelectorAll<HTMLMetaElement>('meta[name="robots"]')];
  if (robots.length > 1) throw malformed('Route contains more than one meta[name="robots"].');
  if (robots.length === 1) requiredAttribute(robots[0], 'content', 'meta[name="robots"]');

  const canonicals = [...head.querySelectorAll<HTMLLinkElement>('link[rel~="canonical"]')];
  if (canonicals.length !== 1) throw malformed(`Enhanced route requires exactly one canonical link, found ${canonicals.length}.`);
  const canonical = absoluteMetadataUrl(requiredAttribute(canonicals[0], 'href', 'canonical link'));
  const alternateElements = [...head.querySelectorAll<HTMLLinkElement>('link[rel~="alternate"][hreflang]')];
  const alternates = alternateElements.map(element => ({
    language: requiredAttribute(element, 'hreflang', 'alternate link'),
    href: absoluteMetadataUrl(requiredAttribute(element, 'href', 'alternate link')),
  }));
  assertUnique(alternates.map(alternate => alternate.language), 'alternate hreflang');
  const self = alternates.find(alternate => alternate.language === language);
  if (!self || self.href.href !== canonical.href) throw malformed('Canonical route requires a matching self hreflang alternate.');
  if (!alternates.some(alternate => alternate.language === 'x-default')) throw malformed('Canonical route requires an x-default alternate.');
  if (alternates.some(alternate => alternate.href.origin !== canonical.origin)) {
    throw malformed('Canonical and alternate metadata must share one origin.');
  }
  if (canonical.pathname !== destination.pathname) {
    throw malformed('Canonical route path is inconsistent with the destination URL.');
  }

  assertUniqueMetadata(head, 'property', value => value.startsWith('og:'));
  assertUniqueMetadata(head, 'name', value => value.startsWith('twitter:'));
}

function validateTranslationSlots(languageSwitcher: HTMLElement, notices: HTMLElement[], language: string): void {
  const noticesById = new Map<string, HTMLElement>();
  for (const notice of notices) {
    if (!notice.id) throw malformed('Translation notice requires an ID.');
    if (noticesById.has(notice.id)) throw malformed(`Duplicate translation notice ID ${JSON.stringify(notice.id)}.`);
    noticesById.set(notice.id, notice);
  }

  const controlled = new Set<string>();
  for (const link of languageSwitcher.querySelectorAll<HTMLElement>('[data-translation-unavailable]')) {
    const noticeId = requiredAttribute(link, 'aria-controls', 'unavailable translation link');
    if (!noticesById.has(noticeId)) throw malformed(`Unavailable translation link references missing notice ${JSON.stringify(noticeId)}.`);
    if (controlled.has(noticeId)) throw malformed(`Translation notice ${JSON.stringify(noticeId)} has more than one controller.`);
    controlled.add(noticeId);
  }
  if (controlled.size !== noticesById.size) throw malformed('Every translation notice requires exactly one language-switcher controller.');

  const current = exactlyOne(
    [...languageSwitcher.querySelectorAll<HTMLElement>('.pinega-language-option[aria-current="page"]')],
    'current route language option',
  );
  const currentLanguage = exactlyOne([...current.querySelectorAll<HTMLElement>('[lang]')], 'current route language label');
  if (currentLanguage.lang !== language) throw malformed('Current route language option is inconsistent with html[lang].');
}

function validateLocaleShell(
  siteHeader: HTMLElement,
  siteFooter: HTMLElement,
  primaryNavigation: HTMLElement,
  language: string,
  destination: URL,
): void {
  if (siteHeader.querySelector('script, style, base, link[rel~="stylesheet"]')) {
    throw malformed('Route site header contains executable or stylesheet resources.');
  }
  if (siteFooter.querySelector('script, style, base, link[rel~="stylesheet"]')) {
    throw malformed('Route site footer contains executable or stylesheet resources.');
  }
  requiredAttribute(primaryNavigation, 'aria-label', 'route primary navigation');
  const footerNavigation = exactlyOne([...siteFooter.querySelectorAll<HTMLElement>('nav')], 'route footer navigation');
  requiredAttribute(footerNavigation, 'aria-label', 'route footer navigation');

  const headerBrand = exactlyOne(
    [...siteHeader.querySelectorAll<HTMLAnchorElement>('a.pinega-brand[href]')],
    'route site-header brand',
  );
  const footerBrand = exactlyOne(
    [...siteFooter.querySelectorAll<HTMLAnchorElement>('a.pinega-brand[href]')],
    'route site-footer brand',
  );
  const headerBrandUrl = resolveShellHref(requiredAttribute(headerBrand, 'href', 'route site-header brand'), destination.href);
  const footerBrandUrl = resolveShellHref(requiredAttribute(footerBrand, 'href', 'route site-footer brand'), destination.href);
  if (headerBrandUrl !== footerBrandUrl) throw malformed('Route header and footer brand destinations are inconsistent.');
  requiredAttribute(headerBrand, 'aria-label', 'route site-header brand');
  requiredAttribute(footerBrand, 'aria-label', 'route site-footer brand');

  const primaryDestinations = [...primaryNavigation.querySelectorAll<HTMLAnchorElement>('a[href]')]
    .map(link => resolveShellHref(requiredAttribute(link, 'href', 'primary navigation link'), destination.href));
  const footerDestinations = [...footerNavigation.querySelectorAll<HTMLAnchorElement>('a[href]')]
    .map(link => resolveShellHref(requiredAttribute(link, 'href', 'footer navigation link'), destination.href));
  assertSameList(primaryDestinations, footerDestinations, 'header and footer navigation destinations');

  for (const [selector, label] of [
    ['[data-theme-toggle]', 'theme control'],
    ['[data-navigation-toggle]', 'navigation control'],
  ] as const) {
    const control = exactlyOne([...siteHeader.querySelectorAll<HTMLElement>(selector)], `route ${label}`);
    if (!control.textContent?.trim()) throw malformed(`Route ${label} must have a localized accessible name.`);
  }
  if (!language.trim()) throw malformed('Route shell requires a document language.');
}

function routeMarkerElements(siteHeader: HTMLElement): HTMLElement[] {
  return [
    ...siteHeader.querySelectorAll<HTMLElement>('a.pinega-brand[aria-current="page"]'),
    ...siteHeader.querySelectorAll<HTMLElement>('[data-primary-navigation] a[aria-current="page"]'),
  ];
}

function routeMarkerCandidates(siteHeader: HTMLElement): HTMLElement[] {
  return [
    ...siteHeader.querySelectorAll<HTMLElement>('a.pinega-brand[href]'),
    ...siteHeader.querySelectorAll<HTMLElement>('[data-primary-navigation] a[href]'),
  ];
}

function isRouteMetadataElement(element: Element): boolean {
  if (element instanceof HTMLMetaElement) {
    const name = element.getAttribute('name')?.toLocaleLowerCase() ?? '';
    const property = element.getAttribute('property')?.toLocaleLowerCase() ?? '';
    return name === 'description' || name === 'robots' || name.startsWith('twitter:') || property.startsWith('og:');
  }
  if (element instanceof HTMLLinkElement) {
    const rel = new Set(element.rel.toLocaleLowerCase().split(/\s+/u));
    return rel.has('canonical') || (rel.has('alternate') && element.hasAttribute('hreflang'));
  }
  return false;
}

function absoluteMetadataUrl(value: string): URL {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw malformed(`Route metadata URL must be absolute: ${JSON.stringify(value)}.`, error);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw malformed(`Invalid route metadata URL ${JSON.stringify(value)}.`);
  }
  return url;
}

function resolveShellHref(value: string, base: string): string {
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw malformed(`Invalid site-header route URL ${JSON.stringify(value)}.`);
  }
  return url.href;
}

function routeUrl(value: string, label: string): URL {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw malformed(`${label} must be an absolute URL: ${JSON.stringify(value)}.`, error);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw malformed(`Invalid ${label} ${JSON.stringify(value)}.`);
  }
  return url;
}

function shellMarkerMatchesDestination(marker: URL, destination: URL): boolean {
  if (marker.pathname === destination.pathname) return true;
  if (marker.pathname === '/') return false;
  const prefix = marker.pathname.endsWith('/') ? marker.pathname : `${marker.pathname}/`;
  return destination.pathname.startsWith(prefix);
}

function assertUniqueMetadata(head: HTMLHeadElement, attribute: 'name' | 'property', predicate: (value: string) => boolean): void {
  const values: string[] = [];
  for (const element of head.querySelectorAll<HTMLMetaElement>(`meta[${attribute}]`)) {
    const value = element.getAttribute(attribute) ?? '';
    if (!predicate(value)) continue;
    values.push(value);
    requiredAttribute(element, 'content', `meta[${attribute}="${value}"]`);
  }
  assertUnique(values, `${attribute} metadata`);
}

function requiredAttribute(element: Element | undefined, name: string, label: string): string {
  const value = element?.getAttribute(name);
  if (value === null || value === undefined || value === '') throw malformed(`${label} requires a non-empty ${name} attribute.`);
  return value;
}

function presentAttribute(element: Element, name: string, label: string): string {
  const value = element.getAttribute(name);
  if (value === null) throw malformed(`${label} requires a ${name} attribute.`);
  return value;
}

function exactlyOne<T>(values: T[], label: string): T {
  if (values.length !== 1) throw malformed(`Expected exactly one ${label}, found ${values.length}.`);
  return values[0] as T;
}

function assertSameList(actual: string[], expected: string[], label: string): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw malformed(`Mismatched ${label}: ${JSON.stringify(actual)} versus ${JSON.stringify(expected)}.`);
  }
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw malformed(`Duplicate ${label}: ${JSON.stringify(values)}.`);
}

function malformed(message: string, cause?: unknown): RoutePreparationError {
  return new RoutePreparationError('malformed-contract', message, cause === undefined ? undefined : { cause });
}
