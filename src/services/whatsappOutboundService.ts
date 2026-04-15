/**
 * WhatsApp Outbound Service — Nexus Agents Studio (sprint #4)
 *
 * Companion to whatsappWebhookService (which handles inbound). This
 * module provides a unified sendMessage interface that abstracts the
 * 4 supported providers (Twilio / Meta Cloud API / Z-API / Evolution).
 *
 * Architecture:
 *   - Provider configs live in workspace_secrets (key_name pattern:
 *     whatsapp_outbound_{provider}_{config})
 *   - sendMessage auto-selects the active provider via
 *     workspace_secrets.whatsapp_outbound_active_provider
 *   - Every send is wrapped in a trace span via the existing tracer,
 *     so outbound messages show up in MonitoringPage > Traces
 *     alongside inbound webhooks for end-to-end visibility
 *   - Supports text, image, document, and template messages
 *
 * Operator setup (per provider):
 *   Twilio:    workspace_secrets keys: whatsapp_outbound_twilio_account_sid,
 *              whatsapp_outbound_twilio_auth_token,
 *              whatsapp_outbound_twilio_from_phone
 *   Meta:      whatsapp_outbound_meta_phone_number_id,
 *              whatsapp_outbound_meta_access_token
 *   Z-API:     whatsapp_outbound_zapi_instance_id,
 *              whatsapp_outbound_zapi_token
 *   Evolution: whatsapp_outbound_evolution_base_url,
 *              whatsapp_outbound_evolution_instance,
 *              whatsapp_outbound_evolution_apikey
 */
import { logger } from '@/lib/logger';
import { getWorkspaceId } from '@/lib/agentService';
import { withTrace } from '@/lib/tracing';

export type WhatsAppProvider = 'twilio' | 'meta' | 'zapi' | 'evolution';

export interface WhatsAppMessageInput {
  to: string;                            // E.164 phone number
  text?: string;                         // Plain text body
  imageUrl?: string;                     // Public URL to image
  documentUrl?: string;                  // Public URL to document
  documentFilename?: string;             // Display name for document
  caption?: string;                      // Caption for image/document
  templateName?: string;                 // Meta template name
  templateLanguage?: string;             // Meta template language code (e.g., 'pt_BR')
  templateParams?: string[];             // Positional template params
}

export interface WhatsAppSendResult {
  ok: boolean;
  provider: WhatsAppProvider;
  message_id: string | null;
  raw_response?: unknown;
  error?: string;
}

// ─────────────────────────────────────────────────────────
// Workspace secrets helper
// ─────────────────────────────────────────────────────────

interface ProviderSecrets {
  provider: WhatsAppProvider;
  config: Record<string, string>;
}

async function loadActiveProviderConfig(): Promise<ProviderSecrets> {
  const wsId = await getWorkspaceId();
  const { data, error } = await supabaseExternal
    .from('workspace_secrets')
    .select('key_name, encrypted_value')
    .eq('workspace_id', wsId)
    .like('key_name', 'whatsapp_outbound_%');
  if (error) throw error;

  const map: Record<string, string> = {};
  for (const row of (data ?? []) as unknown as Array<{ key_name: string; encrypted_value: string }>) {
    map[row.key_name] = row.encrypted_value;
  }

  const provider = (map['whatsapp_outbound_active_provider'] ?? 'meta') as WhatsAppProvider;
  if (!['twilio', 'meta', 'zapi', 'evolution'].includes(provider)) {
    throw new Error(`Unknown active WhatsApp provider: ${provider}`);
  }

  // Strip the provider prefix from keys for cleaner access
  const prefix = `whatsapp_outbound_${provider}_`;
  const config: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (k.startsWith(prefix)) config[k.slice(prefix.length)] = v;
  }

  return { provider, config };
}

// ─────────────────────────────────────────────────────────
// Per-provider senders
// ─────────────────────────────────────────────────────────

