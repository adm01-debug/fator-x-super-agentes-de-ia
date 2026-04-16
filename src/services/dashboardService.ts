/**
 * Nexus Agents Studio — Dashboard Service
 * Aggregates queries used by the main dashboard.
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { logger } from '@/lib/logger';

export interface AgentSummary {
  id: string;
  name: string;
  mission: string | null;
  avatar_emoji: string | null;
  status: string;
  model: string | null;
  tags: string[] | null;
  version: number | null;
  updated_at: string;
}

export interface UsageRecord {
  date: string;
  total_cost_usd: number | null;
  requests: number | null;
  avg_latency_ms: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
}

/**
 * Lists agents for the dashboard view (most recently updated first).
 */
export async function listAgentsForDashboard(): Promise<AgentSummary[]> {
  try {
    const { data, error } = await supabaseExternal
      .from('agents')
      .select('id, name, mission, avatar_emoji, status, model, tags, version, updated_at')
      .order('updated_at', { ascending: false });
    if (error) {
      logger.error('Failed to list dashboard agents', { error: error.message });
      return [];
    }
    return (data ?? []) as AgentSummary[];
  } catch (e) {
    logger.error('Dashboard agents fetch crashed', { error: String(e) });
    return [];
  }
}

/**
 * Returns usage records for the last N days.
 */
export async function getUsageInRange(days: number): Promise<UsageRecord[]> {
  try {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const { data, error } = await supabaseExternal
      .from('agent_usage')
      .select('*')
      .gte('date', fromDate.toISOString().split('T')[0]);
    if (error) {
      logger.error('Failed to fetch usage range', { days, error: error.message });
      return [];
    }
    return (data ?? []) as UsageRecord[];
  } catch (e) {
    logger.error('Usage range fetch crashed', { error: String(e) });
    return [];
  }
}

/**
 * Subscribes to realtime alert changes. Returns an unsubscribe fn.
 */
export function subscribeToAlerts(onChange: () => void): () => void {
  const channel = supabaseExternal
    .channel('dashboard-alerts')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
      onChange();
    })
    .subscribe();
  return () => { supabaseExternal.removeChannel(channel); };
}

/**
 * Recent unresolved alerts for the dashboard banner.
 */
export async function getUnresolvedAlerts(limit = 5) {
  try {
    const { data, error } = await supabaseExternal
      .from('alerts')
      .select('id, title, severity, created_at, is_resolved')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      logger.error('Failed to fetch unresolved alerts', { error: error.message });
      return [];
    }
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * Recent traces for the dashboard activity feed.
 */
export async function getRecentDashboardTraces(limit = 5) {
  try {
    const { data, error } = await supabaseExternal
      .from('agent_traces')
      .select('id, event, level, latency_ms, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      logger.error('Failed to fetch recent traces', { error: error.message });
      return [];
    }
    return data ?? [];
  } catch {
    return [];
  }
}
