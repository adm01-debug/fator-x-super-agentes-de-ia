/**
 * whatsappOutboundService tests (sprint #4)
 *
 * Tests the public sendMessage entry point and the 4 provider-specific
 * dispatchers via mocked fetch + workspace_secrets lookup.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

const secretsByProvider: Record<string, Record<string, string>> = {
  meta: {
    whatsapp_outbound_active_provider: 'meta',
    whatsapp_outbound_meta_phone_number_id: 'pn-123',
    whatsapp_outbound_meta_access_token: 'tok-meta',
  },
  twilio: {
    whatsapp_outbound_active_provider: 'twilio',
    whatsapp_outbound_twilio_account_sid: 'AC123',
    whatsapp_outbound_twilio_auth_token: 'tok-twilio',
    whatsapp_outbound_twilio_from_phone: '+5511777777777',
  },
  zapi: {
    whatsapp_outbound_active_provider: 'zapi',
    whatsapp_outbound_zapi_instance_id: 'inst-1',
    whatsapp_outbound_zapi_token: 'tok-zapi',
  },
  evolution: {
    whatsapp_outbound_active_provider: 'evolution',
    whatsapp_outbound_evolution_base_url: 'https://evo.example.com',
    whatsapp_outbound_evolution_instance: 'main',
    whatsapp_outbound_evolution_apikey: 'tok-evo',
  },
  invalid: {
    whatsapp_outbound_active_provider: 'unknown_provider',
  },
  meta_incomplete: {
    whatsapp_outbound_active_provider: 'meta',
    // missing access_token
    whatsapp_outbound_meta_phone_number_id: 'pn-123',
  },
};

let activeProviderKey: keyof typeof secretsByProvider = 'meta';

vi.mock('@/integrations/supabase/externalClient', () => ({
  supabaseExternal: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      like: vi.fn().mockImplementation(() => {
        const map = secretsByProvider[activeProviderKey];
        // Service expects column name `encrypted_value`
        const data = Object.entries(map).map(([key_name, encrypted_value]) => ({ key_name, encrypted_value }));
        return Promise.resolve({ data, error: null });
      }),
    })),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() })) },
}));

vi.mock('@/lib/agentService', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue('ws-1'),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  sendWhatsAppMessage,
  sendWhatsAppText,
  sendWhatsAppImage,
  sendWhatsAppDocument,
  sendWhatsAppTemplate,
} from '@/services/whatsappOutboundService';

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  activeProviderKey = 'meta';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('whatsappOutboundService — sendWhatsAppMessage (Meta provider)', () => {
  it('sends a plain text message via Meta', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.123' }] }),
    });
    const result = await sendWhatsAppMessage({ to: '+5511999999999', text: 'oi mundo' });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe('meta');
    expect(result.message_id).toBe('wamid.123');

    // Verify the URL was the Meta Graph API
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('graph.facebook.com'),
      expect.objectContaining({ method: 'POST' })
    );
    // Verify Authorization header
    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers['Authorization']).toBe('Bearer tok-meta');
  });

  it('sends an image message with caption', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.img-1' }] }),
    });
    const result = await sendWhatsAppImage('+5511999999999', 'https://example.com/x.jpg', 'foto');
    expect(result.ok).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe('image');
    expect(body.image.link).toBe('https://example.com/x.jpg');
    expect(body.image.caption).toBe('foto');
  });

  it('sends a document message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.doc-1' }] }),
    });
    await sendWhatsAppDocument('+5511999999999', 'https://example.com/contract.pdf', 'contract.pdf');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe('document');
    expect(body.document.link).toBe('https://example.com/contract.pdf');
    expect(body.document.filename).toBe('contract.pdf');
  });

  it('sends a template message with positional params', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.tpl-1' }] }),
    });
    await sendWhatsAppTemplate('+5511999999999', 'order_confirmation', ['Joaquim', '#1234'], 'pt_BR');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe('template');
    expect(body.template.name).toBe('order_confirmation');
    expect(body.template.language.code).toBe('pt_BR');
    expect(body.template.components[0].parameters).toEqual([
      { type: 'text', text: 'Joaquim' },
      { type: 'text', text: '#1234' },
    ]);
  });

  it('returns ok:false on Meta API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid recipient' } }),
    });
    const result = await sendWhatsAppMessage({ to: 'invalid', text: 'oi' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Invalid recipient');
  });

  it('throws when Meta config is incomplete', async () => {
    activeProviderKey = 'meta_incomplete';
    const result = await sendWhatsAppMessage({ to: '+55119', text: 'x' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Meta config incomplete');
  });
});

describe('whatsappOutboundService — Twilio provider', () => {
  it('sends a text via Twilio with Basic auth', async () => {
    activeProviderKey = 'twilio';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sid: 'SM-twilio-1' }),
    });
    const result = await sendWhatsAppText('+5511999999999', 'olá');
    expect(result.ok).toBe(true);
    expect(result.provider).toBe('twilio');
    expect(result.message_id).toBe('SM-twilio-1');

    // Auth check
    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers['Authorization']).toMatch(/^Basic /);
    // Body has whatsapp: prefix
    expect(callArgs.body).toContain('whatsapp%3A%2B5511999999999');
  });
});

describe('whatsappOutboundService — Z-API provider', () => {
  it('sends text to Z-API endpoint', async () => {
    activeProviderKey = 'zapi';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: 'zapi-id-1' }),
    });
    const result = await sendWhatsAppText('+5511999999999', 'oi');
    expect(result.ok).toBe(true);
    expect(result.provider).toBe('zapi');
    expect(result.message_id).toBe('zapi-id-1');
    expect(mockFetch.mock.calls[0][0]).toContain('/instances/inst-1/token/tok-zapi/send-text');
  });

  it('uses send-image endpoint for images', async () => {
    activeProviderKey = 'zapi';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: 'zapi-img-1' }),
    });
    await sendWhatsAppImage('+5511999999999', 'https://x.com/y.jpg', 'cap');
    expect(mockFetch.mock.calls[0][0]).toContain('/send-image');
  });
});

describe('whatsappOutboundService — Evolution provider', () => {
  it('sends text to Evolution endpoint with apikey header', async () => {
    activeProviderKey = 'evolution';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ key: { id: 'evo-1' } }),
    });
    const result = await sendWhatsAppText('+5511999999999', 'oi');
    expect(result.ok).toBe(true);
    expect(result.provider).toBe('evolution');
    expect(result.message_id).toBe('evo-1');
    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers['apikey']).toBe('tok-evo');
    expect(mockFetch.mock.calls[0][0]).toContain('/message/sendText/main');
  });
});

describe('whatsappOutboundService — invalid provider config', () => {
  it('throws when active_provider is unknown', async () => {
    activeProviderKey = 'invalid';
    await expect(sendWhatsAppMessage({ to: '+5511', text: 'x' }))
      .rejects.toThrow(/Unknown active WhatsApp provider/);
  });
});
