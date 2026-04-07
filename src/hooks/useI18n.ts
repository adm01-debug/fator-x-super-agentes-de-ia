/**
 * Nexus Agents Studio — useI18n Hook
 * Reads from the global I18nProvider context so locale changes are
 * shared across the entire app. If used outside the provider it
 * falls back to defaults via useI18nContext.
 *
 * Usage:
 *   const { t, locale, setLocale } = useI18n();
 *   <span>{t('agents.create')}</span>
 */
import { useI18nContext } from '@/i18n/I18nProvider';

export function useI18n() {
  return useI18nContext();
}
