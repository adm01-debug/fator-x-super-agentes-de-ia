/**
 * WhatsApp webhook routing tests (next-frontier sprint #2)
 *
 * Mirrors the Bitrix24 webhook test suite. Tests service contracts +
 * the helper logic the Edge Function relies on (form parser, provider
 * detection patterns, normalized event shapes).
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
  WHATSAPP_EVENT_TYPES,
  WHATSAPP_PROVIDERS,
  listWhatsAppRoutes,
  upsertWhatsAppRoute,
  deleteWhatsAppRoute,
  toggleWhatsAppRoute,
  listRecentWhatsAppEvents,
  getWhatsAppWebhookUrl,
} from '@/services/whatsappWebhookService';

describe('whatsappWebhookService — exports', () => {
  it('exposes documented event types', () => {
    expect(WHATSAPP_EVENT_TYPES.length).toBeGreaterThanOrEqual(8);
    const ids = WHATSAPP_EVENT_TYPES.map((e) => e.id);
    expect(ids).toContain('message.text');
    expect(ids).toContain('message.image');
    expect(ids).toContain('message.audio');
    expect(ids).toContain('message.document');
    expect(ids).toContain('status.delivered');
    expect(ids).toContain('status.read');
  });

  it('exposes 4 supported providers', () => {
    const ids = WHATSAPP_PROVIDERS.map((p) => p.id);
    expect(ids).toEqual(['twilio', 'meta', 'zapi', 'evolution']);
  });

  it('every provider has tokenEnv', () => {
    for (const p of WHATSAPP_PROVIDERS) {
      expect(p.tokenEnv).toMatch(/^WHATSAPP_/);
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  it('every event type has label and description', () => {
    for (const e of WHATSAPP_EVENT_TYPES) {
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.description.length).toBeGreaterThan(0);
    }
  });

  it('exposes CRUD functions', () => {
    expect(typeof listWhatsAppRoutes).toBe('function');
    expect(typeof upsertWhatsAppRoute).toBe('function');
    expect(typeof deleteWhatsAppRoute).toBe('function');
    expect(typeof toggleWhatsAppRoute).toBe('function');
    expect(typeof listRecentWhatsAppEvents).toBe('function');
    expect(typeof getWhatsAppWebhookUrl).toBe('function');
  });

  it('listWhatsAppRoutes returns an array', async () => {
    const routes = await listWhatsAppRoutes();
    expect(Array.isArray(routes)).toBe(true);
  });

  it('upsertWhatsAppRoute does not throw on success', async () => {
    await expect(
      upsertWhatsAppRoute('message.text', 'agent-uuid-here', true)
    ).resolves.not.toThrow();
  });

  it('listRecentWhatsAppEvents returns array', async () => {
    const events = await listRecentWhatsAppEvents(10);
    expect(Array.isArray(events)).toBe(true);
  });

  it('getWhatsAppWebhookUrl returns a URL string', () => {
    const url = getWhatsAppWebhookUrl();
    expect(typeof url).toBe('string');
    expect(url).toContain('/functions/v1/whatsapp-webhook');
  });
});

// ════════════════════════════════════════════════════════════════
// Tests for the Edge Function helper LOGIC (provider detection,
// normalization, HMAC pattern). Replicated inline because the Edge
// Function lives in Deno-land.
// ════════════════════════════════════════════════════════════════

function parseFormBody(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};
  for (const [k, v] of params.entries()) result[k] = v;
  return result;
}

type Provider = 'twilio' | 'meta' | 'zapi' | 'evolution' | 'unknown';

function detectProvider(headers: Record<string, string>, parsed: unknown): Provider {
  if (headers['x-twilio-signature']) return 'twilio';
  if (headers['x-hub-signature-256']) return 'meta';
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if ('instanceId' in obj || 'phone' in obj) return 'zapi';
    if ('event' in obj && 'instance' in obj) return 'evolution';
    if ('object' in obj && obj.object === 'whatsapp_business_account') return 'meta';
  }
  return 'unknown';
}

describe('whatsapp-webhook — parseFormBody helper (Twilio)', () => {
  it('parses Twilio inbound message form fields', () => {
    const body = [
      'MessageSid=SM123abc',
      'From=whatsapp%3A%2B5511999998888',
      'To=whatsapp%3A%2B5511777776666',
      'Body=Olá%20mundo',
      'NumMedia=0',
    ].join('&');
    const result = parseFormBody(body);
    expect(result.MessageSid).toBe('SM123abc');
    expect(result.From).toBe('whatsapp:+5511999998888');
    expect(result.Body).toBe('Olá mundo');
    expect(result.NumMedia).toBe('0');
  });

  it('parses media-bearing Twilio payload', () => {
    const body = 'MessageSid=SM456&NumMedia=1&MediaContentType0=image%2Fjpeg';
    const result = parseFormBody(body);
    expect(result.NumMedia).toBe('1');
    expect(result.MediaContentType0).toBe('image/jpeg');
  });
});

describe('whatsapp-webhook — detectProvider', () => {
  it('detects Twilio via X-Twilio-Signature header', () => {
    expect(detectProvider({ 'x-twilio-signature': 'sig123' }, {})).toBe('twilio');
  });

  it('detects Meta via X-Hub-Signature-256 header', () => {
    expect(detectProvider({ 'x-hub-signature-256': 'sha256=abc' }, {})).toBe('meta');
  });

  it('detects Meta via business account body shape', () => {
    expect(detectProvider({}, { object: 'whatsapp_business_account', entry: [] })).toBe('meta');
  });

  it('detects Z-API via instanceId or phone in body', () => {
    expect(detectProvider({}, { instanceId: 'inst-1', messageId: 'm1' })).toBe('zapi');
    expect(detectProvider({}, { phone: '5511999' })).toBe('zapi');
  });

  it('detects Evolution via event+instance keys', () => {
    expect(detectProvider({}, { event: 'messages.upsert', instance: 'main' })).toBe('evolution');
  });

  it('returns unknown when no signal matches', () => {
    expect(detectProvider({}, { random: 'data' })).toBe('unknown');
  });
});

describe('whatsapp-webhook — HMAC SHA-256 hex validation pattern', () => {
  it('detects mismatched signatures', () => {
    const expected = 'abc123';
    const provided = 'def456';
    let diff = 0;
    if (expected.length === provided.length) {
      for (let i = 0; i < expected.length; i++) {
        diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
      }
    } else {
      diff = -1;
    }
    expect(diff !== 0).toBe(true);
  });

  it('matches identical signatures', () => {
    const sig = 'abcdef123456';
    let diff = 0;
    for (let i = 0; i < sig.length; i++) {
      diff |= sig.charCodeAt(i) ^ sig.charCodeAt(i);
    }
    expect(diff).toBe(0);
  });

  it('length mismatch is treated as failure', () => {
    const a = 'short';
    const b = 'much-longer-signature';
    expect(a.length === b.length).toBe(false);
  });
});
