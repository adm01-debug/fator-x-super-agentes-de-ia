/**
 * Nexus Agents Studio — Security Utilities (NEW)
 * 
 * Provides:
 * - Constant-time string comparison (timing attack prevention)
 * - HMAC signature validation (raw body)
 * - CIDR-based IP allowlisting
 * - PII redaction for logging
 */

import { createHmac, timingSafeEqual } from "https://deno.land/std@0.208.0/crypto/timing_safe_equal.ts";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Use for comparing secrets, tokens, HMAC signatures.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do comparison to avoid length-based timing leak
    const dummy = new Uint8Array(32);
    timingSafeEqual(dummy, dummy);
    return false;
  }
  const encoder = new TextEncoder();
  return timingSafeEqual(encoder.encode(a), encoder.encode(b));
}

/**
 * Verify HMAC signature using raw request body.
 * Supports SHA-256 (Bitrix24, Evolution) and SHA-1 (Twilio).
 */
export async function verifyHmacSignature(
  rawBody: string | Uint8Array,
  signature: string,
  secret: string,
  algorithm: 'SHA-256' | 'SHA-1' = 'SHA-256'
): Promise<boolean> {
  if (!signature || !secret) return false;
  
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: algorithm },
      false,
      ['sign']
    );
    
    const bodyBytes = typeof rawBody === 'string' 
      ? new TextEncoder().encode(rawBody) 
      : rawBody;
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, bodyBytes);
    const computed = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Remove common prefixes (sha256=, sha1=)
    const cleanSignature = signature.replace(/^sha(256|1)=/, '').toLowerCase();
    
    return constantTimeEqual(computed, cleanSignature);
  } catch (err) {
    console.error('[security] HMAC verification error:', err);
    return false;
  }
}

/**
 * Check if an IP address is within any of the allowed CIDR ranges.
 */
export function isIpInCidrRange(ip: string, cidrRanges: string[]): boolean {
  if (!ip || cidrRanges.length === 0) return false;
  
  const ipToInt = (ipStr: string): number => {
    const parts = ipStr.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return -1;
    return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  };
  
  const ipInt = ipToInt(ip);
  if (ipInt === -1) return false;
  
  for (const cidr of cidrRanges) {
    const [range, bits] = cidr.split('/');
    const rangeInt = ipToInt(range);
    if (rangeInt === -1) continue;
    
    const mask = bits ? (-1 << (32 - parseInt(bits, 10))) >>> 0 : 0xFFFFFFFF;
    if ((ipInt & mask) === (rangeInt & mask)) return true;
  }
  
  return false;
}

// Common webhook source IPs (Bitrix24 Brazil, Evolution API, Twilio)
export const KNOWN_WEBHOOK_CIDRS = [
  '3.217.0.0/16',      // AWS us-east-1 (Bitrix24)
  '52.0.0.0/8',        // AWS general
  '54.0.0.0/8',        // AWS general
  '18.0.0.0/8',        // AWS general
  '127.0.0.1/32',      // localhost (dev)
  '10.0.0.0/8',        // private (Supabase internal)
];

/**
 * Redact PII from strings for safe logging.
 * Masks emails, phone numbers, CPF/CNPJ, credit cards.
 */
export function redactPII(input: string): string {
  if (!input || typeof input !== 'string') return input;
  
  return input
    // Email: keep first 2 chars + domain
    .replace(/([a-zA-Z0-9._%+-]{2})[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1***@$2')
    // Phone: keep last 4 digits
    .replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}/g, (m) => `***${m.slice(-4)}`)
    // CPF: XXX.XXX.XXX-XX -> ***.***.XXX-XX
    .replace(/\d{3}\.\d{3}\.(\d{3}-\d{2})/g, '***.***.***-$1')
    // CNPJ: XX.XXX.XXX/XXXX-XX -> **.***.***/$1
    .replace(/\d{2}\.\d{3}\.\d{3}\/(\d{4}-\d{2})/g, '**.***.***/$1')
    // Credit card: keep last 4
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?(\d{4})\b/g, '****-****-****-$1')
    // JWT tokens
    .replace(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT_REDACTED]')
    // Generic long alphanumeric (API keys, tokens)
    .replace(/\b[a-zA-Z0-9]{32,}\b/g, '[TOKEN_REDACTED]');
}

/**
 * Redact PII from objects recursively (for logging request bodies).
 */
export function redactPIIFromObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return redactPII(obj);
  if (Array.isArray(obj)) return obj.map(redactPIIFromObject);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Fully redact sensitive field names
      const sensitiveKeys = ['password', 'secret', 'token', 'apikey', 'api_key', 'authorization', 'credit_card', 'cvv'];
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactPIIFromObject(value);
      }
    }
    return result;
  }
  return obj;
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown';
}
