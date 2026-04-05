/**
 * Nexus Agents Studio — Monitoring Service
 * Traces, metrics, alerts, and observability data.
 */

import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';

export async function getTraces(options: {
  agentId?: string;
  limit?: number;
  offset?: number;
  status?: string;
}) {
  const { agentId, limit = 20, offset = 0 } = options;

  let query = supabase
    .from('trace_events')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // trace_events doesn't have agent_id/status — filter via session_trace_id join if needed
  if (agentId) {
    // Filter by session_trace_id in a subquery approach — for now return all
    void agentId;
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return { traces: data ?? [], total: count || 0 };
}

export async function getAlerts(options: {
  severity?: string;
  acknowledged?: boolean;
  limit?: number;
}) {
  const { severity, acknowledged, limit = 50 } = options;

  let query = supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (severity) query = query.eq('severity', severity);
  if (acknowledged !== undefined) query = query.eq('is_resolved', acknowledged);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', alertId);

  if (error) throw error;
}

export async function getDashboardMetrics() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [tracesResult, alertsResult, usageResult] = await Promise.all([
    supabase.from('trace_events').select('*', { count: 'exact', head: true }).gte('created_at', dayAgo.toISOString()),
    supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('is_resolved', false),
    fromTable('usage_records').select('cost_usd').gte('created_at', dayAgo.toISOString()),
  ]);

  const dailyCost = ((usageResult.data ?? []) as Array<Record<string, unknown>>).reduce((s, r) => s + Number(r.cost_usd || 0), 0);

  return {
    executions24h: tracesResult.count || 0,
    activeAlerts: alertsResult.count || 0,
    dailyCost,
  };
}
