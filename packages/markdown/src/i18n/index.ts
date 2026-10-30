import { en, Message, MessageKey } from './en';
import { ko } from './ko';

export type { Message, MessageKey } from './en';

export const LOCALES = ['en', 'ko'] as const;
export type Locale = (typeof LOCALES)[number];

export type MessageArgs = Record<string, string | number | readonly string[]>;

/**
 * A message to show later, in any language. Logic returns notices instead of
 * sentences; the surface (VS Code, a CLI, a server) picks the locale.
 */
export interface Notice {
  code: MessageKey;
  args?: MessageArgs;
}

const CATALOGS: Record<Locale, Record<MessageKey, Message>> = { en, ko };

function interpolate(template: string, args: MessageArgs | undefined): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = args?.[name];
    if (value === undefined) return placeholder;
    return Array.isArray(value) ? value.join(', ') : String(value);
  });
}

/** Looks up a message. Falls back to English, then to the key itself. */
export function t(key: MessageKey, locale: Locale = 'en', args?: MessageArgs): string {
  const message = CATALOGS[locale]?.[key] ?? en[key];
  if (message === undefined) return key;
  if (typeof message === 'string') return interpolate(message, args);
  const count = typeof args?.count === 'number' ? args.count : 1;
  return interpolate(count === 1 ? message.one : message.other, args);
}

export function formatNotice(notice: Notice, locale: Locale = 'en'): string {
  return t(notice.code, locale, notice.args);
}

/**
 * Chooses the display language. `setting` is the user's choice ('auto', 'en',
 * 'ko'); `uiLanguage` is the host's display language such as 'ko' or 'en-US'.
 */
export function pickLocale(setting: string | undefined, uiLanguage: string | undefined): Locale {
  if (setting && (LOCALES as readonly string[]).includes(setting)) return setting as Locale;
  const base = (uiLanguage ?? 'en').toLowerCase().split(/[-_]/)[0];
  return (LOCALES as readonly string[]).includes(base) ? (base as Locale) : 'en';
}

/** Validation issues keep a short code; the catalog key is `validation.<code>`. */
export function validationKey(code: string): MessageKey {
  return `validation.${code}` as MessageKey;
}
