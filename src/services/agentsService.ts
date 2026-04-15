/**
 * Nexus Agents Studio — Agents Service
 * Centralized CRUD and detail queries for the agents domain.
 * Used by AgentDetailPage, AgentsPage, and any page needing agent data.
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { logger } from '@/lib/logger';

export interface AgentDetail {
  id: string;
  name: string;
  mission: string | null;
  avatar_emoji: string | null;
  status: string;
  model: string | null;
  tags: string[] | null;
  version: number | null;
  updated_at: string;
  created_at: string;
  [key: string]: unknown;
}

export interface AgentTrace {
  latency_ms: number | null;
  tokens_used: number | null;
  cost_usd: number | null;
  level: string | null;
  created_at: string;
}

export interface AgentUsage {
  date: string;
  requests: number | null;
  total_cost_usd: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  avg_latency_ms: number | null;
  agent_id: string;
}

export interface AgentAlert {
  title: string;
  severity: string;
  created_at: string;
  is_resolved: boolean;
}

export interface AgentVersion {
  id: string;
  agent_id: string;
  version: number;
  model: string | null;
  persona: string | null;
  mission: string | null;
  config: Record<string, unknown>;
  change_summary: string | null;
  changes: string | null;
  created_at: string;
  [key: string]: unknown;
}

/**
 * Fetches a single agent by ID with all fields.
 */
export async function getAgentById(id: string): Promise<AgentDetail | null> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    logger.error('Failed to fetch agent', { id, error: error.message });
    throw error;
  }
  return data as AgentDetail | null;
}

/**
 * Recent traces for a specific agent (latest N).
 */
export async function getAgentDetailTraces(agentId: string, limit = 50): Promise<AgentTrace[]> {
  const { data, error } = await supabase
    .from('agent_traces')
    .select('latency_ms, tokens_used, cost_usd, level, created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error('Failed to fetch agent traces', { agentId, error: error.message });
    throw error;
  }
  return (data ?? []) as AgentTrace[];
}

/**
 * Usage records for a specific agent over the last N days.
 */
export async function getAgentUsage(agentId: string, days = 7): Promise<AgentUsage[]> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const { data, error } = await supabase
    .from('agent_usage')
    .select('*')
    .eq('agent_id', agentId)
    .gte('date', fromDate.toISOString().split('T')[0])
    .order('date');
  if (error) {
    logger.error('Failed to fetch agent usage', { agentId, days, error: error.message });
    throw error;
  }
  return (data ?? []) as AgentUsage[];
}

/**
 * Recent alerts for a specific agent (latest N).
 */
export async function getAgentRecentAlerts(agentId: string, limit = 5): Promise<AgentAlert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('title, severity, created_at, is_resolved')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error('Failed to fetch agent alerts', { agentId, error: error.message });
    throw error;
  }
  return (data ?? []) as AgentAlert[];
}

/**
 * Version history for a specific agent (latest N).
 */
export async function getAgentVersions(agentId: string, limit = 20): Promise<AgentVersion[]> {
  const { data, error } = await supabase
    .from('agent_versions')
    .select('*')
    .eq('agent_id', agentId)
    .order('version', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error('Failed to fetch agent versions', { agentId, error: error.message });
    throw error;
  }
  return (data ?? []) as unknown as AgentVersion[];
}
