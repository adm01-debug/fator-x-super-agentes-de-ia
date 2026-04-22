/**
 * Rodada 9 — SSO adapter + Tool contract test framework.
 */
import { describe, it, expect } from 'vitest';
import {
  matchProviderByEmail,
  parseScimGroupPayload,
  parseScimUserPayload,
  type SsoProvider,
} from '@/lib/ssoAdapter';
import { DEFAULT_CONTRACT_FIXTURES, runContractTest } from '@/lib/toolContractTest';

function mkProvider(overrides: Partial<SsoProvider> = {}): SsoProvider {
  return {
    id: 'p1',
    workspace_id: 'ws1',
    domain: 'acme.com',
    protocol: 'oidc',
    display_name: 'ACME Okta',
    scim_enabled: true,
    enabled: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('ssoAdapter.matchProviderByEmail', () => {
  it('matches by email domain, case-insensitive', () => {
    const providers = [mkProvider({ domain: 'ACME.com' }), mkProvider({ domain: 'beta.io' })];
    const match = matchProviderByEmail('joao@acme.com', providers);
    expect(match?.domain).toBe('ACME.com');
  });

  it('returns null when no provider matches', () => {
    expect(matchProviderByEmail('x@y.com', [mkProvider()])).toBeNull();
  });

  it('ignores disabled providers', () => {
    const providers = [mkProvider({ enabled: false })];
    expect(matchProviderByEmail('x@acme.com', providers)).toBeNull();
  });

  it('returns null when email lacks @', () => {
    expect(matchProviderByEmail('invalid', [mkProvider()])).toBeNull();
  });
});

describe('ssoAdapter.parseScimUserPayload', () => {
  it('extracts primary email, display_name and groups', () => {
    const evt = parseScimUserPayload({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: 'u-123',
      externalId: 'ext-42',
      userName: 'joao@acme.com',
      displayName: 'João Silva',
      active: true,
      emails: [
        { value: 'old@acme.com', primary: false },
        { value: 'joao@acme.com', primary: true },
      ],
      groups: [{ value: 'g1', display: 'Sales' }],
    });
    expect(evt.email).toBe('joao@acme.com');
    expect(evt.display_name).toBe('João Silva');
    expect(evt.groups).toEqual(['g1']);
    expect(evt.external_id).toBe('ext-42');
    expect(evt.active).toBe(true);
  });

  it('throws for payloads without User schema', () => {
    expect(() => parseScimUserPayload({ schemas: ['other'], id: 'x' })).toThrow(/SCIM inválido/);
  });

  it('defaults active=true when field missing', () => {
    const evt = parseScimUserPayload({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: 'u',
      userName: 'a@b.com',
    });
    expect(evt.active).toBe(true);
  });
});

describe('ssoAdapter.parseScimGroupPayload', () => {
  it('extracts members and display_name', () => {
    const evt = parseScimGroupPayload({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: 'g1',
      displayName: 'Sales Team',
      members: [{ value: 'u1' }, { value: 'u2' }],
    });
    expect(evt.members).toEqual(['u1', 'u2']);
    expect(evt.display_name).toBe('Sales Team');
  });
});

describe('toolContractTest.runContractTest (input-only mode)', () => {
  it('passes when input matches schema (no executor)', async () => {
    const report = await runContractTest('search_knowledge');
    expect(report.fixtures_tested).toBeGreaterThan(0);
    expect(report.failed).toBe(0);
    expect(report.details[0].input_valid).toBe(true);
  });

  it('fails when input is invalid', async () => {
    const report = await runContractTest('search_knowledge', [
      { name: 'invalid input', input: { wrong: 'shape' } },
    ]);
    expect(report.failed).toBe(1);
    expect(report.details[0].input_valid).toBe(false);
  });

  it('returns fail for unknown tool', async () => {
    const report = await runContractTest('does_not_exist');
    expect(report.failed).toBeGreaterThan(0);
    expect(report.details[0].error).toMatch(/TOOL_CATALOG/);
  });

  it('skips real tools that have no fixtures', async () => {
    // cache_get é tool real no catálogo mas não tem fixture default
    const report = await runContractTest('cache_get', []);
    expect(report.skipped).toBe(1);
    expect(report.failed).toBe(0);
  });
});

describe('toolContractTest.runContractTest (with mock executor)', () => {
  it('validates output against output_schema', async () => {
    const report = await runContractTest('guard_input', DEFAULT_CONTRACT_FIXTURES.guard_input, {
      execute: async () => ({
        action: 'allow',
        rails: [{ rail: 'test', layer: 'input', action: 'allow', confidence: 0.1, reason: 'ok' }],
      }),
    });
    expect(report.passed).toBe(2);
    expect(report.failed).toBe(0);
  });

  it('flags output that violates schema', async () => {
    const report = await runContractTest('guard_input', [{ name: 'x', input: { text: 'hi' } }], {
      execute: async () => ({ totally: 'wrong' }),
    });
    expect(report.failed).toBe(1);
    expect(report.details[0].output_valid).toBe(false);
  });
});
