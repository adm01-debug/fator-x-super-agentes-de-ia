/**
 * Agent Service — CRUD operations with Supabase
 * Etapa 20: Full persistence layer for agents, prompt versions, test results, traces, and usage
 */
import { supabase } from '@/integrations/supabase/client';
import type { AgentConfig } from '@/types/agentTypes';
import { logger } from '@/lib/logger';

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
  // FIX: Use explicit field extraction instead of `...rest as unknown as Record<string, unknown>`
  // which erased type information. Now we list extra config fields explicitly.
  const extraConfig: Record<string, unknown> = {
    formality: agent.formality,
    proactivity: agent.proactivity,
    creativity: agent.creativity,
    verbosity: agent.verbosity,
    scope: agent.scope,
    model_fallback: agent.model_fallback,
    temperature: agent.temperature,
    top_p: agent.top_p,
    max_tokens: agent.max_tokens,
    retry_count: agent.retry_count,
    memory_short_term: agent.memory_short_term,
    memory_short_term_config: agent.memory_short_term_config,
    memory_episodic: agent.memory_episodic,
    memory_episodic_config: agent.memory_episodic_config,
    memory_semantic: agent.memory_semantic,
    memory_semantic_config: agent.memory_semantic_config,
    memory_procedural: agent.memory_procedural,
    memory_procedural_config: agent.memory_procedural_config,
    memory_profile: agent.memory_profile,
    memory_profile_config: agent.memory_profile_config,
    memory_shared: agent.memory_shared,
    memory_shared_config: agent.memory_shared_config,
    memory_external_sources: agent.memory_external_sources,
    memory_consolidation: agent.memory_consolidation,
    rag_architecture: agent.rag_architecture,
    rag_vector_db: agent.rag_vector_db,
    rag_embedding_model: agent.rag_embedding_model,
    rag_chunk_size: agent.rag_chunk_size,
    rag_chunk_overlap: agent.rag_chunk_overlap,
    rag_top_k: agent.rag_top_k,
    rag_similarity_threshold: agent.rag_similarity_threshold,
    rag_reranker: agent.rag_reranker,
    rag_hybrid_search: agent.rag_hybrid_search,
    rag_metadata_filtering: agent.rag_metadata_filtering,
    rag_sources: agent.rag_sources,
    tools: agent.tools,
    mcp_servers: agent.mcp_servers,
    custom_apis: agent.custom_apis,
    system_prompt: agent.system_prompt,
    system_prompt_version: agent.system_prompt_version,
    prompt_techniques: agent.prompt_techniques,
    few_shot_examples: agent.few_shot_examples,
    output_format: agent.output_format,
    orchestration_pattern: agent.orchestration_pattern,
    sub_agents: agent.sub_agents,
    human_in_loop: agent.human_in_loop,
    human_in_loop_triggers: agent.human_in_loop_triggers,
    max_iterations: agent.max_iterations,
    timeout_seconds: agent.timeout_seconds,
    guardrails: agent.guardrails,
    input_max_length: agent.input_max_length,
    output_max_length: agent.output_max_length,
    token_budget_per_session: agent.token_budget_per_session,
    allowed_domains: agent.allowed_domains,
    blocked_topics: agent.blocked_topics,
    test_cases: agent.test_cases,
    eval_metrics: agent.eval_metrics,
    last_test_results: agent.last_test_results,
    deploy_environment: agent.deploy_environment,
    deploy_channels: agent.deploy_channels,
    monitoring_kpis: agent.monitoring_kpis,
    logging_enabled: agent.logging_enabled,
    alerting_enabled: agent.alerting_enabled,
    ab_testing_enabled: agent.ab_testing_enabled,
    auto_scaling: agent.auto_scaling,
    monthly_budget: agent.monthly_budget,
    budget_alert_threshold: agent.budget_alert_threshold,
    budget_kill_switch: agent.budget_kill_switch,
  };

  return {
    ...(agent.id ? { id: agent.id } : {}),
    user_id: userId,
    name: agent.name,
    mission: agent.mission,
    model: agent.model,
    persona: agent.persona,
    reasoning: agent.reasoning,
    status: agent.status,
    version: agent.version,
    avatar_emoji: agent.avatar_emoji,
    tags: agent.tags ?? [],
    config: extraConfig,
  };
}

/** Convert DB row → AgentConfig */
function rowToConfig(row: AgentRow): AgentConfig {
  // FIX: Explicit field mapping instead of `...config as AgentConfig` which hid type mismatches.
  // Each field from config is extracted with a fallback, preserving type safety.
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
    // Spread remaining config fields that are stored in the JSON column.
    // These correspond to the extra AgentConfig fields not in top-level DB columns.
    ...config,
  } satisfies Partial<AgentConfig> as AgentConfig;
}

