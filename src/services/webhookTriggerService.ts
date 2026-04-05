/**
 * Nexus Agents Studio — Webhook Trigger System
 *
 * Manages webhook endpoints that trigger workflows/agents when
 * external events arrive. Supports signature verification, payload
 * transformation, and event routing.
 *
 * Inspired by: n8n Webhook Triggers, Activepieces Webhooks,
 * Temporal Signals, Windmill Webhook Triggers.
 *
 * Gap 2/10 — automation topic analysis
 */

import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type WebhookMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type WebhookStatus = 'active' | 'inactive' | 'rate_limited' | 'revoked';
export type WebhookAuthType = 'none' | 'header' | 'hmac_sha256' | 'basic' | 'bearer' | 'api_key';

export interface WebhookEndpoint {
  id: string;
  name: string;
  description: string;
  path: string;
  secret: string;
  methods: WebhookMethod[];
  auth_type: WebhookAuthType;
  auth_config: Record<string, unknown>;
  status: WebhookStatus;
  target_type: 'workflow' | 'agent' | 'edge_function' | 'custom';
  target_id: string;
  target_config: Record<string, unknown>;
  transform_script: string | null;
  rate_limit_per_minute: number;
  request_count: number;
  last_triggered_at: string | null;
  ip_whitelist: string[];
  headers_filter: Record<string, string>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  webhook_id: string;
  method: WebhookMethod;
  headers: Record<string, string>;
  query_params: Record<string, string>;
  body: Record<string, unknown> | null;
  source_ip: string | null;
  status: 'received' | 'processed' | 'failed' | 'rejected';
  response_code: number;
  response_body: Record<string, unknown> | null;
  processing_time_ms: number | null;
  error: string | null;
  created_at: string;
}

export interface CreateWebhookInput {
  name: string;
  description?: string;
  methods?: WebhookMethod[];
  auth_type?: WebhookAuthType;
  auth_config?: Record<string, unknown>;
  target_type: WebhookEndpoint['target_type'];
  target_id: string;
  target_config?: Record<string, unknown>;
  transform_script?: string;
  rate_limit_per_minute?: number;
  ip_whitelist?: string[];
  headers_filter?: Record<string, string>;
}

export interface WebhookTestResult {
  success: boolean;
  status_code: number;
  response_time_ms: number;
  payload_valid: boolean;
  auth_valid: boolean;
  transform_result: Record<string, unknown> | null;
  errors: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function generateWebhookPath(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const segments = [8, 4, 4].map((len) =>
    Array.from({ length: len }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join(''),
  );
  return `/webhooks/${segments.join('-')}`;
}

function generateWebhookSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return 'whsec_' + Array.from({ length: 32 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join('');
}

export async function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return computed === signature.replace('sha256=', '');
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Transform Engine (safe eval-free)                                  */
/* ------------------------------------------------------------------ */

export function applyTransform(
  payload: Record<string, unknown>,
  script: string,
): Record<string, unknown> {
  // Simple JSONPath-like field mapping
  // Format: "target_field = source.nested.path"
  const result: Record<string, unknown> = {};
  const lines = script.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));

  for (const line of lines) {
    const match = line.match(/^\s*(\w+)\s*=\s*(.+)\s*$/);
    if (!match) continue;

    const [, targetField, sourcePath] = match;
    const pathParts = sourcePath.trim().split('.');
    let value: unknown = payload;

    for (const part of pathParts) {
      if (value && typeof value === 'object' && part in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }

    result[targetField] = value;
  }

  return Object.keys(result).length > 0 ? result : payload;
}

/* ------------------------------------------------------------------ */
/*  CRUD Operations                                                    */
/* ------------------------------------------------------------------ */

export async function createWebhook(
  input: CreateWebhookInput,
): Promise<WebhookEndpoint> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  const record = {
    name: input.name,
    description: input.description ?? '',
    path: generateWebhookPath(),
    secret: generateWebhookSecret(),
    methods: input.methods ?? ['POST'],
    auth_type: input.auth_type ?? 'hmac_sha256',
    auth_config: input.auth_config ?? {},
    status: 'active' as WebhookStatus,
    target_type: input.target_type,
    target_id: input.target_id,
    target_config: input.target_config ?? {},
    transform_script: input.transform_script ?? null,
    rate_limit_per_minute: input.rate_limit_per_minute ?? 60,
    request_count: 0,
    ip_whitelist: input.ip_whitelist ?? [],
    headers_filter: input.headers_filter ?? {},
    created_by: userId,
  };

  const { data, error } = await fromTable('webhook_endpoints'))
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data as WebhookEndpoint;
}

export async function listWebhooks(
  status?: WebhookStatus,
): Promise<WebhookEndpoint[]> {
  let query = fromTable('webhook_endpoints'))
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as WebhookEndpoint[];
}

export async function getWebhook(id: string): Promise<WebhookEndpoint | null> {
  const { data, error } = await fromTable('webhook_endpoints'))
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as WebhookEndpoint | null;
}

