/**
 * Nexus Agents Studio — Notification Engine
 * Multi-channel notification system with templates, delivery tracking,
 * preference management, and batching support.
 */

import { fromTable } from '@/lib/supabaseExtended';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// Re-export types from dedicated file
export type {
  NotificationChannel, NotificationPriority, NotificationStatus,
  NotificationPayload, SendNotificationInput, NotificationTemplate,
  NotificationPreference, NotificationStats,
  NotificationSenderInvokeInput, NotificationSenderInvokeResult,
} from './types/notificationTypes';

import type {
  NotificationChannel, NotificationPayload, NotificationPriority,
  NotificationStatus, SendNotificationInput, NotificationTemplate,
  NotificationStats, NotificationSenderInvokeInput, NotificationSenderInvokeResult,
} from './types/notificationTypes';

/* ------------------------------------------------------------------ */
/*  Template Engine                                                    */
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

async function getTemplate(id: string): Promise<NotificationTemplate | null> {
  const { data, error } = await fromTable('notification_templates')
    .select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as NotificationTemplate | null;
}

export async function sendNotification(input: SendNotificationInput): Promise<NotificationPayload> {
  let subject = input.subject;
  let body = input.body;
  let bodyHtml = input.body_html ?? null;

  if (input.template_id && input.template_vars) {
    const template = await getTemplate(input.template_id);
    if (template) {
      subject = renderTemplate(template.subject_template, input.template_vars);
      body = renderTemplate(template.body_template, input.template_vars);
      if (template.body_html_template) bodyHtml = renderTemplate(template.body_html_template, input.template_vars);
    }
  }

  const { data, error } = await fromTable('notifications').insert({
    channel: input.channel, priority: input.priority ?? 'normal',
    status: input.scheduled_at ? 'pending' : 'sent',
    recipient_id: input.recipient_id ?? null, recipient_address: input.recipient_address,
    subject, body, body_html: bodyHtml,
    template_id: input.template_id ?? null, template_vars: input.template_vars ?? {},
    metadata: input.metadata ?? {}, scheduled_at: input.scheduled_at ?? null,
    sent_at: input.scheduled_at ? null : new Date().toISOString(),
    retry_count: 0, max_retries: 3,
    source_type: input.source_type ?? 'system', source_id: input.source_id ?? null,
  }).select().single();
  if (error) throw error;
  return data as NotificationPayload;
}

export async function sendBulkNotifications(inputs: SendNotificationInput[]): Promise<NotificationPayload[]> {
  const results: NotificationPayload[] = [];
  for (const input of inputs) results.push(await sendNotification(input));
  return results;
}

export async function sendMultiChannel(channels: NotificationChannel[], baseInput: Omit<SendNotificationInput, 'channel'>): Promise<NotificationPayload[]> {
  const results: NotificationPayload[] = [];
  for (const channel of channels) results.push(await sendNotification({ ...baseInput, channel }));
  return results;
}

/* ------------------------------------------------------------------ */
/*  Status Updates                                                     */
/* ------------------------------------------------------------------ */

