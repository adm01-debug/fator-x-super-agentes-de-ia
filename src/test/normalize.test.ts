import { describe, it, expect } from 'vitest';
import { normalizeCnpj, cnpjRaiz, normalizePhone, normalizeEmail } from '@/lib/normalize';

describe('normalizeCnpj', () => {
  it('removes formatting', () => {
    expect(normalizeCnpj('15.376.517/0001-57')).toBe('15376517000157');
  });
  it('passes clean CNPJ', () => {
    expect(normalizeCnpj('15376517000238')).toBe('15376517000238');
  });
  it('returns null for invalid', () => {
    expect(normalizeCnpj('123')).toBeNull();
  });
  it('returns null for null/undefined', () => {
    expect(normalizeCnpj(null)).toBeNull();
    expect(normalizeCnpj(undefined)).toBeNull();
  });
});

describe('cnpjRaiz', () => {
  it('extracts first 8 digits from formatted', () => {
    expect(cnpjRaiz('15.376.517/0001-57')).toBe('15376517');
  });
  it('extracts first 8 digits from clean', () => {
    expect(cnpjRaiz('15376517000238')).toBe('15376517');
  });
  it('matches filial and matriz', () => {
    expect(cnpjRaiz('15376517000157')).toBe(cnpjRaiz('15376517000238'));
  });
  it('returns null for too short', () => {
    expect(cnpjRaiz('123')).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('removes formatting', () => {
    expect(normalizePhone('(31) 99999-1234')).toBe('31999991234');
  });
  it('removes country code', () => {
    expect(normalizePhone('+55 31 99999-1234')).toBe('31999991234');
  });
  it('returns null for too short', () => {
    expect(normalizePhone('123')).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Admin@PromoBrindes.com.br  ')).toBe('admin@promobrindes.com.br');
  });
  it('returns null for null', () => {
    expect(normalizeEmail(null)).toBeNull();
  });
});
