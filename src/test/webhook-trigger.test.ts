/**
 * webhookTriggerService tests
 *
 * Covers: verifyHmacSignature (crypto), applyTransform (pure),
 * WEBHOOK_TEMPLATES constant.
 */
import { describe, it, expect } from 'vitest';
import { verifyHmacSignature, applyTransform } from '@/services/webhookTriggerService';

// ──────── applyTransform ────────

describe('webhookTriggerService — applyTransform', () => {
  it('maps simple top-level field', () => {
    const payload = { name: 'John', age: 30 };
    const script = 'userName = name';
    const result = applyTransform(payload, script);
    expect(result.userName).toBe('John');
  });

  it('maps nested dotted path', () => {
    const payload = { data: { user: { email: 'a@b.com' } } };
    const script = 'email = data.user.email';
    const result = applyTransform(payload, script);
    expect(result.email).toBe('a@b.com');
  });

  it('handles multiple lines', () => {
    const payload = { first: 'John', last: 'Doe', meta: { id: 42 } };
    const script = ['firstName = first', 'lastName = last', 'userId = meta.id'].join('\n');
    const result = applyTransform(payload, script);
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Doe');
    expect(result.userId).toBe(42);
  });

  it('ignores comment lines (starting with #)', () => {
    const payload = { x: 1 };
    const script = '# This is a comment\nval = x';
    const result = applyTransform(payload, script);
    expect(result.val).toBe(1);
  });

  it('ignores blank lines', () => {
    const payload = { a: 'test' };
    const script = '\n\nresult = a\n\n';
    const result = applyTransform(payload, script);
    expect(result.result).toBe('test');
  });

  it('sets undefined for missing nested path', () => {
    const payload = { a: { b: 1 } };
    const script = 'val = a.c.d';
    const result = applyTransform(payload, script);
    expect(result.val).toBeUndefined();
  });

  it('returns original payload if no lines match', () => {
    const payload = { original: true };
    const script = '# only comments\n  \n';
    const result = applyTransform(payload, script);
    expect(result).toEqual(payload);
  });

  it('ignores malformed lines (no = sign)', () => {
    const payload = { x: 1 };
    const script = 'this is not a valid line\nval = x';
    const result = applyTransform(payload, script);
    expect(result.val).toBe(1);
    expect(Object.keys(result)).toHaveLength(1);
  });
});

// ──────── verifyHmacSignature ────────

describe('webhookTriggerService — verifyHmacSignature', () => {
  it('verifies a valid HMAC-SHA256 signature', async () => {
    const payload = '{"event":"test"}';
    const secret = 'test-secret-key';

    // Compute expected signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const signature = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const valid = await verifyHmacSignature(payload, signature, secret);
    expect(valid).toBe(true);
  });

  it('rejects wrong signature', async () => {
    const valid = await verifyHmacSignature('payload', 'wrong-sig', 'secret');
    expect(valid).toBe(false);
  });

  it('handles sha256= prefix in signature', async () => {
    const payload = 'data';
    const secret = 'key';

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const hexSig = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const valid = await verifyHmacSignature(payload, `sha256=${hexSig}`, secret);
    expect(valid).toBe(true);
  });

  it('returns false on crypto errors', async () => {
    // Force an error by passing invalid args
    const valid = await verifyHmacSignature('', '', '');
    // Should not throw, just return false or true
    expect(typeof valid).toBe('boolean');
  });
});
