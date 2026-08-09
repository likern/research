const localeIdPattern = /^[a-z][a-z0-9-]*$/u;

export function validateLocaleRouteContract(contract, expected = {}) {
  if (!contract || typeof contract !== 'object') throw new TypeError('Locale route contract must be an object.');
  const documentLanguage = requiredString(contract.documentLanguage, 'document language');
  const documentLocale = localeId(contract.documentLocale, 'document locale');
  const defaultLocale = localeId(contract.defaultLocale, 'default locale');
  const canonicalUrl = contract.canonicalUrl === null ? null : metadataUrl(contract.canonicalUrl, 'canonical URL');
  const alternates = array(contract.alternates, 'locale alternates').map((alternate, index) => {
    if (!alternate || typeof alternate !== 'object') throw new TypeError(`Locale alternate ${index} must be an object.`);
    return {
      language: requiredString(alternate.language, `locale alternate ${index} language`),
      href: metadataUrl(alternate.href, `locale alternate ${index} URL`),
    };
  });
  const options = array(contract.options, 'language switcher options').map((option, index) => normalizeOption(option, index));
  const notices = array(contract.notices, 'translation notices').map((notice, index) => normalizeNotice(notice, index));

  assertUnique(alternates.map(alternate => alternate.language), 'alternate language');
  assertUnique(options.map(option => option.locale), 'language-switcher locale');
  assertUnique(options.map(option => option.language), 'language-switcher language');
  assertUnique(notices.map(notice => notice.id), 'translation notice ID');

  const locales = options.map(option => option.locale);
  if (!locales.includes(defaultLocale)) throw new TypeError(`Language switcher omits default locale ${JSON.stringify(defaultLocale)}.`);
  const currentOptions = options.filter(option => option.kind === 'current');
  if (currentOptions.length !== 1) throw new TypeError(`Language switcher requires exactly one current option, found ${currentOptions.length}.`);
  const current = currentOptions[0];
  if (current.locale !== documentLocale || current.language !== documentLanguage) {
    throw new TypeError('Current language-switcher option is inconsistent with the document language and locale.');
  }

  const unavailableNoticeIds = options
    .filter(option => option.kind === 'unavailable')
    .map(option => option.noticeId);
  assertSameSet(unavailableNoticeIds, notices.map(notice => notice.id), 'unavailable translation notices');

  if (expected.locales !== undefined) {
    assertSameList(locales, array(expected.locales, 'expected locales'), 'site locale options');
  }
  if (expected.defaultLocale !== undefined && defaultLocale !== expected.defaultLocale) {
    throw new TypeError(`Default locale mismatch: ${JSON.stringify(defaultLocale)} versus ${JSON.stringify(expected.defaultLocale)}.`);
  }
  if (expected.metadataOrigin !== undefined) {
    const expectedOrigin = new URL(requiredString(expected.metadataOrigin, 'expected metadata origin')).origin;
    if (canonicalUrl && canonicalUrl.origin !== expectedOrigin) {
      throw new TypeError(`Canonical metadata origin mismatch: ${canonicalUrl.origin} versus ${expectedOrigin}.`);
    }
  }

  if (canonicalUrl === null) {
    if (alternates.length !== 0) throw new TypeError('Non-canonical routes must not publish locale alternates.');
    return Object.freeze({ defaultLocale, locales: Object.freeze([...locales]), metadataOrigin: null });
  }

  if (alternates.some(alternate => alternate.href.origin !== canonicalUrl.origin)) {
    throw new TypeError('Canonical and alternate metadata must share one origin.');
  }
  const alternateByLanguage = new Map(alternates.map(alternate => [alternate.language, alternate.href]));
  const self = alternateByLanguage.get(documentLanguage);
  if (!self || self.href !== canonicalUrl.href) {
    throw new TypeError('Canonical route requires a matching self hreflang alternate.');
  }

  const availableOptions = options.filter(option => option.kind !== 'unavailable');
  const expectedAlternateLanguages = [...availableOptions.map(option => option.language), 'x-default'];
  assertSameSet(alternates.map(alternate => alternate.language), expectedAlternateLanguages, 'canonical hreflang set');

  for (const option of options) {
    const alternate = alternateByLanguage.get(option.language);
    if (option.kind === 'unavailable') {
      if (alternate) throw new TypeError(`Unavailable locale ${JSON.stringify(option.locale)} must not publish an hreflang alternate.`);
      continue;
    }
    if (!alternate) throw new TypeError(`Available locale ${JSON.stringify(option.locale)} requires an hreflang alternate.`);
    if (option.kind === 'current') continue;
    const optionUrl = routeMetadataUrl(option.href, canonicalUrl.origin, `language-switcher option ${option.locale}`);
    if (optionUrl.href !== alternate.href) {
      throw new TypeError(`Language-switcher target for ${JSON.stringify(option.locale)} disagrees with hreflang metadata.`);
    }
  }

  const defaultOption = options.find(option => option.locale === defaultLocale);
  const defaultAlternate = defaultOption ? alternateByLanguage.get(defaultOption.language) : undefined;
  const xDefault = alternateByLanguage.get('x-default');
  if (!defaultAlternate || !xDefault || defaultAlternate.href !== xDefault.href) {
    throw new TypeError('x-default must target the canonical route for the configured default locale.');
  }

  return Object.freeze({
    defaultLocale,
    locales: Object.freeze([...locales]),
    metadataOrigin: canonicalUrl.origin,
  });
}