export async function markDelivered(id: string): Promise<void> {
  const { error } = await fromTable('notifications').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function markRead(id: string): Promise<void> {
  const { error } = await fromTable('notifications').update({ status: 'read', read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function markFailed(id: string, errorMsg: string): Promise<void> {
  const { error } = await fromTable('notifications').update({ status: 'failed', failed_at: new Date().toISOString(), error: errorMsg }).eq('id', id);
  if (error) throw error;
}

export async function cancelNotification(id: string): Promise<void> {
  const { error } = await fromTable('notifications').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Query & Listing                                                    */
/* ------------------------------------------------------------------ */

export async function listNotifications(
  filters?: { channel?: NotificationChannel; status?: NotificationStatus; recipient_id?: string; priority?: NotificationPriority; source_type?: NotificationPayload['source_type'] },
  limit: number = 50,
): Promise<NotificationPayload[]> {
  try {
    let query = fromTable('notifications').select('*').order('created_at', { ascending: false }).limit(limit);
    if (filters?.channel) query = query.eq('channel', filters.channel);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.recipient_id) query = query.eq('recipient_id', filters.recipient_id);
    if (filters?.priority) query = query.eq('priority', filters.priority);
    if (filters?.source_type) query = query.eq('source_type', filters.source_type);
    const { data, error } = await query;
    if (error) return [];
    return (data ?? []) as NotificationPayload[];
  } catch {
    return [];
  }
}

export async function getInAppNotifications(userId: string, unreadOnly: boolean = false): Promise<NotificationPayload[]> {
  try {
    let query = fromTable('notifications').select('*').eq('channel', 'in_app').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(100);
    if (unreadOnly) query = query.in('status', ['sent', 'delivered']);
    const { data, error } = await query;
    if (error) return [];
    return (data ?? []) as NotificationPayload[];
  } catch {
    return [];
  }
}

export async function markAllRead(userId: string): Promise<number> {
  try {
    const { data, error } = await fromTable('notifications').update({ status: 'read', read_at: new Date().toISOString() }).eq('channel', 'in_app').eq('recipient_id', userId).in('status', ['sent', 'delivered']).select('id');
    if (error) return 0;
    return data?.length ?? 0;
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

export async function listTemplates(channel?: NotificationChannel): Promise<NotificationTemplate[]> {
  let query = fromTable('notification_templates').select('*').eq('is_active', true).order('name');
  if (channel) query = query.eq('channel', channel);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NotificationTemplate[];
}

export async function createTemplate(input: Omit<NotificationTemplate, 'id' | 'created_at'>): Promise<NotificationTemplate> {
  const { data, error } = await fromTable('notification_templates').insert(input).select().single();
  if (error) throw error;
  return data as NotificationTemplate;
}

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

export async function getNotificationStats(): Promise<NotificationStats> {
  let items: Array<{ channel: NotificationChannel; priority: NotificationPriority; status: NotificationStatus; sent_at: string | null; delivered_at: string | null }> = [];
  try {
    const { data, error } = await fromTable('notifications').select('channel, priority, status, sent_at, delivered_at');
    if (!error) items = (data ?? []) as typeof items;
  } catch {
    // Table may not exist yet — return empty stats
  }

  
  const byChannel = {} as Record<NotificationChannel, { sent: number; delivered: number; failed: number }>;
  const byPriority = {} as Record<NotificationPriority, number>;
  let totalDeliveryTime = 0, deliveryCount = 0;

  const sent = items.filter((i: any) => i.status !== 'pending' && i.status !== 'cancelled');
  const delivered = items.filter((i: any) => ['delivered', 'read'].includes(i.status));
  const failed = items.filter((i: any) => i.status === 'failed');
  const read = items.filter((i: any) => i.status === 'read');

  for (const item of items) {
    if (!byChannel[item.channel]) byChannel[item.channel] = { sent: 0, delivered: 0, failed: 0 };
    if (item.status !== 'pending' && item.status !== 'cancelled') byChannel[item.channel].sent++;
    if (['delivered', 'read'].includes(item.status)) byChannel[item.channel].delivered++;
    if (item.status === 'failed') byChannel[item.channel].failed++;
    byPriority[item.priority] = (byPriority[item.priority] ?? 0) + 1;
    if (item.sent_at && item.delivered_at) {
      totalDeliveryTime += new Date(item.delivered_at).getTime() - new Date(item.sent_at).getTime();
      deliveryCount++;
    }
  }

  return {
    total_sent: sent.length, total_delivered: delivered.length,
    total_failed: failed.length, total_read: read.length,
    delivery_rate: sent.length > 0 ? (delivered.length / sent.length) * 100 : 0,
    read_rate: delivered.length > 0 ? (read.length / delivered.length) * 100 : 0,
    by_channel: byChannel, by_priority: byPriority,
    avg_delivery_time_ms: deliveryCount > 0 ? totalDeliveryTime / deliveryCount : 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Preset Templates                                                   */
/* ------------------------------------------------------------------ */

export { NOTIFICATION_PRESETS } from './presets/notificationPresets';

/* ------------------------------------------------------------------ */
/*  Edge Function Invoker                                              */
/* ------------------------------------------------------------------ */

export async function sendNotificationViaEF(input: NotificationSenderInvokeInput): Promise<NotificationSenderInvokeResult> {
  if (!input.channel || !input.recipient) throw new Error('channel and recipient are required');
  if (!input.message && !input.template_id) throw new Error('message or template_id is required');

  const { data, error } = await supabase.functions.invoke('notification-sender', {
    body: {
      channel: input.channel, recipient: input.recipient,
      subject: input.subject ?? '', message: input.message,
      template_id: input.template_id, template_vars: input.template_vars ?? {},
      priority: input.priority ?? 'normal', metadata: input.metadata ?? { source: 'frontend-test' },
    },
  });

  if (error) {
    logger.error('notification-sender invoke failed', { channel: input.channel, error: error.message });
    throw new Error(error.message);
  }
  return (data as NotificationSenderInvokeResult) ?? { ok: false };
}
