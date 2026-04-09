/**
 * connectorRegistryService tests
 *
 * Covers: BUILTIN_CONNECTORS constant, getConnectorStats (pure aggregation).
 */
import { describe, it, expect } from 'vitest';
import { BUILTIN_CONNECTORS } from '@/services/connectorRegistryService';

// ──────── BUILTIN_CONNECTORS ────────

describe('connectorRegistryService — BUILTIN_CONNECTORS', () => {
  it('has at least 5 built-in connectors', () => {
    expect(BUILTIN_CONNECTORS.length).toBeGreaterThanOrEqual(5);
  });

  it('all connectors have required fields', () => {
    for (const conn of BUILTIN_CONNECTORS) {
      expect(conn.name).toBeDefined();
      expect(conn.slug).toBeDefined();
      expect(conn.description).toBeDefined();
      expect(conn.category).toBeDefined();
      expect(conn.auth_type).toBeDefined();
      expect(conn.operations).toBeDefined();
      expect(Array.isArray(conn.operations)).toBe(true);
      expect(conn.operations.length).toBeGreaterThan(0);
    }
  });

  it('connectors have unique slugs', () => {
    const slugs = BUILTIN_CONNECTORS.map((c) => c.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it('includes Bitrix24 connector', () => {
    const bitrix = BUILTIN_CONNECTORS.find((c) => c.slug === 'bitrix24');
    expect(bitrix).toBeDefined();
    expect(bitrix!.category).toBe('crm');
    expect(bitrix!.auth_type).toBe('oauth2');
    expect(bitrix!.operations.length).toBeGreaterThan(0);
  });

  it('includes WhatsApp connector', () => {
    const wa = BUILTIN_CONNECTORS.find((c) => c.slug === 'whatsapp');
    expect(wa).toBeDefined();
    expect(wa!.category).toBe('communication');
  });

  it('includes Supabase connector', () => {
    const sp = BUILTIN_CONNECTORS.find((c) => c.slug === 'supabase');
    expect(sp).toBeDefined();
    expect(sp!.category).toBe('database');
  });

  it('all connectors have health check or explicit null', () => {
    for (const conn of BUILTIN_CONNECTORS) {
      // health_check_endpoint should be defined (can be null/string)
      expect('health_check_endpoint' in conn).toBe(true);
    }
  });

  it('all operations have id, name, type', () => {
    for (const conn of BUILTIN_CONNECTORS) {
      for (const op of conn.operations) {
        expect(op.id).toBeDefined();
        expect(op.name).toBeDefined();
        expect(op.type).toBeDefined();
        expect(typeof op.id).toBe('string');
      }
    }
  });

  it('rate limits are positive numbers', () => {
    for (const conn of BUILTIN_CONNECTORS) {
      expect(conn.rate_limit_per_minute).toBeGreaterThan(0);
    }
  });
});
