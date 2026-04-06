/**
 * Global i18n Context — ensures locale state is shared across all components.
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { translations, DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/i18n/translations';
import { logger } from '@/lib/logger';

interface I18nContextValue {
  t: (key: string) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  supportedLocales: Locale[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      return (localStorage.getItem('nexus-locale') as Locale) || DEFAULT_LOCALE;
    } catch {
      return DEFAULT_LOCALE;
    }
  });

  const t = useCallback((key: string): string => {
    return translations[locale]?.[key] || translations[DEFAULT_LOCALE]?.[key] || key;
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem('nexus-locale', newLocale);
    } catch (err) {
      logger.error('Failed to persist locale:', err);
    }
  }, []);

  return (
    <I18nContext.Provider value={{ t, locale, setLocale, supportedLocales: SUPPORTED_LOCALES }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18nContext(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback for components outside provider
    return {
      t: (key: string) => translations[DEFAULT_LOCALE]?.[key] || key,
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      supportedLocales: SUPPORTED_LOCALES,
    };
  }
  return ctx;
}
