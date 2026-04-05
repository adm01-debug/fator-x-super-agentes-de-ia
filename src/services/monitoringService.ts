/**
 * Nexus Agents Studio — Monitoring Service
 * Traces, metrics, alerts, and observability data.
 */

import { supabase } from '@/integrations/supabase/client';

export async function getTraces(options: {
  agentId?: string;
  limit?: number;
  offset?: number;
  status?: string;
}) {
  const { agentId, limit = 20, offset = 0, status } = options;

  let query = supabase
    .from('trace_events')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (agentId) query = query.eq('agent_id', agentId);
  if (status) query = query.eq('status', status);

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
  if (acknowledged !== undefined) query = query.eq('acknowledged', acknowledged);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
    .eq('id', alertId);

  if (error) throw error;
}

export async function getDashboardMetrics() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [tracesResult, alertsResult, usageResult] = await Promise.all([
    supabase.from('trace_events').select('*', { count: 'exact', head: true }).gte('created_at', dayAgo.toISOString()),
    supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('acknowledged', false),
    supabase.from('usage_records').select('cost_usd').gte('created_at', dayAgo.toISOString()),
  ]);

  const dailyCost = (usageResult.data ?? []).reduce((s, r) => s + Number(r.cost_usd || 0), 0);

  return {
    executions24h: tracesResult.count || 0,
    activeAlerts: alertsResult.count || 0,
    dailyCost,
  };
}
