/**
 * credentialVaultService tests
 *
 * Covers: encryptData/decryptData (crypto round-trip),
 * CREDENTIAL_TEMPLATES constant.
 */
import { describe, it, expect } from 'vitest';
import { encryptData, decryptData, CREDENTIAL_TEMPLATES } from '@/services/credentialVaultService';

// ──────── encryptData / decryptData ────────

describe('credentialVaultService — encryption round-trip', () => {
  it('encrypts and decrypts simple credentials', async () => {
    const original = { api_key: 'sk-12345', secret: 'mysecret' };
    const encrypted = await encryptData(original);

    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toContain('sk-12345');

    const decrypted = await decryptData(encrypted);
    expect(decrypted).toEqual(original);
  });

  it('encrypts and decrypts complex nested data', async () => {
    const original = {
      host: 'db.example.com',
      port: 5432,
      user: 'admin',
      password: 'p@ssw0rd!',
      ssl: true,
      empty: null,
    };
    const encrypted = await encryptData(original);
    const decrypted = await decryptData(encrypted);
    expect(decrypted).toEqual(original);
  });

  it('encrypted output is base64', async () => {
    const encrypted = await encryptData({ key: 'value' });
    // Valid base64 should decode without error
    expect(() => atob(encrypted)).not.toThrow();
  });

  it('each encryption produces different ciphertext (random IV)', async () => {
    const data = { key: 'same-value' };
    const enc1 = await encryptData(data);
    const enc2 = await encryptData(data);
    expect(enc1).not.toBe(enc2); // Different IVs → different ciphertext
  });

  it('handles empty credentials', async () => {
    const original = {};
    const encrypted = await encryptData(original);
    const decrypted = await decryptData(encrypted);
    expect(decrypted).toEqual(original);
  });

  it('handles special characters in values', async () => {
    const original = {
      password: 'p@$$w0rd!#%^&*()_+-=[]{}|;:,.<>?/~`',
      unicode: 'Ação Conexão Ñ',
    };
    const encrypted = await encryptData(original);
    const decrypted = await decryptData(encrypted);
    expect(decrypted).toEqual(original);
  });

  it('rejects tampered ciphertext', async () => {
    const encrypted = await encryptData({ secret: 'data' });
    // Tamper with the base64 string
    const chars = encrypted.split('');
    const idx = Math.floor(chars.length / 2);
    chars[idx] = chars[idx] === 'A' ? 'B' : 'A';
    const tampered = chars.join('');

    await expect(decryptData(tampered)).rejects.toThrow();
  });
});

// ──────── CREDENTIAL_TEMPLATES ────────

describe('credentialVaultService — CREDENTIAL_TEMPLATES', () => {
  it('is a non-empty object', () => {
    expect(Object.keys(CREDENTIAL_TEMPLATES).length).toBeGreaterThan(0);
  });

  it('all templates have required fields', () => {
    for (const [_key, tmpl] of Object.entries(CREDENTIAL_TEMPLATES)) {
      expect(tmpl.label).toBeDefined();
      expect(tmpl.type).toBeDefined();
      expect(tmpl.service).toBeDefined();
      expect(tmpl.fields).toBeDefined();
      expect(Array.isArray(tmpl.fields)).toBe(true);
      expect(tmpl.fields.length).toBeGreaterThan(0);
    }
  });

  it('all template fields are strings (credential field names)', () => {
    for (const [, tmpl] of Object.entries(CREDENTIAL_TEMPLATES)) {
      for (const field of tmpl.fields) {
        expect(typeof field).toBe('string');
        expect(field.length).toBeGreaterThan(0);
      }
    }
  });
});
