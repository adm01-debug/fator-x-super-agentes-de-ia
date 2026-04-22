/* eslint-disable react-refresh/only-export-components */
/**
 * Nexus Agents Studio — I18n Context Provider
 * Wraps the app and provides global locale state. All useI18n() calls
 * read from this context, so changing the locale anywhere reflects
 * everywhere.
 *
 * Usage:
 *  1. Wrap <App /> in <I18nProvider>
 *  2. Anywhere: const { t, locale, setLocale } = useI18n();
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { translations, DEFAULT_LOCALE, type Locale } from '@/i18n/translations';
import { logger } from '@/lib/logger';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'nexus-locale';

/**
 * Replace {placeholder} tokens in a string with values from `vars`.
 * Used by t() to support keys like 'time.seconds_ago' = '{n}s ago'.
 */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const v = vars[key];
    return v === undefined || v === null ? match : String(v);
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && translations[stored]) return stored;
    } catch (err) {
      logger.error('I18nProvider init failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return DEFAULT_LOCALE;
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
      // Update <html lang> for accessibility / SEO
      if (typeof document !== 'undefined') {
        document.documentElement.lang = newLocale;
      }
    } catch (err) {
      logger.error('I18nProvider setLocale failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const template = translations[locale]?.[key] ?? translations[DEFAULT_LOCALE]?.[key] ?? key;
      return interpolate(template, vars);
    },
    [locale],
  );

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

/**
 * Hook to access the I18n context. Throws if used outside <I18nProvider>.
 * Falls back gracefully if context is missing (logs warning, uses defaults).
 */
export function useI18nContext(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    logger.warn('useI18nContext called outside I18nProvider — using fallback');
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key: string, vars?: Record<string, string | number>) =>
        interpolate(translations[DEFAULT_LOCALE]?.[key] ?? key, vars),
    };
  }
  return ctx;
}
