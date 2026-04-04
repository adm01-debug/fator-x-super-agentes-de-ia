import { describe, it, expect } from 'vitest';
import {
  normalizeCnpj,
  cnpjRaiz,
  normalizePhone,
  normalizeEmail,
  formatCnpj,
  formatPhone,
} from '@/lib/normalize';

describe('normalizeCnpj', () => {
  it('strips formatting from formatted CNPJ', () => {
    expect(normalizeCnpj('15.376.517/0002-38')).toBe('15376517000238');
  });

  it('returns digits-only CNPJ as-is', () => {
    expect(normalizeCnpj('15376517000238')).toBe('15376517000238');
  });

  it('returns null for invalid length', () => {
    expect(normalizeCnpj('1234')).toBeNull();
    expect(normalizeCnpj('123456789012345')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(normalizeCnpj(null)).toBeNull();
    expect(normalizeCnpj(undefined)).toBeNull();
    expect(normalizeCnpj('')).toBeNull();
  });
});

describe('cnpjRaiz', () => {
  it('extracts first 8 digits (root)', () => {
    expect(cnpjRaiz('15.376.517/0002-38')).toBe('15376517');
    expect(cnpjRaiz('15.376.517/0001-57')).toBe('15376517');
  });

  it('matches matriz and filial by root', () => {
    const filial = cnpjRaiz('15376517000238');
    const matriz = cnpjRaiz('15376517000157');
    expect(filial).toBe(matriz);
  });

  it('returns null for short inputs', () => {
    expect(cnpjRaiz('1234')).toBeNull();
    expect(cnpjRaiz(null)).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('strips formatting from BR phone', () => {
    expect(normalizePhone('(11) 99999-8888')).toBe('11999998888');
  });

  it('removes country code +55', () => {
    expect(normalizePhone('+55 11 99999-8888')).toBe('11999998888');
  });

  it('handles digits-only', () => {
    expect(normalizePhone('5511999998888')).toBe('11999998888');
  });

  it('returns null for too-short numbers', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it('keeps 10-digit landline', () => {
    expect(normalizePhone('1133334444')).toBe('1133334444');
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Joao@Empresa.COM  ')).toBe('joao@empresa.com');
  });

  it('returns null for invalid email', () => {
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail('')).toBeNull();
  });
});

describe('formatCnpj', () => {
  it('formats 14-digit string', () => {
    expect(formatCnpj('15376517000238')).toBe('15.376.517/0002-38');
  });

  it('returns empty for null', () => {
    expect(formatCnpj(null)).toBe('');
  });

  it('returns raw for wrong-length input', () => {
    expect(formatCnpj('123')).toBe('123');
  });
});

describe('formatPhone', () => {
  it('formats 11-digit mobile', () => {
    expect(formatPhone('11999998888')).toBe('(11) 99999-8888');
  });

  it('formats 10-digit landline', () => {
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
  });

  it('returns empty for null', () => {
    expect(formatPhone(null)).toBe('');
  });

  it('returns raw for unusual length', () => {
    expect(formatPhone('12345')).toBe('12345');
  });
});
