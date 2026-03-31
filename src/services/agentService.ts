/**
 * Agent Service — CRUD operations with Supabase
 * Etapa 20: Full persistence layer for agents, prompt versions, test results, traces, and usage
 */
import { supabase } from '@/integrations/supabase/client';
import type { AgentConfig } from '@/types/agentTypes';

// ═══ TYPES ═══
export interface AgentRow {
  id: string;
  user_id: string;
  name: string;
  mission: string | null;
  model: string | null;
  persona: string | null;
  reasoning: string | null;
  status: string | null;
  version: number | null;
  avatar_emoji: string | null;
  config: Record<string, unknown>;
  tags: string[] | null;
  is_template: boolean | null;
  template_category: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  mission: string;
  model: string;
  persona: string;
  status: string;
  avatar_emoji: string;
  tags: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

// ═══ HELPERS ═══

/** Convert AgentConfig → DB row for insert/update */
function configToRow(agent: AgentConfig, userId: string) {
  const { id, created_at, updated_at, name, mission, model, persona, reasoning, status, version, avatar_emoji, tags, ...rest } = agent;
  return {
    ...(id ? { id } : {}),
    user_id: userId,
    name,
    mission,
    model,
    persona,
    reasoning,
    status,
    version,
    avatar_emoji,
    tags: tags ?? [],
    config: rest as unknown as Record<string, unknown>,
  };
}

/** Convert DB row → AgentConfig */
function rowToConfig(row: AgentRow): AgentConfig {
  const config = (row.config ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    name: row.name,
    mission: (row.mission ?? '') as string,
    model: (row.model ?? 'claude-sonnet-4.6') as AgentConfig['model'],
    persona: (row.persona ?? 'assistant') as AgentConfig['persona'],
    reasoning: (row.reasoning ?? 'react') as AgentConfig['reasoning'],
    status: (row.status ?? 'draft') as AgentConfig['status'],
    version: row.version ?? 1,
    avatar_emoji: row.avatar_emoji ?? '🤖',
    tags: row.tags ?? [],
    ...config,
  } as AgentConfig;
}

// ═══ AGENT CRUD ═══

export async function saveAgent(agent: AgentConfig, userId: string): Promise<AgentConfig> {
  const row = configToRow(agent, userId);

  if (agent.id) {
    // Update existing
    const { data, error } = await supabase
      .from('agents')
      .update(row)
      .eq('id', agent.id)
      .select()
      .single();
    if (error) throw new Error(`Erro ao salvar agente: ${error.message}`);
    return rowToConfig(data as unknown as AgentRow);
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('agents')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(`Erro ao criar agente: ${error.message}`);
    return rowToConfig(data as unknown as AgentRow);
  }
}

export async function loadAgents(userId: string): Promise<AgentSummary[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, mission, model, persona, status, avatar_emoji, tags, version, created_at, updated_at')
    .eq('user_id', userId)
    .eq('is_template', false)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Erro ao carregar agentes: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    mission: row.mission ?? '',
    model: row.model ?? 'claude-sonnet-4.6',
    persona: row.persona ?? 'assistant',
    status: row.status ?? 'draft',
    avatar_emoji: row.avatar_emoji ?? '🤖',
    tags: row.tags ?? [],
    version: row.version ?? 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function loadAgent(agentId: string): Promise<AgentConfig> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (error) throw new Error(`Erro ao carregar agente: ${error.message}`);
  return rowToConfig(data as unknown as AgentRow);
}

export async function deleteAgent(agentId: string): Promise<void> {
  const { error } = await supabase
    .from('agents')
    .delete()
    .eq('id', agentId);
  if (error) throw new Error(`Erro ao deletar agente: ${error.message}`);
}

export async function duplicateAgent(agentId: string, userId: string): Promise<AgentConfig> {
  const original = await loadAgent(agentId);
  const copy: AgentConfig = {
    ...original,
    id: undefined,
    name: `${original.name} (cópia)`,
    status: 'draft',
    version: 1,
    created_at: undefined,
    updated_at: undefined,
  };
  return saveAgent(copy, userId);
}

// ═══ PROMPT VERSIONS ═══

export async function savePromptVersion(
  agentId: string,
  userId: string,
  content: string,
  version: number,
  changeSummary: string,
): Promise<void> {
  // Deactivate all previous versions
  await supabase
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('agent_id', agentId);

  // Insert new active version
  const { error } = await supabase
    .from('prompt_versions')
    .insert({
      agent_id: agentId,
      user_id: userId,
      content,
      version,
      change_summary: changeSummary,
      is_active: true,
    });

  if (error) throw new Error(`Erro ao salvar versão de prompt: ${error.message}`);
}

export async function loadPromptVersions(agentId: string) {
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('agent_id', agentId)
    .order('version', { ascending: false });

  if (error) throw new Error(`Erro ao carregar versões: ${error.message}`);
  return data ?? [];
}

export async function activatePromptVersion(agentId: string, versionId: string): Promise<void> {
  await supabase
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('agent_id', agentId);

  const { error } = await supabase
    .from('prompt_versions')
    .update({ is_active: true })
    .eq('id', versionId);

  if (error) throw new Error(`Erro ao ativar versão: ${error.message}`);
}

// ═══ TRACES ═══

export async function saveTrace(
  agentId: string,
  userId: string,
  event: string,
  input: unknown,
  output: unknown,
  meta?: { latency_ms?: number; tokens_used?: number; cost_usd?: number; level?: string; session_id?: string },
): Promise<void> {
  const { error } = await supabase
    .from('agent_traces')
    .insert({
      agent_id: agentId,
      user_id: userId,
      event,
      input: input as Record<string, unknown>,
      output: output as Record<string, unknown>,
      latency_ms: meta?.latency_ms ?? null,
      tokens_used: meta?.tokens_used ?? null,
      cost_usd: meta?.cost_usd ?? null,
      level: (meta?.level as 'debug' | 'info' | 'warning' | 'error' | 'critical') ?? 'info',
      session_id: meta?.session_id ?? null,
    });

  if (error) throw new Error(`Erro ao salvar trace: ${error.message}`);
}

export async function loadTraces(agentId: string, limit = 50) {
  const { data, error } = await supabase
    .from('agent_traces')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Erro ao carregar traces: ${error.message}`);
  return data ?? [];
}

// ═══ USAGE ═══

export async function loadUsage(agentId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('agent_usage')
    .select('*')
    .eq('agent_id', agentId)
    .gte('date', since.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) throw new Error(`Erro ao carregar uso: ${error.message}`);
  return data ?? [];
}

// ═══ TEMPLATES ═══

export async function loadTemplates(): Promise<AgentRow[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('is_template', true)
    .order('name');

  if (error) throw new Error(`Erro ao carregar templates: ${error.message}`);
  return (data ?? []) as unknown as AgentRow[];
}