async function sendViaTwilio(
  config: Record<string, string>,
  input: WhatsAppMessageInput,
): Promise<WhatsAppSendResult> {
  const sid = config.account_sid;
  const token = config.auth_token;
  const from = config.from_phone;
  if (!sid || !token || !from) throw new Error('Twilio config incomplete');

  const body = new URLSearchParams();
  body.set('From', `whatsapp:${from}`);
  body.set('To', `whatsapp:${input.to}`);
  if (input.imageUrl) body.set('MediaUrl', input.imageUrl);
  if (input.documentUrl) body.set('MediaUrl', input.documentUrl);
  body.set('Body', input.text ?? input.caption ?? '');

  const auth = btoa(`${sid}:${token}`);
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const data = (await resp.json()) as { sid?: string; message?: string };
  if (!resp.ok) {
    return { ok: false, provider: 'twilio', message_id: null, raw_response: data, error: data.message ?? `HTTP ${resp.status}` };
  }
  return { ok: true, provider: 'twilio', message_id: data.sid ?? null, raw_response: data };
}

async function sendViaMeta(
  config: Record<string, string>,
  input: WhatsAppMessageInput,
): Promise<WhatsAppSendResult> {
  const phoneNumberId = config.phone_number_id;
  const accessToken = config.access_token;
  if (!phoneNumberId || !accessToken) throw new Error('Meta config incomplete');

  let payload: Record<string, unknown>;
  if (input.templateName) {
    payload = {
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'template',
      template: {
        name: input.templateName,
        language: { code: input.templateLanguage ?? 'pt_BR' },
        components: input.templateParams && input.templateParams.length > 0
          ? [{
              type: 'body',
              parameters: input.templateParams.map((text) => ({ type: 'text', text })),
            }]
          : [],
      },
    };
  } else if (input.imageUrl) {
    payload = {
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'image',
      image: { link: input.imageUrl, caption: input.caption ?? '' },
    };
  } else if (input.documentUrl) {
    payload = {
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'document',
      document: {
        link: input.documentUrl,
        filename: input.documentFilename ?? 'document',
        caption: input.caption ?? '',
      },
    };
  } else {
    payload = {
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'text',
      text: { body: input.text ?? '' },
    };
  }

  const resp = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = (await resp.json()) as { messages?: Array<{ id?: string }>; error?: { message: string } };
  if (!resp.ok) {
    return { ok: false, provider: 'meta', message_id: null, raw_response: data, error: data.error?.message ?? `HTTP ${resp.status}` };
  }
  return { ok: true, provider: 'meta', message_id: data.messages?.[0]?.id ?? null, raw_response: data };
}

async function sendViaZapi(
  config: Record<string, string>,
  input: WhatsAppMessageInput,
): Promise<WhatsAppSendResult> {
  const instanceId = config.instance_id;
  const token = config.token;
  if (!instanceId || !token) throw new Error('Z-API config incomplete');

  let endpoint = 'send-text';
  let body: Record<string, unknown> = { phone: input.to, message: input.text ?? '' };
  if (input.imageUrl) {
    endpoint = 'send-image';
    body = { phone: input.to, image: input.imageUrl, caption: input.caption ?? '' };
  } else if (input.documentUrl) {
    endpoint = 'send-document/pdf';
    body = { phone: input.to, document: input.documentUrl, fileName: input.documentFilename ?? 'doc' };
  }

  const resp = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await resp.json()) as { id?: string; messageId?: string; error?: string };
  if (!resp.ok) {
    return { ok: false, provider: 'zapi', message_id: null, raw_response: data, error: data.error ?? `HTTP ${resp.status}` };
  }
  return { ok: true, provider: 'zapi', message_id: data.messageId ?? data.id ?? null, raw_response: data };
}

