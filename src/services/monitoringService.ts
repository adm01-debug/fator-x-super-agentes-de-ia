/**
 * Nexus Agents Studio — Monitoring Service
 * Traces, metrics, alerts, sessions, and observability data.
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';
import { logger } from '@/lib/logger';

// ═══ Agent Traces ═══

export async function getAgentTraces(options: {
  agentId?: string;
  limit?: number;
}) {
  const { agentId, limit = 50 } = options;
  let query = supabase
    .from('agent_traces')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (agentId && agentId !== 'all') query = query.eq('agent_id', agentId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ═══ Sessions ═══

export async function getSessions(options: { agentId?: string; limit?: number }) {
  const { agentId, limit = 50 } = options;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (agentId && agentId !== 'all') query = query.eq('agent_id', agentId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string; agent_id: string | null; status: string;
    started_at: string; ended_at: string | null; metadata: Record<string, unknown>;
  }>;
}

export async function getSessionTraces(sessionId: string) {
  const { data, error } = await supabase
    .from('session_traces')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string; trace_type: string; input: unknown; output: unknown;
    latency_ms: number | null; tokens_used: number | null;
    cost_usd: number | null; created_at: string; metadata: Record<string, unknown>;
  }>;
}

export async function getTraceEvents(traceId: string) {
  const { data, error } = await supabase
    .from('trace_events')
    .select('*')
    .eq('session_trace_id', traceId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string; event_type: string; data: Record<string, unknown>; created_at: string;
  }>;
}

// ═══ Alerts ═══

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

export async function resolveAlert(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', alertId);
  if (error) throw error;
}

// ═══ Agents list (for filter dropdown) ═══

export async function getAgentsForFilter() {
  const { data } = await supabaseExternal.from('agents').select('id, name').order('name');
  return data ?? [];
}

// ═══ Alert Rules ═══

export async function listAlertRules() {
  const { data: member } = await supabaseExternal.from('workspace_members').select('workspace_id').limit(1).maybeSingle();
  if (!member?.workspace_id) return [];
  const { data } = await fromTable('alert_rules').select('*').eq('workspace_id', member.workspace_id).order('created_at', { ascending: false });
  return data ?? [];
}

export async function createAlertRule(rule: {
  name: string; metric: string; operator: string; threshold: number; severity: string;
}) {
  const { data: member } = await supabaseExternal.from('workspace_members').select('workspace_id').limit(1).maybeSingle();
  await fromTable('alert_rules').insert({
    workspace_id: member?.workspace_id,
    name: rule.name,
    metric: rule.metric,
    operator: rule.operator,
    threshold: rule.threshold,
    severity: rule.severity,
  });
}

export async function deleteAlertRule(id: string) {
  await fromTable('alert_rules').delete().eq('id', id);
}

export async function toggleAlertRule(id: string, enabled: boolean) {
  await fromTable('alert_rules').update({ is_enabled: enabled }).eq('id', id);
}

// ═══ Dashboard Metrics ═══

export async function getDashboardMetrics() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [tracesResult, alertsResult, usageResult] = await Promise.all([
    supabaseExternal.from('trace_events').select('*', { count: 'exact', head: true }).gte('created_at', dayAgo.toISOString()),
    supabaseExternal.from('alerts').select('*', { count: 'exact', head: true }).eq('is_resolved', false),
    fromTable('usage_records').select('cost_usd').gte('created_at', dayAgo.toISOString()),
  ]);
  const dailyCost = ((usageResult.data ?? []) as Array<Record<string, unknown>>).reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  return {
    executions24h: tracesResult.count || 0,
    activeAlerts: alertsResult.count || 0,
    dailyCost,
  };
}

// ═══ Trace Events ═══

export interface TraceEvent {
  id: string;
  event_type: string;
  data: Record<string, unknown>;
  created_at: string;
}

export async function getRecentTraceEvents(limit = 50): Promise<TraceEvent[]> {
  const { data, error } = await supabase
    .from('trace_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error('Failed to fetch trace events', { error: error.message });
    throw error;
  }
  return (data ?? []) as TraceEvent[];
}