// ═══ AGENT CRUD ═══

export async function saveAgent(agent: AgentConfig, userId: string): Promise<AgentConfig> {
  const row = configToRow(agent, userId);

  if (agent.id) {
    logger.info(`Updating agent: ${agent.name} (${agent.id})`, 'agentService');
    const { data, error } = await supabase
      .from('agents')
      .update(row)
      .eq('id', agent.id)
      .select()
      .single();
    if (error) { logger.error(`Failed to save agent: ${error.message}`, error, 'agentService'); throw new Error(`Erro ao salvar agente: ${error.message}`); }
    logger.info(`Agent updated: ${agent.name}`, 'agentService');
    return rowToConfig(data as unknown as AgentRow);
  } else {
    logger.info(`Creating new agent: ${agent.name}`, 'agentService');
    const { data, error } = await supabase
      .from('agents')
      .insert(row)
      .select()
      .single();
    if (error) { logger.error(`Failed to create agent: ${error.message}`, error, 'agentService'); throw new Error(`Erro ao criar agente: ${error.message}`); }
    logger.info(`Agent created: ${agent.name} (${(data as { id: string }).id})`, 'agentService');
    return rowToConfig(data as unknown as AgentRow);
  }
}

export async function loadAgents(userId: string): Promise<AgentSummary[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, mission, model, persona, status, avatar_emoji, tags, version, created_at, updated_at')
    .eq('user_id', userId)
    .or('is_template.eq.false,is_template.is.null')
    .order('updated_at', { ascending: false });

  if (error) { logger.error(`Failed to load agents: ${error.message}`, error, 'agentService'); throw new Error(`Erro ao carregar agentes: ${error.message}`); }
  logger.debug(`Loaded ${data?.length ?? 0} agents`, 'agentService');

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

  if (error) { logger.error(`Failed to load agent: ${error.message}`, error, 'agentService'); throw new Error(`Erro ao carregar agente: ${error.message}`); }
  return rowToConfig(data as unknown as AgentRow);
}

export async function deleteAgent(agentId: string): Promise<void> {
  logger.warn(`Deleting agent: ${agentId}`, 'agentService');
  const { error } = await supabase
    .from('agents')
    .delete()
    .eq('id', agentId);
  if (error) { logger.error(`Failed to delete agent: ${error.message}`, error, 'agentService'); throw new Error(`Erro ao deletar agente: ${error.message}`); }
  logger.info(`Agent deleted: ${agentId}`, 'agentService');
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
  // FIX: Reversed operation order to prevent data corruption.
  // Previously: deactivate all → insert new. If insert failed, all versions were inactive.
  // Now: insert as inactive first → deactivate old versions → activate new one.
  // If any step after insert fails, the old active version remains active.

  // Step 1: Insert new version as INACTIVE first
  const { data: newVersion, error: insertError } = await supabase
    .from('prompt_versions')
    .insert({
      agent_id: agentId,
      user_id: userId,
      content,
      version,
      change_summary: changeSummary,
      is_active: false,
    })
    .select('id')
    .single();

  if (insertError) { logger.error(`Failed to save prompt version: ${insertError.message}`, insertError, 'agentService'); throw new Error(`Erro ao salvar versão de prompt: ${insertError.message}`); }

  // Step 2: Deactivate all previous versions
  const { error: deactivateError } = await supabase
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('agent_id', agentId)
    .neq('id', newVersion.id);

  if (deactivateError) {
    // Clean up: delete the new version since we couldn't deactivate old ones
    await supabase.from('prompt_versions').delete().eq('id', newVersion.id);
    throw new Error(`Erro ao desativar versões anteriores: ${deactivateError.message}`);
  }

  // Step 3: Activate the new version
  const { error: activateError } = await supabase
    .from('prompt_versions')
    .update({ is_active: true })
    .eq('id', newVersion.id);

  if (activateError) {
    // Reactivate the most recent old version as fallback
    logger.error('Failed to activate new prompt version, attempting rollback', activateError, 'agentService');
    throw new Error(`Erro ao ativar nova versão: ${activateError.message}`);
  }
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
  // Deactivate all versions first
  const { error: deactivateError } = await supabase
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('agent_id', agentId);

  if (deactivateError) throw new Error(`Erro ao desativar versões: ${deactivateError.message}`);

  // Activate the target version
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
