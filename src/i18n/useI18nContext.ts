import { useContext } from 'react';
import { translations, DEFAULT_LOCALE } from '@/i18n/translations';
import { logger } from '@/lib/logger';
import { I18nContext, interpolate, type I18nContextValue } from './i18nContext';

/**
 * Hook to access the I18n context. Falls back gracefully if context is
 * missing (logs warning, uses defaults).
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
