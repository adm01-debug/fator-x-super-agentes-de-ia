/**
 * Nexus Agents Studio — Notification Engine
 *
 * Multi-channel notification system with templates, delivery tracking,
 * preference management, and batching support.
 *
 * Channels: Email, WhatsApp, Slack, Push, SMS, In-App, Webhook
 *
 * Inspired by: n8n Notification Nodes, Activepieces notifications,
 * Novu notification infrastructure, OneSignal.
 *
 * Gap 5/10 — automation topic analysis
 */

import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type NotificationChannel =
  | 'email'
  | 'whatsapp'
  | 'slack'
  | 'push'
  | 'sms'
  | 'in_app'
  | 'webhook';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled';

export interface NotificationPayload {
  id: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  status: NotificationStatus;
  recipient_id: string | null;
  recipient_address: string;
  subject: string;
  body: string;
  body_html: string | null;
  template_id: string | null;
  template_vars: Record<string, unknown>;
  metadata: Record<string, unknown>;
  scheduled_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  error: string | null;
  retry_count: number;
  max_retries: number;
  source_type: 'workflow' | 'agent' | 'system' | 'user';
  source_id: string | null;
  created_at: string;
}

export interface SendNotificationInput {
  channel: NotificationChannel;
  priority?: NotificationPriority;
  recipient_id?: string;
  recipient_address: string;
  subject: string;
  body: string;
  body_html?: string;
  template_id?: string;
  template_vars?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  scheduled_at?: string;
  source_type?: NotificationPayload['source_type'];
  source_id?: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject_template: string;
  body_template: string;
  body_html_template: string | null;
  variables: string[];
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface NotificationPreference {
  user_id: string;
  channel: NotificationChannel;
  enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  frequency_limit: number | null;
}

export interface NotificationStats {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_read: number;
  delivery_rate: number;
  read_rate: number;
  by_channel: Record<NotificationChannel, { sent: number; delivered: number; failed: number }>;
  by_priority: Record<NotificationPriority, number>;
  avg_delivery_time_ms: number;
}

/* ------------------------------------------------------------------ */
/*  Template Engine (simple Mustache-like)                              */
/* ------------------------------------------------------------------ */

export function renderTemplate(
  template: string,
  variables: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, path: string) => {
    const parts = path.split('.');
    let value: unknown = variables;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return `{{${path}}}`;
      }
    }

    return String(value ?? '');
  });
}

/* ------------------------------------------------------------------ */
/*  Send Notifications                                                 */
/* ------------------------------------------------------------------ */

export async function sendNotification(
  input: SendNotificationInput,
): Promise<NotificationPayload> {
  let subject = input.subject;
  let body = input.body;
  let bodyHtml = input.body_html ?? null;

  // Apply template if provided
  if (input.template_id && input.template_vars) {
    const template = await getTemplate(input.template_id);
    if (template) {
      subject = renderTemplate(template.subject_template, input.template_vars);
      body = renderTemplate(template.body_template, input.template_vars);
      if (template.body_html_template) {
        bodyHtml = renderTemplate(template.body_html_template, input.template_vars);
      }
    }
  }

  const record = {
    channel: input.channel,
    priority: input.priority ?? 'normal',
    status: input.scheduled_at ? 'pending' : 'sent',
    recipient_id: input.recipient_id ?? null,
    recipient_address: input.recipient_address,
    subject,
    body,
    body_html: bodyHtml,
    template_id: input.template_id ?? null,
    template_vars: input.template_vars ?? {},
    metadata: input.metadata ?? {},
    scheduled_at: input.scheduled_at ?? null,
    sent_at: input.scheduled_at ? null : new Date().toISOString(),
    retry_count: 0,
    max_retries: 3,
    source_type: input.source_type ?? 'system',
    source_id: input.source_id ?? null,
  };

  const { data, error } = await fromTable('notifications')
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data as NotificationPayload;
}

