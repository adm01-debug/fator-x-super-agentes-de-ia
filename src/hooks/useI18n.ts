/**
 * Nexus Agents Studio — useI18n Hook
 * Usage: const { t, locale, setLocale } = useI18n();
 *        <span>{t('agents.create')}</span>
 */

import { useState, useCallback } from 'react';
import { translations, DEFAULT_LOCALE, type Locale } from '@/i18n/translations';

export function useI18n() {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      return (localStorage.getItem('nexus-locale') as Locale) || DEFAULT_LOCALE;
    } catch (err) { console.error("Operation failed:", err);
      return DEFAULT_LOCALE;
    }
  });

  const t = useCallback((key: string): string => {
    return translations[locale]?.[key] || translations[DEFAULT_LOCALE]?.[key] || key;
  }, [locale]);

  const changeLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    try { localStorage.setItem('nexus-locale', newLocale); } catch (err) { console.error("Operation failed:", err);}
  }, []);

  return { t, locale, setLocale: changeLocale };
}
