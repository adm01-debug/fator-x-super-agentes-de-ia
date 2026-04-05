/**
 * Skills Registry Service — Foundation for Agent Skills Marketplace
 * Inspired by LobeHub Skills, akm, OpenClaw skill repos
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

// List available skills from registry
export async function listSkills(options?: {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ skills: AgentSkillDefinition[]; total: number }> {
  const { category, search, page = 1, limit = 20 } = options || {};

  let query = supabase
    .from('skill_registry')
    .select('*', { count: 'exact' })
    .eq('is_public', true)
    .order('install_count', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (category) query = query.eq('category', category);
  if (search) query = query.ilike('name', `%${search}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { skills: (data ?? []) as unknown as AgentSkillDefinition[], total: count || 0 };
}

// Install a skill for an agent
export async function installSkill(agentId: string, skillId: string): Promise<void> {
  const { error } = await supabase.from('agent_installed_skills').insert({
    agent_id: agentId,
    skill_id: skillId,
  });
  if (error) throw error;

  await supabase.rpc('increment_skill_installs', { p_skill_id: skillId });
}

// Get installed skills for an agent
export async function getInstalledSkills(agentId: string): Promise<AgentSkillDefinition[]> {
  const { data, error } = await supabase
    .from('agent_installed_skills')
    .select('skill_id, skill_registry(*)')
    .eq('agent_id', agentId);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((d: any) => d.skill_registry as AgentSkillDefinition);
}

// Uninstall a skill
export async function uninstallSkill(agentId: string, skillId: string): Promise<void> {
  const { error } = await supabase
    .from('agent_installed_skills')
    .delete()
    .eq('agent_id', agentId)
    .eq('skill_id', skillId);
  if (error) throw error;
}

// Publish a skill to the registry
export async function publishSkill(skill: Omit<AgentSkillDefinition, 'id' | 'install_count' | 'rating' | 'created_at'>): Promise<AgentSkillDefinition> {
  const { data, error } = await supabase
    .from('skill_registry')
    .insert({
      name: skill.name,
      slug: skill.slug,
      description: skill.description,
      version: skill.version,
      author: skill.author,
      category: skill.category,
      tags: skill.tags,
      skill_config: skill.skill_config,
      mcp_server_url: skill.mcp_server_url ?? null,
      is_verified: false,
      is_public: skill.is_public,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as AgentSkillDefinition;
}

// Built-in skill categories
export const SKILL_CATEGORIES = [
  { id: 'tools', name: 'Ferramentas', icon: '🔧', description: 'APIs, webhooks, integrações' },
  { id: 'knowledge', name: 'Conhecimento', icon: '📚', description: 'RAG, bases de conhecimento' },
  { id: 'prompts', name: 'Prompts', icon: '💬', description: 'Templates e chains de prompt' },
  { id: 'workflows', name: 'Workflows', icon: '⚡', description: 'Automações pré-construídas' },
  { id: 'integrations', name: 'Integrações', icon: '🔗', description: 'Conectores externos' },
] as const;
