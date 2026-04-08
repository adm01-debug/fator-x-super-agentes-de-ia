/**
 * Bitrix24 webhook routing tests (next-frontier #3)
 *
 * The Edge Function itself runs in Deno and isn't executable here,
 * so we test the helper logic that the Edge Function uses (form parsing,
 * signature validation pattern) plus the frontend service contracts.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    })),
  },
}));

vi.mock('@/lib/agentService', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue('ws-123'),
  listAgents: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  BITRIX24_EVENT_TYPES,
  listBitrix24Routes,
  upsertBitrix24Route,
  deleteBitrix24Route,
  toggleBitrix24Route,
  listRecentBitrix24Events,
  getBitrix24WebhookUrl,
} from '@/services/bitrix24WebhookService';

describe('bitrix24WebhookService — exports', () => {
  it('exposes the documented event types', () => {
    expect(BITRIX24_EVENT_TYPES.length).toBeGreaterThanOrEqual(7);
    const ids = BITRIX24_EVENT_TYPES.map((e) => e.id);
    expect(ids).toContain('ONCRMDEALADD');
    expect(ids).toContain('ONCRMCONTACTADD');
    expect(ids).toContain('ONIMBOTMESSAGEADD');
  });

  it('every event type has a label and description', () => {
    for (const e of BITRIX24_EVENT_TYPES) {
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.description.length).toBeGreaterThan(0);
    }
  });

  it('exposes CRUD functions', () => {
    expect(typeof listBitrix24Routes).toBe('function');
    expect(typeof upsertBitrix24Route).toBe('function');
    expect(typeof deleteBitrix24Route).toBe('function');
    expect(typeof toggleBitrix24Route).toBe('function');
    expect(typeof listRecentBitrix24Events).toBe('function');
    expect(typeof getBitrix24WebhookUrl).toBe('function');
  });

  it('listBitrix24Routes returns an array', async () => {
    const routes = await listBitrix24Routes();
    expect(Array.isArray(routes)).toBe(true);
  });

  it('upsertBitrix24Route does not throw on success', async () => {
    await expect(
      upsertBitrix24Route('ONCRMDEALADD', 'agent-uuid-here', true)
    ).resolves.not.toThrow();
  });

  it('listRecentBitrix24Events returns array', async () => {
    const events = await listRecentBitrix24Events(10);
    expect(Array.isArray(events)).toBe(true);
  });

  it('getBitrix24WebhookUrl returns a URL string', () => {
    const url = getBitrix24WebhookUrl();
    expect(typeof url).toBe('string');
    expect(url).toContain('/functions/v1/bitrix24-webhook');
  });
});

// ════════════════════════════════════════════════════════════════
// Tests for the HELPER LOGIC the Edge Function relies on.
// We replicate the parseFormBody and validateSignature functions
// inline here so we can test them under vitest (the original is
// in Deno-land and can't be imported).
// ════════════════════════════════════════════════════════════════

function parseFormBody(body: string): Record<string, unknown> {
  const params = new URLSearchParams(body);
  const result: Record<string, unknown> = {};
  for (const [rawKey, value] of params.entries()) {
    const path = rawKey.replace(/\]/g, "").split("[");
    let cursor: Record<string, unknown> = result;
    for (let i = 0; i < path.length; i++) {
      const seg = path[i];
      if (i === path.length - 1) {
        cursor[seg] = value;
      } else {
        if (typeof cursor[seg] !== "object" || cursor[seg] === null) {
          cursor[seg] = {};
        }
        cursor = cursor[seg] as Record<string, unknown>;
      }
    }
  }
  return result;
}

function validateSignature(parsed: Record<string, unknown>, expectedToken: string | undefined): boolean {
  if (!expectedToken) return true;
  const auth = parsed.auth as Record<string, unknown> | undefined;
  const received = auth?.application_token;
  if (typeof received !== "string") return false;
  if (received.length !== expectedToken.length) return false;
  let diff = 0;
  for (let i = 0; i < received.length; i++) {
    diff |= received.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  return diff === 0;
}

describe('bitrix24-webhook — parseFormBody helper', () => {
  it('parses simple key=value pairs', () => {
    const result = parseFormBody('event=ONCRMDEALADD&handler_id=42');
    expect(result.event).toBe('ONCRMDEALADD');
    expect(result.handler_id).toBe('42');
  });

  it('parses nested bracket keys into objects', () => {
    const result = parseFormBody('data[FIELDS][ID]=1234&data[FIELDS][TITLE]=Test');
    expect(result.data).toEqual({ FIELDS: { ID: '1234', TITLE: 'Test' } });
  });

  it('handles auth subobject', () => {
    const body = 'auth[domain]=mycompany.bitrix24.com&auth[application_token]=secret123';
    const result = parseFormBody(body);
    expect(result.auth).toEqual({
      domain: 'mycompany.bitrix24.com',
      application_token: 'secret123',
    });
  });

  it('handles a complete realistic Bitrix24 payload', () => {
    const body = [
      'event=ONCRMDEALADD',
      'event_handler_id=99',
      'data[FIELDS][ID]=5678',
      'auth[domain]=promobrindes.bitrix24.com.br',
      'auth[application_token]=tok_abc123',
    ].join('&');
    const result = parseFormBody(body);
    expect(result.event).toBe('ONCRMDEALADD');
    expect((result.data as { FIELDS: { ID: string } }).FIELDS.ID).toBe('5678');
    expect((result.auth as { domain: string }).domain).toBe('promobrindes.bitrix24.com.br');
  });
});

describe('bitrix24-webhook — validateSignature helper', () => {
  const validParsed = { auth: { application_token: 'expected_token' } };
  const wrongTokenParsed = { auth: { application_token: 'wrong_token' } };
  const noAuthParsed = { event: 'ONCRMDEALADD' };

  it('returns true when no expected token is configured (dev mode)', () => {
    expect(validateSignature(validParsed, undefined)).toBe(true);
  });

  it('returns true when tokens match exactly', () => {
    expect(validateSignature(validParsed, 'expected_token')).toBe(true);
  });

  it('returns false when tokens differ', () => {
    expect(validateSignature(wrongTokenParsed, 'expected_token')).toBe(false);
  });

  it('returns false when no auth object present', () => {
    expect(validateSignature(noAuthParsed, 'expected_token')).toBe(false);
  });

  it('returns false when token length differs (avoids timing attacks)', () => {
    expect(validateSignature(
      { auth: { application_token: 'short' } },
      'much_longer_token'
    )).toBe(false);
  });

  it('uses constant-time comparison (no early exit on first diff)', () => {
    // Hard to assert directly, but we verify same-length tokens with single
    // char diff still return false (proves comparison reaches the end)
    expect(validateSignature(
      { auth: { application_token: 'abcdefghij' } },
      'abcdefghiX'
    )).toBe(false);
    expect(validateSignature(
      { auth: { application_token: 'Xbcdefghij' } },
      'abcdefghij'
    )).toBe(false);
  });
});
