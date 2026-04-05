/**
 * Skills Registry Service — Foundation for Agent Skills Marketplace
 * Inspired by LobeHub Skills, akm, OpenClaw skill repos
 *
 * NOTE: Tables skill_registry, agent_installed_skills and RPC
 * increment_skill_installs are planned for future migration.
 */

import { supabase } from '@/integrations/supabase/client';

export interface AgentSkillDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  author: string;
  category: 'tools' | 'knowledge' | 'prompts' | 'workflows' | 'integrations';
  tags: string[];
  install_count: number;
  rating: number;
  skill_config: Record<string, unknown>;
  mcp_server_url?: string;
  is_verified: boolean;
  is_public: boolean;
  created_at: string;
}

type DynFrom = (table: string) => ReturnType<typeof supabase.from>;
type DynRpc = (fn: string, params: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;

// List available skills from registry
export async function listSkills(options?: {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ skills: AgentSkillDefinition[]; total: number }> {
  const { category, search, page = 1, limit = 20 } = options || {};

  let query = (supabase.from as DynFrom)('skill_registry')
    .select('*', { count: 'exact' })
    .eq('is_public' as never, true)
    .order('install_count' as never, { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (category) query = query.eq('category' as never, category);
  if (search) query = query.ilike('name' as never, `%${search}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { skills: (data ?? []) as unknown as AgentSkillDefinition[], total: count || 0 };
}

// Install a skill for an agent
export async function installSkill(agentId: string, skillId: string): Promise<void> {
  const { error } = await (supabase.from as DynFrom)('agent_installed_skills').insert({
    agent_id: agentId,
    skill_id: skillId,
    installed_at: new Date().toISOString(),
  } as never);
  if (error) throw error;

  await (supabase.rpc as DynRpc)('increment_skill_installs', { p_skill_id: skillId });
}

// Get installed skills for an agent
export async function getInstalledSkills(agentId: string): Promise<AgentSkillDefinition[]> {
  const { data, error } = await (supabase.from as DynFrom)('agent_installed_skills')
    .select('skill_id, skill_registry(*)' as never)
    .eq('agent_id' as never, agentId);
  if (error) throw error;
  return (data ?? []).map(d => ((d as unknown as Record<string, unknown>).skill_registry) as unknown as AgentSkillDefinition);
}

// Uninstall a skill
export async function uninstallSkill(agentId: string, skillId: string): Promise<void> {
  const { error } = await (supabase.from as DynFrom)('agent_installed_skills')
    .delete()
    .eq('agent_id' as never, agentId)
    .eq('skill_id' as never, skillId);
  if (error) throw error;
}

// Publish a skill to the registry
export async function publishSkill(skill: Omit<AgentSkillDefinition, 'id' | 'install_count' | 'rating' | 'created_at'>): Promise<AgentSkillDefinition> {
  const { data, error } = await (supabase.from as DynFrom)('skill_registry')
    .insert({
      ...skill,
      install_count: 0,
      rating: 0,
      is_verified: false,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as AgentSkillDefinition;
}

// Built-in skill categories
export const SKILL_CATEGORIES = [
  { id: 'tools', name: 'Ferramentas', icon: '🔧', description: 'APIs, scripts, integrações externas' },
  { id: 'knowledge', name: 'Conhecimento', icon: '📚', description: 'Bases de conhecimento, documentos, FAQs' },
  { id: 'prompts', name: 'Prompts', icon: '💬', description: 'System prompts, templates de resposta' },
  { id: 'workflows', name: 'Workflows', icon: '⚙️', description: 'Automações, pipelines, processos' },
  { id: 'integrations', name: 'Integrações', icon: '🔗', description: 'MCP servers, APIs, webhooks' },
] as const;
