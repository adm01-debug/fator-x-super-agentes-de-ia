/**
 * Nexus Agents Studio — Agents Service
 * Centralized CRUD and detail queries for the agents domain.
 * Used by AgentDetailPage, AgentsPage, and any page needing agent data.
 */
import { logger } from '@/lib/logger';
import { supabaseExternal } from '@/integrations/supabase/externalClient';

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
  event?: string | null;
  metadata?: Record<string, unknown> | null;
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
  const { data, error } = await supabaseExternal
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
  const { data, error } = await supabaseExternal
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
  const { data, error } = await supabaseExternal
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
  const { data, error } = await supabaseExternal
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

export interface FailureRecord {
  id: string;
  source: 'alert' | 'trace';
  category: string;
  message: string;
  event?: string | null;
  is_resolved?: boolean;
  created_at: string;
}

/** Junta alerts + traces de erro/aviso para a tabela de falhas no Agent Details. */
export async function getAgentFailures(agentId: string, perSourceLimit = 200): Promise<FailureRecord[]> {
  const [alertsRes, tracesRes] = await Promise.all([
    supabaseExternal
      .from('alerts')
      .select('id, severity, title, message, is_resolved, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(perSourceLimit),
    supabaseExternal
      .from('agent_traces')
      .select('id, level, event, metadata, created_at')
      .eq('agent_id', agentId)
      .in('level', ['error', 'critical', 'warning'])
      .order('created_at', { ascending: false })
      .limit(perSourceLimit),
  ]);

  if (alertsRes.error) logger.error('Failed to fetch failure alerts', { agentId, error: alertsRes.error.message });
  if (tracesRes.error) logger.error('Failed to fetch failure traces', { agentId, error: tracesRes.error.message });

  const fromAlerts: FailureRecord[] = (alertsRes.data ?? []).map((a) => ({
    id: `alert-${a.id}`,
    source: 'alert' as const,
    category: a.severity ?? 'info',
    message: a.message ?? a.title ?? '(sem mensagem)',
    is_resolved: a.is_resolved ?? false,
    created_at: a.created_at ?? new Date().toISOString(),
  }));

  const fromTraces: FailureRecord[] = (tracesRes.data ?? []).map((t) => {
    const meta = (t.metadata ?? {}) as Record<string, unknown>;
    const errMsg = typeof meta.error === 'string' ? meta.error
      : typeof meta.message === 'string' ? meta.message
      : null;
    return {
      id: `trace-${t.id}`,
      source: 'trace' as const,
      category: t.level ?? 'error',
      message: errMsg ?? t.event ?? '(sem mensagem)',
      event: t.event,
      created_at: t.created_at ?? new Date().toISOString(),
    };
  });

  return [...fromAlerts, ...fromTraces].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export interface CreateAgentVersionInput {
  agentId: string;
  model: string | null;
  persona: string | null;
  mission: string | null;
  name?: string | null;
  config: Record<string, unknown>;
  change_summary: string;
}

/**
 * Creates a new agent_versions row using max(version)+1 and bumps the
 * agent's `version` column to keep them in sync.
 */
export async function createAgentVersion(input: CreateAgentVersionInput): Promise<AgentVersion> {
  const { data: latest, error: latestErr } = await supabaseExternal
    .from('agent_versions')
    .select('version')
    .eq('agent_id', input.agentId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) {
    logger.error('Failed to fetch latest version', { agentId: input.agentId, error: latestErr.message });
    throw latestErr;
  }
  const nextVersion = (latest?.version ?? 0) + 1;

  const { data, error } = await supabaseExternal
    .from('agent_versions')
    .insert({
      agent_id: input.agentId,
      version: nextVersion,
      model: input.model,
      persona: input.persona,
      mission: input.mission,
      name: input.name ?? null,
      config: input.config as never,
      change_summary: input.change_summary,
    })
    .select('*')
    .single();
  if (error) {
    logger.error('Failed to create agent version', { error: error.message });
    throw error;
  }

  // Sync the agent row so detail/list views show the new version
  const { error: syncErr } = await supabaseExternal
    .from('agents')
    .update({
      version: nextVersion,
      model: input.model,
      persona: input.persona as never,
      mission: input.mission,
      config: input.config as never,
    })
    .eq('id', input.agentId);
  if (syncErr) {
    logger.error('Failed to sync agent after version create', { error: syncErr.message });
  }

  return data as unknown as AgentVersion;
}

export interface RestoreOptions {
  copyPrompt?: boolean;
  copyTools?: boolean;
  copyModel?: boolean;
  /** Override do change_summary; quando vazio/undefined usa o auto-gerado. */
  customSummary?: string;
}

/**
 * Restores by creating a NEW version (v{N+1}) that copies the chosen parts
 * from `sourceVersion` over `currentVersion`. Preserves auditability — never
 * overwrites or deletes history. The changelog records exactly what was restored.
 */
export async function restoreAgentVersion(
  agentId: string,
  sourceVersion: AgentVersion,
  currentVersion?: AgentVersion | null,
  options: RestoreOptions = { copyPrompt: true, copyTools: true, copyModel: true },
): Promise<AgentVersion> {
  const base = currentVersion ?? sourceVersion;
  const baseConfig = (base.config ?? {}) as Record<string, unknown>;
  const srcConfig = (sourceVersion.config ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...baseConfig };

  let model = base.model;
  let persona = base.persona;
  let mission = base.mission;

  const parts: string[] = [];

  if (options.copyPrompt) {
    mission = sourceVersion.mission;
    if ('system_prompt' in srcConfig) merged.system_prompt = srcConfig.system_prompt;
    if ('prompt' in srcConfig) merged.prompt = srcConfig.prompt;
    parts.push('prompt');
  }
  if (options.copyTools) {
    if ('tools' in srcConfig) merged.tools = srcConfig.tools;
    parts.push('ferramentas');
  }
  if (options.copyModel) {
    model = sourceVersion.model;
    persona = sourceVersion.persona;
    if ('temperature' in srcConfig) merged.temperature = srcConfig.temperature;
    if ('max_tokens' in srcConfig) merged.max_tokens = srcConfig.max_tokens;
    if ('reasoning' in srcConfig) merged.reasoning = srcConfig.reasoning;
    parts.push('modelo');
  }

  const autoSummary = parts.length > 0
    ? `Restaurado de v${sourceVersion.version} (${parts.join(' + ')})`
    : `Restaurado de v${sourceVersion.version} (sem alterações)`;
  const change_summary = options.customSummary?.trim() || autoSummary;

  return createAgentVersion({
    agentId,
    model,
    persona,
    mission,
    config: merged,
    change_summary,
  });
}

/**
 * Version history for a specific agent (latest N).
 */
export async function getAgentVersions(agentId: string, limit = 20): Promise<AgentVersion[]> {
  const { data, error } = await supabaseExternal
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

/** Lightweight (id, name) summaries — used by selectors and orchestration UIs. */
export interface AgentSummary { id: string; name: string }

export async function listAgentSummaries(limit?: number): Promise<AgentSummary[]> {
  let query = supabaseExternal
    .from('agents')
    .select('id, name')
    .order('updated_at', { ascending: false });
  if (typeof limit === 'number') query = query.limit(limit);
  const { data, error } = await query;
  if (error) {
    logger.error('Failed to list agent summaries', { error: error.message });
    throw error;
  }
  return (data ?? []) as AgentSummary[];
}
