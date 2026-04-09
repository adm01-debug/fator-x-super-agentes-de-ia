/**
 * Agent Routing Service — Nexus Agents Studio (sprint #4)
 *
 * Unified CRUD over the agent_routing_config table that backs both
 * Bitrix24 and WhatsApp routing (and any future source). Use this when
 * you need a cross-source view (e.g., the unified RoutingConfigPage)
 * instead of the per-source services.
 *
 * Per-source helpers (bitrix24WebhookService, whatsappWebhookService)
 * remain the right choice for source-specific UI like the inbound
 * webhook panels — they encapsulate the event-type catalog for that
 * source. This service is the cross-cutting view.
 */
import { fromTable } from '@/lib/supabaseExtended';
import { logger } from '@/lib/logger';
import { getWorkspaceId } from '@/lib/agentService';

export type RoutingSource = 'bitrix24' | 'whatsapp' | 'gmail' | 'slack' | string;

export interface AgentRoutingRow {
  id: string;
  workspace_id: string;
  source: RoutingSource;
  event_type: string;
  agent_id: string | null;
  is_enabled: boolean;
  filter_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RoutingSummary {
  source: string;
  total: number;
  enabled: number;
  disabled: number;
  unique_agents: number;
}

/**
 * List ALL routing rows for the current workspace, regardless of source.
 * Used by the unified routing page to show a global view.
 */
export async function listAllRoutes(): Promise<AgentRoutingRow[]> {
  const wsId = await getWorkspaceId();
  const { data, error } = await fromTable('agent_routing_config')
    .select('*')
    .eq('workspace_id', wsId)
    .order('source', { ascending: true })
    .order('event_type', { ascending: true });
  if (error) {
    logger.error('listAllRoutes failed', { error: error.message });
    throw error;
  }
  return (data ?? []) as AgentRoutingRow[];
}

/**
 * List routes filtered by source.
 */
export async function listRoutesBySource(source: RoutingSource): Promise<AgentRoutingRow[]> {
  const wsId = await getWorkspaceId();
  const { data, error } = await fromTable('agent_routing_config')
    .select('*')
    .eq('workspace_id', wsId)
    .eq('source', source)
    .order('event_type', { ascending: true });
  if (error) {
    logger.error('listRoutesBySource failed', { error: error.message, source });
    throw error;
  }
  return (data ?? []) as AgentRoutingRow[];
}

/**
 * Compute per-source summaries from a list of routing rows.
 * Pure function — no IO. Used by the routing page's stat cards.
 */
export function summarizeRoutes(rows: AgentRoutingRow[]): RoutingSummary[] {
  const bySource = new Map<string, AgentRoutingRow[]>();
  for (const row of rows) {
    const list = bySource.get(row.source) ?? [];
    list.push(row);
    bySource.set(row.source, list);
  }

  const summaries: RoutingSummary[] = [];
  for (const [source, list] of bySource.entries()) {
    const enabled = list.filter((r) => r.is_enabled).length;
    const uniqueAgents = new Set(list.map((r) => r.agent_id).filter((id): id is string => !!id)).size;
    summaries.push({
      source,
      total: list.length,
      enabled,
      disabled: list.length - enabled,
      unique_agents: uniqueAgents,
    });
  }

  // Sort by source name for stable rendering
  return summaries.sort((a, b) => a.source.localeCompare(b.source));
}

/**
 * Bulk-toggle all routes for a given source on or off.
 * Useful for emergency disable / re-enable scenarios.
 */
export async function bulkToggleSource(source: RoutingSource, isEnabled: boolean): Promise<number> {
  const wsId = await getWorkspaceId();
  const { data, error } = await fromTable('agent_routing_config')
    .update({ is_enabled: isEnabled })
    .eq('workspace_id', wsId)
    .eq('source', source)
    .select('id');
  if (error) {
    logger.error('bulkToggleSource failed', { error: error.message, source });
    throw error;
  }
  return (data ?? []).length;
}

/**
 * Generic toggle by id (works for any source).
 */
export async function toggleRoute(id: string, isEnabled: boolean): Promise<void> {
  const { error } = await fromTable('agent_routing_config')
    .update({ is_enabled: isEnabled })
    .eq('id', id);
  if (error) {
    logger.error('toggleRoute failed', { error: error.message });
    throw error;
  }
}

/**
 * Generic delete by id.
 */
export async function deleteRoute(id: string): Promise<void> {
  const { error } = await fromTable('agent_routing_config')
    .delete()
    .eq('id', id);
  if (error) {
    logger.error('deleteRoute failed', { error: error.message });
    throw error;
  }
}

/**
 * Friendly source labels for the UI. Add new entries here when registering
 * a new source so the unified page picks them up automatically.
 */
export const SOURCE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  bitrix24: { label: 'Bitrix24', icon: 'Building2', color: 'text-nexus-cyan' },
  whatsapp: { label: 'WhatsApp', icon: 'MessageCircle', color: 'text-nexus-emerald' },
  gmail: { label: 'Gmail', icon: 'Mail', color: 'text-nexus-amber' },
  slack: { label: 'Slack', icon: 'Slack', color: 'text-primary' },
};

export function getSourceLabel(source: string): string {
  return SOURCE_LABELS[source]?.label ?? source;
}
