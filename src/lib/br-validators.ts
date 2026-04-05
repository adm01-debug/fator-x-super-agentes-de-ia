/**
 * Brazilian document and format validators.
 *
 * Implements the official mod-11 check-digit algorithms for CPF and CNPJ,
 * plus format validation and formatting helpers for CEP and phone numbers.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip every non-digit character from a string. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

// ---------------------------------------------------------------------------
// CPF
// ---------------------------------------------------------------------------

/**
 * Validate a Brazilian CPF (Cadastro de Pessoas Fisicas) using the
 * official mod-11 algorithm with two check digits.
 *
 * Accepts both raw digits (`12345678909`) and formatted (`123.456.789-09`).
 *
 * @param cpf - The CPF string to validate.
 * @returns `true` when the CPF is structurally valid.
 */
export function validateCPF(cpf: string): boolean {
  const digits = digitsOnly(cpf);

  if (digits.length !== 11) return false;

  // Reject well-known invalid sequences (all same digit)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // First check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9], 10)) return false;

  // Second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[10], 10)) return false;

  return true;
}

/**
 * Format a CPF string as `XXX.XXX.XXX-XX`.
 *
 * @param cpf - Raw or partially formatted CPF.
 * @returns The formatted CPF, or the original string when it does not
 *          contain exactly 11 digits.
 */
export function formatCPF(cpf: string): string {
  const digits = digitsOnly(cpf);
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

// ---------------------------------------------------------------------------
// CNPJ
// ---------------------------------------------------------------------------

/**
 * Validate a Brazilian CNPJ (Cadastro Nacional da Pessoa Juridica) using the
 * official mod-11 algorithm with two check digits.
 *
 * Accepts both raw digits and formatted strings
 * (`11.222.333/0001-81` or `11222333000181`).
 *
 * @param cnpj - The CNPJ string to validate.
 * @returns `true` when the CNPJ is structurally valid.
 */
export function validateCNPJ(cnpj: string): boolean {
  const digits = digitsOnly(cnpj);

  if (digits.length !== 14) return false;

  // Reject all-same-digit sequences
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  // First check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * weights1[i];
  }
  let remainder = sum % 11;
  const check1 = remainder < 2 ? 0 : 11 - remainder;
  if (check1 !== parseInt(digits[12], 10)) return false;

  // Second check digit
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i], 10) * weights2[i];
  }
  remainder = sum % 11;
  const check2 = remainder < 2 ? 0 : 11 - remainder;
  if (check2 !== parseInt(digits[13], 10)) return false;

  return true;
}

/**
 * Format a CNPJ string as `XX.XXX.XXX/XXXX-XX`.
 *
 * @param cnpj - Raw or partially formatted CNPJ.
 * @returns The formatted CNPJ, or the original string when it does not
 *          contain exactly 14 digits.
 */
export function formatCNPJ(cnpj: string): string {
  const digits = digitsOnly(cnpj);
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

// ---------------------------------------------------------------------------
// CEP
// ---------------------------------------------------------------------------

/**
 * Validate a Brazilian CEP (Codigo de Enderecamento Postal).
 *
 * Accepted formats: `XXXXX-XXX` or `XXXXXXXX` (8 digits).
 *
 * @param cep - The CEP string to validate.
 * @returns `true` when the CEP matches the expected format.
 */
export function validateCEP(cep: string): boolean {
  return /^\d{5}-?\d{3}$/.test(cep.trim());
}

/**
 * Format a CEP string as `XXXXX-XXX`.
 *
 * @param cep - Raw or partially formatted CEP.
 * @returns The formatted CEP, or the original string when it does not
 *          contain exactly 8 digits.
 */
export function formatCEP(cep: string): string {
  const digits = digitsOnly(cep);
  if (digits.length !== 8) return cep;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

/**
 * Validate a Brazilian phone number.
 *
 * Accepted formats:
 * - `(XX) XXXXX-XXXX` (mobile, 9 digits)
 * - `(XX) XXXX-XXXX`  (landline, 8 digits)
 * - Raw digits: `XXXXXXXXXXX` (11 digits) or `XXXXXXXXXX` (10 digits)
 *
 * @param phone - The phone string to validate.
 * @returns `true` when the phone matches a valid Brazilian format.
 */
export function validatePhone(phone: string): boolean {
  const digits = digitsOnly(phone);
  // 10 digits = landline (2 DDD + 8), 11 digits = mobile (2 DDD + 9)
  if (digits.length !== 10 && digits.length !== 11) return false;

  // DDD (area code) must be between 11 and 99
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) return false;

  // Mobile numbers (11 digits) must start with 9 after the DDD
  if (digits.length === 11 && digits[2] !== '9') return false;

  return true;
}

/**
 * Format a phone string as `(XX) XXXXX-XXXX` (mobile) or `(XX) XXXX-XXXX`
 * (landline).
 *
 * @param phone - Raw or partially formatted phone number.
 * @returns The formatted phone, or the original string when it does not
 *          contain 10 or 11 digits.
 */
export function formatPhone(phone: string): string {
  const digits = digitsOnly(phone);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  return phone;
}
