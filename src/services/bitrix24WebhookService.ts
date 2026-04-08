/**
 * Bitrix24 Webhook Service — Nexus Agents Studio (next-frontier #3)
 *
 * Manages agent_routing_config rows for source='bitrix24' and reads
 * bitrix24_webhook_events for the audit panel UI.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { getWorkspaceId } from '@/lib/agentService';

export const BITRIX24_EVENT_TYPES = [
  { id: 'ONCRMDEALADD', label: 'Novo Deal', description: 'Disparado quando um deal é criado no CRM' },
  { id: 'ONCRMDEALUPDATE', label: 'Deal atualizado', description: 'Qualquer atualização em um deal existente' },
  { id: 'ONCRMCONTACTADD', label: 'Novo Contato', description: 'Contato criado no CRM' },
  { id: 'ONCRMCONTACTUPDATE', label: 'Contato atualizado', description: 'Atualização em contato existente' },
  { id: 'ONCRMLEADADD', label: 'Novo Lead', description: 'Lead criado' },
  { id: 'ONIMBOTMESSAGEADD', label: 'Mensagem do bot', description: 'Mensagem nova em um chat com bot' },
  { id: 'ONTASKADD', label: 'Nova tarefa', description: 'Tarefa criada' },
] as const;

export type Bitrix24EventType = typeof BITRIX24_EVENT_TYPES[number]['id'];

export interface AgentRoutingRow {
  id: string;
  workspace_id: string;
  source: string;
  event_type: string;
  agent_id: string | null;
  is_enabled: boolean;
  filter_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookEventRow {
  id: string;
  workspace_id: string | null;
  event_type: string;
  bitrix_event_id: string | null;
  raw_payload: Record<string, unknown>;
  signature_valid: boolean;
  routed_agent_id: string | null;
  routing_status: 'pending' | 'routed' | 'no_route' | 'failed' | 'invalid_signature';
  routing_error: string | null;
  trace_id: string | null;
  received_at: string;
  processed_at: string | null;
}

// ═══ Routing config CRUD ═══

export async function listBitrix24Routes(): Promise<AgentRoutingRow[]> {
  const wsId = await getWorkspaceId();
  const { data, error } = await supabase
    .from('agent_routing_config')
    .select('*')
    .eq('workspace_id', wsId)
    .eq('source', 'bitrix24')
    .order('event_type', { ascending: true });
  if (error) {
    logger.error('listBitrix24Routes failed', { error: error.message });
    throw error;
  }
  return (data ?? []) as AgentRoutingRow[];
}

export async function upsertBitrix24Route(
  eventType: Bitrix24EventType,
  agentId: string,
  isEnabled: boolean = true
): Promise<void> {
  const wsId = await getWorkspaceId();
  const { error } = await supabase
    .from('agent_routing_config')
    .upsert({
      workspace_id: wsId,
      source: 'bitrix24',
      event_type: eventType,
      agent_id: agentId,
      is_enabled: isEnabled,
    }, {
      onConflict: 'workspace_id,source,event_type',
    });
  if (error) {
    logger.error('upsertBitrix24Route failed', { error: error.message, eventType });
    throw error;
  }
}

export async function deleteBitrix24Route(id: string): Promise<void> {
  const { error } = await supabase
    .from('agent_routing_config')
    .delete()
    .eq('id', id);
  if (error) {
    logger.error('deleteBitrix24Route failed', { error: error.message });
    throw error;
  }
}

export async function toggleBitrix24Route(id: string, isEnabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('agent_routing_config')
    .update({ is_enabled: isEnabled })
    .eq('id', id);
  if (error) {
    logger.error('toggleBitrix24Route failed', { error: error.message });
    throw error;
  }
}

// ═══ Webhook events history ═══

export async function listRecentBitrix24Events(limit: number = 50): Promise<WebhookEventRow[]> {
  const wsId = await getWorkspaceId();
  const { data, error } = await supabase
    .from('bitrix24_webhook_events')
    .select('*')
    .eq('workspace_id', wsId)
    .order('received_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error('listRecentBitrix24Events failed', { error: error.message });
    throw error;
  }
  return (data ?? []) as WebhookEventRow[];
}

// ═══ Webhook URL helper ═══

/**
 * Returns the public URL the user should paste into Bitrix24's outbound
 * webhook configuration. This is what the operator pastes into Bitrix24
 * when registering an event handler.
 */
export function getBitrix24WebhookUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  return `${supabaseUrl}/functions/v1/bitrix24-webhook`;
}
