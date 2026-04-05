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
});
