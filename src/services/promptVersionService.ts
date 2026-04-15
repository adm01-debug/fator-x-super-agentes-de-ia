/**
 * Nexus Agents Studio — Prompt Version Service
 * Abstracts all prompt versioning CRUD operations
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { supabaseExternal } from '@/integrations/supabase/externalClient';

export async function getAgentBasic(agentId: string) {
  const { data, error } = await supabaseExternal
    .from('agents')
    .select('id, name, avatar_emoji')
    .eq('id', agentId)
    .maybeSingle();
  if (error) {
    logger.error('Failed to fetch agent basic info', { agentId, error: error.message });
    throw error;
  }
  return data;
}

/**
 * Lists all agents in the workspace (id, name, emoji only).
 * Used by PromptsPage library view.
 */
export async function listAgentsBasic() {
  const { data, error } = await supabaseExternal
    .from('agents')
    .select('id, name, avatar_emoji');
  if (error) {
    logger.error('Failed to list agents', { error: error.message });
    throw error;
  }
  return data ?? [];
}

/**
 * Lists ALL prompt versions across all agents in the workspace,
 * ordered by created_at desc. Used by PromptsPage to show the global
 * library with the latest version per agent.
 */
export async function listAllPromptVersions() {
  const { data, error } = await supabaseExternal
    .from('prompt_versions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    logger.error('Failed to list all prompt versions', { error: error.message });
    throw error;
  }
  return data ?? [];
}

export async function listPromptVersions(agentId: string) {
  const { data, error } = await supabaseExternal
    .from('prompt_versions')
    .select('*')
    .eq('agent_id', agentId)
    .order('version', { ascending: false });
  if (error) {
    logger.error('Failed to list prompt versions', { agentId, error: error.message });
    throw error;
  }
  return data ?? [];
}

export async function createPromptVersion(params: {
  agentId: string;
  content: string;
  changeSummary: string;
  nextVersion: number;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { error } = await supabaseExternal.from('prompt_versions').insert({
    agent_id: params.agentId,
    user_id: user.id,
    content: params.content,
    change_summary: params.changeSummary || `Versão ${params.nextVersion}`,
    version: params.nextVersion,
    is_active: true,
  });
  if (error) {
    logger.error('Failed to create prompt version', { error: error.message });
    throw error;
  }

  // Deactivate previous versions
  const { error: deactivateErr } = await supabaseExternal
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('agent_id', params.agentId)
    .neq('version', params.nextVersion);
  if (deactivateErr) {
    logger.error('Failed to deactivate old versions', { error: deactivateErr.message });
  }
}

export async function updatePromptVersion(versionId: string, content: string) {
  const { error } = await supabaseExternal
    .from('prompt_versions')
    .update({ content })
    .eq('id', versionId);
  if (error) {
    logger.error('Failed to update prompt version', { versionId, error: error.message });
    throw error;
  }
}

export async function deletePromptVersion(versionId: string) {
  const { error } = await supabaseExternal
    .from('prompt_versions')
    .delete()
    .eq('id', versionId);
  if (error) {
    logger.error('Failed to delete prompt version', { versionId, error: error.message });
    throw error;
  }
}

export async function restorePromptVersion(agentId: string, versionId: string) {
  // Deactivate all
  await supabaseExternal.from('prompt_versions').update({ is_active: false }).eq('agent_id', agentId);
  // Activate selected
  const { error } = await supabaseExternal.from('prompt_versions').update({ is_active: true }).eq('id', versionId);
  if (error) {
    logger.error('Failed to restore prompt version', { versionId, error: error.message });
    throw error;
  }
}