export async function sendBulkNotifications(
  inputs: SendNotificationInput[],
): Promise<NotificationPayload[]> {
  const results: NotificationPayload[] = [];
  for (const input of inputs) {
    const result = await sendNotification(input);
    results.push(result);
  }
  return results;
}

export async function sendMultiChannel(
  channels: NotificationChannel[],
  baseInput: Omit<SendNotificationInput, 'channel'>,
): Promise<NotificationPayload[]> {
  const results: NotificationPayload[] = [];
  for (const channel of channels) {
    const result = await sendNotification({ ...baseInput, channel });
    results.push(result);
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  Status Updates                                                     */
/* ------------------------------------------------------------------ */

export async function markDelivered(id: string): Promise<void> {
  const { error } = await fromTable('notifications')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markRead(id: string): Promise<void> {
  const { error } = await fromTable('notifications')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markFailed(id: string, errorMsg: string): Promise<void> {
  const { error } = await fromTable('notifications')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      error: errorMsg,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function cancelNotification(id: string): Promise<void> {
  const { error } = await fromTable('notifications')
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Query & Listing                                                    */
/* ------------------------------------------------------------------ */

export async function listNotifications(
  filters?: {
    channel?: NotificationChannel;
    status?: NotificationStatus;
    recipient_id?: string;
    priority?: NotificationPriority;
    source_type?: NotificationPayload['source_type'];
  },
  limit: number = 50,
): Promise<NotificationPayload[]> {
  let query = fromTable('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filters?.channel) query = query.eq('channel', filters.channel);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.recipient_id) query = query.eq('recipient_id', filters.recipient_id);
  if (filters?.priority) query = query.eq('priority', filters.priority);
  if (filters?.source_type) query = query.eq('source_type', filters.source_type);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NotificationPayload[];
}

export async function getInAppNotifications(
  userId: string,
  unreadOnly: boolean = false,
): Promise<NotificationPayload[]> {
  let query = fromTable('notifications')
    .select('*')
    .eq('channel', 'in_app')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (unreadOnly) {
    query = query.in('status', ['sent', 'delivered']);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NotificationPayload[];
}

export async function markAllRead(userId: string): Promise<number> {
  const { data, error } = await fromTable('notifications')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('channel', 'in_app')
    .eq('recipient_id', userId)
    .in('status', ['sent', 'delivered'])
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

async function getTemplate(id: string): Promise<NotificationTemplate | null> {
  const { data, error } = await fromTable('notification_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as NotificationTemplate | null;
}

export async function listTemplates(
  channel?: NotificationChannel,
): Promise<NotificationTemplate[]> {
  let query = fromTable('notification_templates')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (channel) {
    query = query.eq('channel', channel);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NotificationTemplate[];
}

export async function createTemplate(
  input: Omit<NotificationTemplate, 'id' | 'created_at'>,
): Promise<NotificationTemplate> {
  const { data, error } = await fromTable('notification_templates')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as NotificationTemplate;
}

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

export async function getNotificationStats(): Promise<NotificationStats> {
  const { data, error } = await fromTable('notifications')
    .select('channel, priority, status, sent_at, delivered_at');
  if (error) throw error;

  const items = (data ?? []) as Array<{
    channel: NotificationChannel;
    priority: NotificationPriority;
    status: NotificationStatus;
    sent_at: string | null;
    delivered_at: string | null;
  }>;

  const byChannel = {} as Record<NotificationChannel, { sent: number; delivered: number; failed: number }>;
  const byPriority = {} as Record<NotificationPriority, number>;
  let totalDeliveryTime = 0;
  let deliveryCount = 0;

  const sent = items.filter((i) => i.status !== 'pending' && i.status !== 'cancelled');
  const delivered = items.filter((i) => ['delivered', 'read'].includes(i.status));
  const failed = items.filter((i) => i.status === 'failed');
  const read = items.filter((i) => i.status === 'read');

  for (const item of items) {
    if (!byChannel[item.channel]) {
      byChannel[item.channel] = { sent: 0, delivered: 0, failed: 0 };
    }
    if (item.status !== 'pending' && item.status !== 'cancelled') {
      byChannel[item.channel].sent++;
    }
    if (['delivered', 'read'].includes(item.status)) {
      byChannel[item.channel].delivered++;
    }
    if (item.status === 'failed') {
      byChannel[item.channel].failed++;
    }

    byPriority[item.priority] = (byPriority[item.priority] ?? 0) + 1;

    if (item.sent_at && item.delivered_at) {
      totalDeliveryTime +=
        new Date(item.delivered_at).getTime() - new Date(item.sent_at).getTime();
      deliveryCount++;
    }
  }

  return {
    total_sent: sent.length,
    total_delivered: delivered.length,
    total_failed: failed.length,
    total_read: read.length,
    delivery_rate: sent.length > 0 ? (delivered.length / sent.length) * 100 : 0,
    read_rate: delivered.length > 0 ? (read.length / delivered.length) * 100 : 0,
    by_channel: byChannel,
    by_priority: byPriority,
    avg_delivery_time_ms: deliveryCount > 0 ? totalDeliveryTime / deliveryCount : 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Preset Templates (Promo Brindes)                                   */
/* ------------------------------------------------------------------ */

export const NOTIFICATION_PRESETS: Record<
  string,
  { subject: string; body: string; channel: NotificationChannel; category: string }
> = {
  deal_approved: {
    subject: '✅ Orçamento #{{deal_id}} aprovado pelo cliente',
    body: 'O cliente {{client_name}} aprovou o orçamento #{{deal_id}} no valor de R$ {{amount}}. Próximo passo: enviar pedido para Compras.',
    channel: 'whatsapp',
    category: 'vendas',
  },
  purchase_order: {
    subject: '📦 Novo pedido de compra #{{po_number}}',
    body: 'Pedido de compra #{{po_number}} criado por {{requester}}. Fornecedor: {{supplier}}. Valor: R$ {{amount}}. Prazo: {{deadline}}.',
    channel: 'email',
    category: 'compras',
  },
  delivery_update: {
    subject: '🚚 Atualização de entrega - Pedido #{{order_id}}',
    body: 'Pedido #{{order_id}} do cliente {{client_name}}: {{tracking_status}}. Previsão: {{estimated_delivery}}.',
    channel: 'whatsapp',
    category: 'logistica',
  },
  art_approval: {
    subject: '🎨 Arte aguardando aprovação - Job #{{job_id}}',
    body: 'A arte do job #{{job_id}} ({{product_name}}) está pronta para aprovação. Cliente: {{client_name}}. Link: {{preview_link}}.',
    channel: 'in_app',
    category: 'arte',
  },
  payment_received: {
    subject: '💰 Pagamento recebido - NF #{{invoice_number}}',
    body: 'Pagamento de R$ {{amount}} recebido referente à NF #{{invoice_number}}. Cliente: {{client_name}}. Método: {{payment_method}}.',
    channel: 'slack',
    category: 'financeiro',
  },
  overdue_invoice: {
    subject: '⚠️ Fatura vencida - NF #{{invoice_number}}',
    body: 'A NF #{{invoice_number}} do cliente {{client_name}} venceu em {{due_date}}. Valor: R$ {{amount}}. Dias em atraso: {{days_overdue}}.',
    channel: 'email',
    category: 'financeiro',
  },
  agent_error: {
    subject: '🔴 Erro no agente {{agent_name}}',
    body: 'O agente {{agent_name}} falhou ao executar a tarefa "{{task_name}}". Erro: {{error_message}}. Tentativas: {{retry_count}}/{{max_retries}}.',
    channel: 'slack',
    category: 'sistema',
  },
  workflow_completed: {
    subject: '✅ Workflow "{{workflow_name}}" concluído',
    body: 'O workflow "{{workflow_name}}" foi concluído com sucesso em {{duration}}. Resultado: {{result_summary}}.',
    channel: 'in_app',
    category: 'sistema',
  },
};
