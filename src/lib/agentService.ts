import { supabase } from '@/integrations/supabase/client';
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
    .single();

  if (!data?.workspace_id) throw new Error('Workspace não encontrado');
  cachedWorkspaceId = data.workspace_id;
  return cachedWorkspaceId!
}

export function clearWorkspaceCache() {
  cachedWorkspaceId = null;
}

export async function listAgents() {
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, mission, persona, model, avatar_emoji, reasoning, status, version, tags, updated_at, created_at')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getAgent(id: string): Promise<AgentConfig> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();

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
  try { workspaceId = await getWorkspaceId(); } catch {}

  const { id, created_at, updated_at, ...configData } = agent as Record<string, unknown>;
  const row = {
    ...(id ? { id } : {}),
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
    const { error } = await supabase.from('agents').update(row).eq('id', id);
    if (error) throw error;
    return { ...agent, id };
  } else {
    const { data, error } = await supabase.from('agents').insert(row).select('id, created_at, updated_at').single();
    if (error) throw error;
    return { ...agent, id: data!.id, created_at: data!.created_at, updated_at: data!.updated_at };
  }
}

export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabase.from('agents').delete().eq('id', id);
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
    .single();

  if (!member?.workspace_id) return null;

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, plan, max_agents')
    .eq('id', member.workspace_id)
    .single();

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
