/**
 * Funções de normalização para cross-database matching.
 * Espelham as funções SQL: normalize_cnpj(), cnpj_raiz(), normalize_phone()
 */

/** Remove tudo que não é dígito */
export function normalizeCnpj(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.replace(/\D/g, '');
  return clean.length === 14 ? clean : null;
}

/** Primeiros 8 dígitos do CNPJ (mesma empresa, filiais diferentes) */
export function cnpjRaiz(raw: string | null | undefined): string | null {
  const clean = normalizeCnpj(raw);
  if (!clean) {
    // Try with raw digits if not 14
    const digits = (raw ?? '').replace(/\D/g, '');
    return digits.length >= 8 ? digits.slice(0, 8) : null;
  }
  return clean.slice(0, 8);
}

/** Remove formatação de telefone (+55, parênteses, espaços, hífens) */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.replace(/\D/g, '');
  // Remove country code 55 if present and length > 11
  if (clean.length > 11 && clean.startsWith('55')) {
    return clean.slice(2);
  }
  return clean.length >= 10 ? clean : null;
}

/** Normaliza email para lowercase trim */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.trim().toLowerCase();
}
