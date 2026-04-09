/**
 * WhatsApp Webhook Service — Nexus Agents Studio (next-frontier sprint #2)
 *
 * Manages agent_routing_config rows for source='whatsapp' and reads
 * whatsapp_webhook_events for the audit panel UI.
 */
import { fromTable } from '@/lib/supabaseExtended';
import { logger } from '@/lib/logger';
import { getWorkspaceId } from '@/lib/agentService';

export const WHATSAPP_EVENT_TYPES = [
  { id: 'message.text', label: 'Mensagem de texto', description: 'Texto plano enviado pelo cliente' },
  { id: 'message.image', label: 'Imagem', description: 'Imagem (jpeg, png, webp) enviada pelo cliente' },
  { id: 'message.audio', label: 'Áudio / voz', description: 'Mensagem de voz ou arquivo de áudio' },
  { id: 'message.document', label: 'Documento', description: 'Anexo de documento (PDF, planilha, etc)' },
  { id: 'message.video', label: 'Vídeo', description: 'Vídeo enviado pelo cliente' },
  { id: 'message.location', label: 'Localização', description: 'Localização compartilhada' },
  { id: 'status.delivered', label: 'Entregue', description: 'Confirmação de entrega' },
  { id: 'status.read', label: 'Lido', description: 'Confirmação de leitura' },
] as const;

export type WhatsAppEventType = typeof WHATSAPP_EVENT_TYPES[number]['id'];

export const WHATSAPP_PROVIDERS = [
  { id: 'twilio', label: 'Twilio', tokenEnv: 'WHATSAPP_TWILIO_AUTH_TOKEN' },
  { id: 'meta', label: 'Meta Cloud API', tokenEnv: 'WHATSAPP_META_APP_SECRET' },
  { id: 'zapi', label: 'Z-API', tokenEnv: 'WHATSAPP_ZAPI_TOKEN' },
  { id: 'evolution', label: 'Evolution API', tokenEnv: 'WHATSAPP_EVOLUTION_TOKEN' },
] as const;

export interface WhatsAppRoutingRow {
  id: string;
  workspace_id: string;
  source: string;
  event_type: string;
  agent_id: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppEventRow {
  id: string;
  workspace_id: string | null;
  event_type: string;
  provider: string;
  message_id: string | null;
  from_phone: string | null;
  to_phone: string | null;
  body_preview: string | null;
  signature_valid: boolean;
  routed_agent_id: string | null;
  routing_status: 'pending' | 'routed' | 'no_route' | 'failed' | 'invalid_signature' | 'duplicate';
  routing_error: string | null;
  trace_id: string | null;
  received_at: string;
  processed_at: string | null;
}

// ═══ Routing config CRUD ═══

export async function listWhatsAppRoutes(): Promise<WhatsAppRoutingRow[]> {
  const wsId = await getWorkspaceId();
  const { data, error } = await fromTable('agent_routing_config')
    .select('*')
    .eq('workspace_id', wsId)
    .eq('source', 'whatsapp')
    .order('event_type', { ascending: true });
  if (error) {
    logger.error('listWhatsAppRoutes failed', { error: error.message });
    throw error;
  }
  return (data ?? []) as WhatsAppRoutingRow[];
}

export async function upsertWhatsAppRoute(
  eventType: WhatsAppEventType,
  agentId: string,
  isEnabled: boolean = true,
): Promise<void> {
  const wsId = await getWorkspaceId();
  const { error } = await fromTable('agent_routing_config')
    .upsert({
      workspace_id: wsId,
      source: 'whatsapp',
      event_type: eventType,
      agent_id: agentId,
      is_enabled: isEnabled,
    }, {
      onConflict: 'workspace_id,source,event_type',
    });
  if (error) {
    logger.error('upsertWhatsAppRoute failed', { error: error.message, eventType });
    throw error;
  }
}

export async function deleteWhatsAppRoute(id: string): Promise<void> {
  const { error } = await fromTable('agent_routing_config')
    .delete()
    .eq('id', id);
  if (error) {
    logger.error('deleteWhatsAppRoute failed', { error: error.message });
    throw error;
  }
}

export async function toggleWhatsAppRoute(id: string, isEnabled: boolean): Promise<void> {
  const { error } = await fromTable('agent_routing_config')
    .update({ is_enabled: isEnabled })
    .eq('id', id);
  if (error) {
    logger.error('toggleWhatsAppRoute failed', { error: error.message });
    throw error;
  }
}

// ═══ Webhook events history ═══

export async function listRecentWhatsAppEvents(limit: number = 50): Promise<WhatsAppEventRow[]> {
  const wsId = await getWorkspaceId();
  const { data, error } = await fromTable('whatsapp_webhook_events')
    .select('*')
    .eq('workspace_id', wsId)
    .order('received_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error('listRecentWhatsAppEvents failed', { error: error.message });
    throw error;
  }
  return (data ?? []) as WhatsAppEventRow[];
}

// ═══ Webhook URL helper ═══

export function getWhatsAppWebhookUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  return `${supabaseUrl}/functions/v1/whatsapp-webhook`;
}