async function sendViaEvolution(
  config: Record<string, string>,
  input: WhatsAppMessageInput,
): Promise<WhatsAppSendResult> {
  const baseUrl = config.base_url;
  const instance = config.instance;
  const apikey = config.apikey;
  if (!baseUrl || !instance || !apikey) throw new Error('Evolution config incomplete');

  let endpoint = `/message/sendText/${instance}`;
  let body: Record<string, unknown> = { number: input.to, text: input.text ?? '' };
  if (input.imageUrl) {
    endpoint = `/message/sendMedia/${instance}`;
    body = {
      number: input.to,
      mediatype: 'image',
      media: input.imageUrl,
      caption: input.caption ?? '',
    };
  } else if (input.documentUrl) {
    endpoint = `/message/sendMedia/${instance}`;
    body = {
      number: input.to,
      mediatype: 'document',
      media: input.documentUrl,
      fileName: input.documentFilename ?? 'doc',
    };
  }

  const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': apikey },
    body: JSON.stringify(body),
  });
  const data = (await resp.json()) as { key?: { id?: string }; error?: string };
  if (!resp.ok) {
    return { ok: false, provider: 'evolution', message_id: null, raw_response: data, error: data.error ?? `HTTP ${resp.status}` };
  }
  return { ok: true, provider: 'evolution', message_id: data.key?.id ?? null, raw_response: data };
}

// ─────────────────────────────────────────────────────────
// Public sendMessage entry point (with tracer)
// ─────────────────────────────────────────────────────────

/**
 * Send a WhatsApp message via the configured active provider.
 * Wrapped in a trace span so the operation appears in MonitoringPage.
 */
export async function sendWhatsAppMessage(
  input: WhatsAppMessageInput,
): Promise<WhatsAppSendResult> {
  return withTrace('whatsapp.outbound.send', async (_addSpan, ctx) => {
    return ctx.withSpan('whatsapp.outbound.dispatch', 'tool', async (span) => {
      span.setAttribute('whatsapp.to', input.to);
      span.setAttribute('whatsapp.has_text', !!input.text);
      span.setAttribute('whatsapp.has_image', !!input.imageUrl);
      span.setAttribute('whatsapp.has_document', !!input.documentUrl);
      span.setAttribute('whatsapp.is_template', !!input.templateName);

      let providerSecrets: ProviderSecrets;
      try {
        providerSecrets = await loadActiveProviderConfig();
      } catch (err) {
        span.setStatus('error', err instanceof Error ? err.message : String(err));
        throw err;
      }

      span.setAttribute('whatsapp.provider', providerSecrets.provider);

      let result: WhatsAppSendResult;
      try {
        switch (providerSecrets.provider) {
          case 'twilio':
            result = await sendViaTwilio(providerSecrets.config, input);
            break;
          case 'meta':
            result = await sendViaMeta(providerSecrets.config, input);
            break;
          case 'zapi':
            result = await sendViaZapi(providerSecrets.config, input);
            break;
          case 'evolution':
            result = await sendViaEvolution(providerSecrets.config, input);
            break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('sendWhatsAppMessage failed', { error: msg, provider: providerSecrets.provider });
        span.setStatus('error', msg);
        return {
          ok: false,
          provider: providerSecrets.provider,
          message_id: null,
          error: msg,
        };
      }

      if (result.ok) {
        span.setAttribute('whatsapp.message_id', result.message_id ?? '');
      } else {
        span.setStatus('error', result.error ?? 'unknown');
      }
      return result;
    });
  });
}

/**
 * Convenience wrapper for plain text messages.
 */
export async function sendWhatsAppText(to: string, text: string): Promise<WhatsAppSendResult> {
  return sendWhatsAppMessage({ to, text });
}

/**
 * Convenience wrapper for image messages with optional caption.
 */
export async function sendWhatsAppImage(
  to: string,
  imageUrl: string,
  caption?: string,
): Promise<WhatsAppSendResult> {
  return sendWhatsAppMessage({ to, imageUrl, caption });
}

/**
 * Convenience wrapper for document messages.
 */
export async function sendWhatsAppDocument(
  to: string,
  documentUrl: string,
  filename?: string,
  caption?: string,
): Promise<WhatsAppSendResult> {
  return sendWhatsAppMessage({ to, documentUrl, documentFilename: filename, caption });
}

/**
 * Send a Meta template message (only works when active provider = meta).
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  params: string[] = [],
  language: string = 'pt_BR',
): Promise<WhatsAppSendResult> {
  return sendWhatsAppMessage({
    to,
    templateName,
    templateParams: params,
    templateLanguage: language,
  });
}
