import type {
  AgentConfig,
  AgentPersona,
  LLMModel,
  ReasoningPattern,
  AgentLifecycleStage,
} from '@/types/agentTypes';
import { DEFAULT_AGENT } from '@/data/agentBuilderData';
import type { Json } from '@/integrations/supabase/types';

export function agentToDbRow(agent: AgentConfig, userId: string) {
  const { id, created_at: _ca, updated_at: _ua, ...rest } = agent;
  return {
    ...(id ? { id: id as string } : {}),
    user_id: userId,
    name: agent.name,
    mission: agent.mission,
    persona: agent.persona,
    model: agent.model,
    avatar_emoji: agent.avatar_emoji,
    reasoning: agent.reasoning,
    status: agent.status,
    version: agent.version,
    tags: agent.tags,
    config: rest as unknown as Json,
  };
}

export function dbRowToAgent(row: Record<string, unknown>): AgentConfig {
  const config = (row.config || {}) as Record<string, unknown>;
  return {
    ...DEFAULT_AGENT,
    ...config,
    id: row.id as string | undefined,
    name: row.name as string,
    mission: (row.mission as string) || '',
    persona: ((row.persona as string) || 'assistant') as AgentPersona,
    model: ((row.model as string) || 'claude-sonnet-4.6') as LLMModel,
    avatar_emoji: (row.avatar_emoji as string) || '🤖',
    reasoning: ((row.reasoning as string) || 'react') as ReasoningPattern,
    status: ((row.status as string) || 'draft') as AgentLifecycleStage,
    version: (row.version as number) || 1,
    tags: (row.tags as string[]) || [],
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

export function exportAgentMarkdown(a: AgentConfig): string {
  const memoryTypes = [
    a.memory_short_term && 'Curto Prazo',
    a.memory_episodic && 'Episódica',
    a.memory_semantic && 'Semântica',
    a.memory_procedural && 'Procedural',
    a.memory_profile && 'Perfil',
    a.memory_shared && 'Organizacional',
  ].filter(Boolean);
  const activeTools = a.tools.filter((t) => t.enabled);
  const activeGuardrails = a.guardrails.filter((g) => g.enabled);

  return [
    `# ${a.avatar_emoji} ${a.name}`,
    '',
    `**Missão:** ${a.mission}`,
    `**Persona:** ${a.persona}`,
    `**Modelo:** ${a.model}`,
    `**Raciocínio:** ${a.reasoning}`,
    `**Status:** ${a.status}`,
    `**Versão:** ${a.version}`,
    '',
    '## Memória',
    memoryTypes.length > 0 ? memoryTypes.map((t) => `- ${t}`).join('\n') : '- Nenhuma ativa',
    '',
    '## RAG',
    `- Arquitetura: ${a.rag_architecture}`,
    `- Vector DB: ${a.rag_vector_db}`,
    `- Fontes: ${a.rag_sources.length}`,
    '',
    '## Ferramentas',
    activeTools.length > 0 ? activeTools.map((t) => `- ${t.name}`).join('\n') : '- Nenhuma ativa',
    '',
    '## Guardrails',
    activeGuardrails.length > 0
      ? activeGuardrails.map((g) => `- ${g.name} (${g.severity})`).join('\n')
      : '- Nenhum ativo',
    '',
    '## System Prompt',
    '```',
    a.system_prompt || '(vazio)',
    '```',
    '',
    '## Deploy',
    `- Ambiente: ${a.deploy_environment}`,
    `- Canais: ${a.deploy_channels.filter((c) => c.enabled).length}`,
    '',
  ].join('\n');
}

export function getEstimatedCost(a: AgentConfig): number {
  const modelCosts: Record<string, number> = {
    'claude-opus-4.6': 150,
    'claude-sonnet-4.6': 50,
    'claude-haiku-4.5': 15,
    'gpt-4o': 60,
    'gemini-2.5-pro': 40,
    'llama-4': 20,
    custom: 50,
  };
  const base = modelCosts[a.model] || 50;
  const toolMultiplier = 1 + a.tools.filter((t) => t.enabled).length * 0.05;
  const ragMultiplier = a.rag_sources.length > 0 ? 1.2 : 1;
  return Math.round(base * toolMultiplier * ragMultiplier);
}

export function getCompleteness(a: AgentConfig): number {
  let score = 0;
  if (a.name) score += 10;
  if (a.mission) score += 10;
  if (a.model) score += 10;
  if (a.system_prompt.length > 50) score += 15;
  if (a.tools.length > 0) score += 10;
  if (a.guardrails.length > 0) score += 10;
  if (a.test_cases.length > 0) score += 10;
  if (a.rag_sources.length > 0) score += 10;
  if (a.memory_episodic || a.memory_semantic) score += 10;
  if (a.logging_enabled) score += 5;
  return Math.min(score, 100);
}
