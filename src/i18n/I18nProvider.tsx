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
import { useState, useCallback, type ReactNode } from 'react';
import { translations, DEFAULT_LOCALE, type Locale } from '@/i18n/translations';
import { logger } from '@/lib/logger';
import { I18nContext, I18N_STORAGE_KEY, interpolate } from './i18nContext';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const stored = localStorage.getItem(I18N_STORAGE_KEY) as Locale | null;
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
      localStorage.setItem(I18N_STORAGE_KEY, newLocale);
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
