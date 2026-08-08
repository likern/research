import en from '../../content/messages/en.json';
import ru from '../../content/messages/ru.json';

const catalogues = { en, ru } as const;

export type PinegaLocale = keyof typeof catalogues;
export type PinegaMessages = typeof en | typeof ru;

export function currentLocale(): PinegaLocale {
  const language = document.documentElement.lang.toLocaleLowerCase().split('-')[0];
  return language === 'ru' ? 'ru' : 'en';
}

export function getMessages(locale = currentLocale()): PinegaMessages {
  return catalogues[locale];
}

export function formatPageCount(count: number, locale = currentLocale()): string {
  const messages = getMessages(locale);
  const category = new Intl.PluralRules(locale).select(count) as keyof typeof messages.search.page_forms;
  const forms: Partial<Record<Intl.LDMLPluralRule, string>> = messages.search.page_forms;
  return `${count} ${forms[category] ?? forms.other}`;
}
