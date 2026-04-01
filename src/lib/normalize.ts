/**
 * Funções de normalização para cross-database matching.
 * Baseado na auditoria de 4 bancos com 15 falhas identificadas.
 */

/**
 * Remove toda formatação de CNPJ, retornando apenas dígitos.
 * Lida com os 3 formatos encontrados: com pontuação, sem pontuação, parcial.
 * @returns String de 14 dígitos ou null se inválido
 */
export function normalizeCnpj(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length !== 14) return null;
  return digits;
}

/**
 * Extrai a RAIZ do CNPJ (primeiros 8 dígitos).
 * Resolve o problema filial vs matriz: SPOT 15376517000238 (filial) e 15376517000157 (matriz)
 * ambos retornam "15376517".
 */
export function cnpjRaiz(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 8) return null;
  return digits.substring(0, 8);
}

/**
 * Normaliza telefone removendo +55, parênteses, espaços, hífens.
 * WhatsApp contacts → CRM match exclusivamente por telefone.
 * @returns Apenas dígitos ou null
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 8) return null;
  // Remove código do país (55) se presente
  if (digits.length >= 12 && digits.startsWith('55')) {
    return digits.substring(2);
  }
  return digits;
}

/**
 * Normaliza email para lowercase e trim.
 * Email é a ÚNICA chave confiável para match CRM↔RH.
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed.includes('@')) return null;
  return trimmed;
}

/**
 * Formata CNPJ para exibição: XX.XXX.XXX/XXXX-XX
 */
export function formatCnpj(digits: string | null | undefined): string {
  if (!digits) return '';
  const clean = digits.replace(/[^0-9]/g, '');
  if (clean.length !== 14) return digits ?? '';
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`;
}

/**
 * Formata telefone para exibição: (XX) XXXXX-XXXX
 */
export function formatPhone(digits: string | null | undefined): string {
  if (!digits) return '';
  const clean = digits.replace(/[^0-9]/g, '');
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return digits ?? '';
}