function normalizeOption(option, index) {
  if (!option || typeof option !== 'object') throw new TypeError(`Language-switcher option ${index} must be an object.`);
  const locale = localeId(option.locale, `language-switcher option ${index} locale`);
  const language = requiredString(option.language, `language-switcher option ${index} language`);
  const kind = option.kind;
  if (!['current', 'available', 'unavailable'].includes(kind)) {
    throw new TypeError(`Invalid language-switcher option kind ${JSON.stringify(kind)}.`);
  }
  if (kind === 'current') {
    if (option.href !== null || option.noticeId !== null) {
      throw new TypeError('Current language-switcher option must not define a target or notice.');
    }
    return { locale, language, kind, href: null, noticeId: null };
  }
  if (kind === 'available') {
    const href = requiredString(option.href, `language-switcher option ${locale} target`);
    if (!href.startsWith('/') || href.startsWith('//') || new URL(href, 'https://pinega.invalid').hash) {
      throw new TypeError(`Available language-switcher target must be a root-relative route without a fragment: ${JSON.stringify(href)}.`);
    }
    if (option.noticeId !== null) throw new TypeError('Available language-switcher option must not control a translation notice.');
    return { locale, language, kind, href, noticeId: null };
  }
  const href = requiredString(option.href, `unavailable language-switcher option ${locale} target`);
  const noticeId = requiredString(option.noticeId, `unavailable language-switcher option ${locale} notice`);
  if (href !== `#${noticeId}`) throw new TypeError(`Unavailable language-switcher target must reference #${noticeId}.`);
  return { locale, language, kind, href, noticeId };
}

function normalizeNotice(notice, index) {
  if (!notice || typeof notice !== 'object') throw new TypeError(`Translation notice ${index} must be an object.`);
  return {
    id: requiredString(notice.id, `translation notice ${index} ID`),
    message: requiredString(notice.message, `translation notice ${index} message`),
  };
}

function routeMetadataUrl(href, origin, label) {
  let url;
  try {
    url = new URL(href, origin);
  } catch {
    throw new TypeError(`Invalid ${label} URL: ${JSON.stringify(href)}.`);
  }
  if (url.origin !== origin || url.username || url.password || url.hash) {
    throw new TypeError(`${label} URL must stay on the canonical metadata origin without credentials or a fragment.`);
  }
  return url;
}

function metadataUrl(value, label) {
  let url;
  try {
    url = new URL(requiredString(value, label));
  } catch {
    throw new TypeError(`Invalid ${label}: ${JSON.stringify(value)}.`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new TypeError(`Invalid ${label}: ${JSON.stringify(value)}.`);
  }
  return url;
}

function localeId(value, label) {
  const result = requiredString(value, label);
  if (!localeIdPattern.test(result)) throw new TypeError(`Invalid ${label}: ${JSON.stringify(value)}.`);
  return result;
}

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be a non-empty string.`);
  return value;
}

function array(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return value;
}

function assertSameList(actual, expected, label) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new TypeError(`Mismatched ${label}: ${JSON.stringify(actual)} versus ${JSON.stringify(expected)}.`);
  }
}

function assertSameSet(actual, expected, label) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  assertSameList(left, right, label);
}

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) throw new TypeError(`Duplicate ${label}: ${JSON.stringify(values)}.`);
}
