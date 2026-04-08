import { describe, it, expect } from 'vitest';
import { translations, DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/translations';

describe('i18n translations', () => {
  it('has pt-BR and en-US locales', () => {
    expect(translations['pt-BR']).toBeDefined();
    expect(translations['en-US']).toBeDefined();
  });

  it('default locale is pt-BR', () => {
    expect(DEFAULT_LOCALE).toBe('pt-BR');
  });

  it('both locales have same keys', () => {
    const ptKeys = Object.keys(translations['pt-BR']).sort();
    const enKeys = Object.keys(translations['en-US']).sort();
    expect(ptKeys).toEqual(enKeys);
  });

  it('no empty translations', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const [key, value] of Object.entries(translations[locale])) {
        expect(value.length, `${locale}.${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('has at least 200 keys per locale (T14.2 expansion)', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const count = Object.keys(translations[locale]).length;
      expect(count, `${locale} should have 200+ keys`).toBeGreaterThanOrEqual(200);
    }
  });

  it('covers all major namespaces', () => {
    const required = [
      'nav.dashboard', 'action.save', 'common.loading', 'error.generic',
      'agents.title', 'workflows.title', 'oracle.title', 'billing.title',
      'datahub.title', 'monitoring.title', 'settings.title',
    ];
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of required) {
        expect(translations[locale][key], `${locale}.${key} missing`).toBeDefined();
      }
    }
  });

  it('interpolation placeholders are paired across locales', () => {
    // Any value with {token} on one side must have {token} on the other
    const ptKeys = Object.keys(translations['pt-BR']);
    for (const key of ptKeys) {
      const ptVal = translations['pt-BR'][key];
      const enVal = translations['en-US'][key];
      const ptTokens = (ptVal.match(/\{(\w+)\}/g) ?? []).sort();
      const enTokens = (enVal.match(/\{(\w+)\}/g) ?? []).sort();
      expect(enTokens, `${key} placeholders mismatch`).toEqual(ptTokens);
    }
  });
});
