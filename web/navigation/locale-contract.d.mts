export interface LocaleAlternateDescriptor {
  language: string;
  href: string;
}

export interface LocaleOptionDescriptor {
  locale: string;
  language: string;
  kind: 'current' | 'available' | 'unavailable';
  href: string | null;
  noticeId: string | null;
}

export interface TranslationNoticeDescriptor {
  id: string;
  message: string;
}

export interface LocaleRouteContract {
  documentLanguage: string;
  documentLocale: string;
  canonicalUrl: string | null;
  alternates: readonly LocaleAlternateDescriptor[];
  defaultLocale: string;
  options: readonly LocaleOptionDescriptor[];
  notices: readonly TranslationNoticeDescriptor[];
}

export interface ExpectedLocaleRouteContract {
  locales?: readonly string[];
  defaultLocale?: string;
  metadataOrigin?: string;
}

export interface ValidatedLocaleRouteContract {
  readonly defaultLocale: string;
  readonly locales: readonly string[];
  readonly metadataOrigin: string | null;
}

export function validateLocaleRouteContract(
  contract: LocaleRouteContract,
  expected?: ExpectedLocaleRouteContract,
): ValidatedLocaleRouteContract;
