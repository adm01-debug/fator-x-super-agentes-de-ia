/**
 * Nexus Agents Studio — Security Utilities
 * 
 * Provides:
 * - Constant-time string comparison (timing attack prevention)
 * - HMAC signature validation (raw body)
 * - CIDR-based IP allowlisting
 * - PII redaction for logging
 */

import { timingSafeEqual } from "https://deno.land/std@0.208.0/crypto/timing_safe_equal.ts";

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) {
    // Still do comparison to avoid length-based timing leak
    const dummy = new Uint8Array(32);
    timingSafeEqual(dummy, dummy);
    return false;
  }
  return timingSafeEqual(aBytes, bBytes);
}

/**
 * Verify HMAC signature using raw request body.
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
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      bodyBytes as unknown as BufferSource
    );
    const computed = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
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

export const KNOWN_WEBHOOK_CIDRS = [
  '3.217.0.0/16',
  '52.0.0.0/8',
  '54.0.0.0/8',
  '18.0.0.0/8',
  '127.0.0.1/32',
  '10.0.0.0/8',
];

/**
 * Redact PII from strings for safe logging.
 */
export function redactPII(input: string): string {
  if (!input || typeof input !== 'string') return input;
  
  return input
    .replace(/([a-zA-Z0-9._%+-]{2})[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1***@$2')
    .replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}/g, (m) => `***${m.slice(-4)}`)
    .replace(/\d{3}\.\d{3}\.(\d{3}-\d{2})/g, '***.***.***-$1')
    .replace(/\d{2}\.\d{3}\.\d{3}\/(\d{4}-\d{2})/g, '**.***.***/$1')
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?(\d{4})\b/g, '****-****-****-$1')
    .replace(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT_REDACTED]')
    .replace(/\b[a-zA-Z0-9]{32,}\b/g, '[TOKEN_REDACTED]');
}

/**
 * Redact PII from objects recursively.
 */
export function redactPIIFromObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return redactPII(obj);
  if (Array.isArray(obj)) return obj.map(redactPIIFromObject);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
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