export async function updateWebhook(
  id: string,
  updates: Partial<CreateWebhookInput> & { status?: WebhookStatus },
): Promise<WebhookEndpoint> {
  const { data, error } = await fromTable('webhook_endpoints'))
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as WebhookEndpoint;
}

export async function revokeWebhook(id: string): Promise<WebhookEndpoint> {
  return updateWebhook(id, { status: 'revoked' });
}

export async function regenerateSecret(id: string): Promise<WebhookEndpoint> {
  const { data, error } = await fromTable('webhook_endpoints'))
    .update({
      secret: generateWebhookSecret(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as WebhookEndpoint;
}

export async function deleteWebhook(id: string): Promise<void> {
  const { error } = await fromTable('webhook_endpoints').delete().eq('id', id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Event Logging                                                      */
/* ------------------------------------------------------------------ */

export async function logWebhookEvent(
  webhookId: string,
  event: Omit<WebhookEvent, 'id' | 'webhook_id' | 'created_at'>,
): Promise<WebhookEvent> {
  const { data, error } = await supabase
    .from('webhook_events')
    .insert({ ...event, webhook_id: webhookId })
    .select()
    .single();
  if (error) throw error;

  // Update counter
  await (supabase as any).rpc('increment_webhook_counter', { webhook_uuid: webhookId });

  return data as WebhookEvent;
}

export async function getWebhookEvents(
  webhookId: string,
  limit: number = 100,
): Promise<WebhookEvent[]> {
  const { data, error } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as WebhookEvent[];
}

/* ------------------------------------------------------------------ */
/*  Testing & Simulation                                               */
/* ------------------------------------------------------------------ */

export async function testWebhook(
  id: string,
  testPayload: Record<string, unknown>,
): Promise<WebhookTestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const webhook = await getWebhook(id);

  if (!webhook) {
    return {
      success: false,
      status_code: 404,
      response_time_ms: Date.now() - startTime,
      payload_valid: false,
      auth_valid: false,
      transform_result: null,
      errors: ['Webhook not found'],
    };
  }

  const payloadValid = testPayload !== null && typeof testPayload === 'object';
  if (!payloadValid) errors.push('Invalid payload format');

  let transformResult: Record<string, unknown> | null = null;
  if (webhook.transform_script && payloadValid) {
    try {
      transformResult = applyTransform(testPayload, webhook.transform_script);
    } catch (e) {
      errors.push(`Transform error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    success: errors.length === 0,
    status_code: errors.length === 0 ? 200 : 400,
    response_time_ms: Date.now() - startTime,
    payload_valid: payloadValid,
    auth_valid: true,
    transform_result: transformResult,
    errors,
  };
}

/* ------------------------------------------------------------------ */
/*  Prebuilt Webhook Templates (for Promo Brindes use cases)           */
/* ------------------------------------------------------------------ */

export const WEBHOOK_TEMPLATES: Record<
  string,
  Omit<CreateWebhookInput, 'target_type' | 'target_id'>
> = {
  bitrix24_deal: {
    name: 'Bitrix24 — Novo Deal',
    description: 'Recebe notificações quando um deal é criado/atualizado no Bitrix24',
    methods: ['POST'],
    auth_type: 'hmac_sha256',
    transform_script:
      'deal_id = data.FIELDS.ID\ntitle = data.FIELDS.TITLE\nstage = data.FIELDS.STAGE_ID\namount = data.FIELDS.OPPORTUNITY',
  },
  whatsapp_message: {
    name: 'WhatsApp — Mensagem Recebida',
    description: 'Recebe mensagens do WhatsApp via API Evolution/Z-API',
    methods: ['POST'],
    auth_type: 'bearer',
    transform_script:
      'phone = data.from\nmessage = data.body\ntimestamp = data.timestamp\nmedia_url = data.mediaUrl',
  },
  stripe_payment: {
    name: 'Stripe — Pagamento',
    description: 'Recebe eventos de pagamento do Stripe',
    methods: ['POST'],
    auth_type: 'hmac_sha256',
    transform_script:
      'event_type = type\npayment_id = data.object.id\namount = data.object.amount\nstatus = data.object.status',
  },
  email_inbound: {
    name: 'Email — Entrada',
    description: 'Recebe emails parseados (SendGrid Inbound Parse, Mailgun)',
    methods: ['POST'],
    auth_type: 'api_key',
    transform_script:
      'from_email = from\nsubject = subject\nbody = text\nattachments = attachments',
  },
  form_submission: {
    name: 'Formulário — Submissão',
    description: 'Recebe submissões de formulários web (Typeform, Google Forms)',
    methods: ['POST'],
    auth_type: 'none',
    transform_script:
      'form_id = form_response.form_id\nanswers = form_response.answers\nsubmitted_at = form_response.submitted_at',
  },
  delivery_tracking: {
    name: 'Logística — Rastreamento',
    description: 'Recebe atualizações de rastreamento de entregas',
    methods: ['POST'],
    auth_type: 'api_key',
    transform_script:
      'tracking_code = tracking.code\nstatus = tracking.status\nlocation = tracking.location\nestimated_delivery = tracking.estimated_delivery',
  },
};
