import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import type { Tables, Database } from '@/integrations/supabase/types';
import type { AgentConfig } from '@/types/agentTypes';
import { DEFAULT_AGENT } from '@/data/agentBuilderData';
import type { Json } from '@/integrations/supabase/types';

let cachedWorkspaceId: string | null = null;

export async function getWorkspaceId(): Promise<string> {
  if (cachedWorkspaceId) return cachedWorkspaceId;
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!data?.workspace_id) throw new Error('Workspace não encontrado');
  cachedWorkspaceId = data.workspace_id;
  return cachedWorkspaceId!
}

export function clearWorkspaceCache() {
  cachedWorkspaceId = null;
}

export async function listAgents(statusFilter?: string) {
  let query = supabase
    .from('agents')
    .select('*')
    .order('updated_at', { ascending: false });
  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter as Database["public"]["Enums"]["agent_status"]);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function cloneAgent(agentRow: Tables<"agents">) {
  const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = agentRow;
  const { data, error } = await supabaseExternal.from('agents').insert({
    ...rest,
    name: `${agentRow.name} (cópia)`,
    status: 'draft' as const,
    version: 1,
  }).select('id').single();
  if (error) throw error;
  return data;
}

export async function autoTagAgent(agent: { id: string; model: string | null; config: unknown; status: string | null; persona: string | null; tags: string[] | null }) {
  const config = agent.config as Record<string, unknown> | null;
  const tags: string[] = [];
  if (agent.model?.includes('gpt')) tags.push('OpenAI');
  if (agent.model?.includes('gemini')) tags.push('Gemini');
  if (agent.model?.includes('claude')) tags.push('Claude');
  if (config?.tools && Array.isArray(config.tools) && config.tools.length) tags.push('tools');
  if (config?.rag_enabled || config?.knowledge_base) tags.push('RAG');
  if (config?.memory_enabled) tags.push('memory');
  if (agent.status === 'production') tags.push('prod');
  if (agent.persona) tags.push('persona');
  const merged = [...new Set([...(agent.tags ?? []), ...tags])];
  if (merged.length === (agent.tags ?? []).length) {
    return { added: 0 };
  }
  const { error } = await supabaseExternal.from('agents').update({ tags: merged }).eq('id', agent.id);
  if (error) throw error;
  return { added: merged.length - (agent.tags ?? []).length };
}

export async function getAgent(id: string): Promise<AgentConfig> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Agente não encontrado');

  const config = (data.config || {}) as Record<string, any>;
  return {
    ...DEFAULT_AGENT,
    ...config,
    id: data.id,
    name: data.name,
    mission: data.mission || '',
    persona: (data.persona || 'assistant') as AgentConfig['persona'],
    model: (data.model || 'claude-sonnet-4.6') as AgentConfig['model'],
    avatar_emoji: data.avatar_emoji || '🤖',
    reasoning: (data.reasoning || 'react') as AgentConfig['reasoning'],
    status: (data.status || 'draft') as AgentConfig['status'],
    version: data.version || 1,
    tags: data.tags || [],
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function saveAgent(agent: AgentConfig): Promise<AgentConfig> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  let workspaceId: string | null = null;
  try { workspaceId = await getWorkspaceId(); } catch (err) { logger.error("Operation failed:", err);}

  const { id, created_at: _ca, updated_at: _ua, ...configData } = agent;
  const row = {
    ...(id ? { id: id as string } : {}),
    user_id: user.id,
    workspace_id: workspaceId,
    name: agent.name,
    mission: agent.mission,
    persona: agent.persona,
    model: agent.model,
    avatar_emoji: agent.avatar_emoji,
    reasoning: agent.reasoning,
    status: agent.status,
    version: agent.version,
    tags: agent.tags,
    config: configData as unknown as Json,
  };

  if (id) {
    const { error } = await supabaseExternal.from('agents').update(row).eq('id', id as string);
    if (error) throw error;
    return { ...agent, id };
  } else {
    const { data, error } = await supabaseExternal.from('agents').insert(row).select('id, created_at, updated_at').single();
    if (error) throw error;
    return { ...agent, id: data!.id, created_at: data!.created_at, updated_at: data!.updated_at };
  }
}

export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabaseExternal.from('agents').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateAgent(id: string): Promise<AgentConfig> {
  const original = await getAgent(id);
  const copy = { ...original, id: undefined, name: `${original.name} (cópia)`, status: 'draft' as const, version: 1 };
  return saveAgent(copy);
}

export async function getWorkspaceInfo() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!member?.workspace_id) return null;

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, plan, max_agents')
    .eq('id', member.workspace_id)
    .maybeSingle();

  const { count } = await supabase
    .from('agents')
    .select('id', { count: 'exact', head: true });

  return {
    name: workspace?.name ?? 'Meu Workspace',
    plan: (workspace?.plan ?? 'free') as string,
    maxAgents: workspace?.max_agents ?? 5,
    agentCount: count ?? 0,
    role: member.role,
    email: user.email || '',
    userName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
  };
}
