/**
 * Nexus Agents Studio — Prompt Version Service
 * Abstracts all prompt versioning CRUD operations
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

export async function getAgentBasic(agentId: string) {
  const { data, error } = await supabase
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

export async function listPromptVersions(agentId: string) {
  const { data, error } = await supabase
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

  const { error } = await supabase.from('prompt_versions').insert({
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
  const { error: deactivateErr } = await supabase
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('agent_id', params.agentId)
    .neq('version', params.nextVersion);
  if (deactivateErr) {
    logger.error('Failed to deactivate old versions', { error: deactivateErr.message });
  }
}

export async function updatePromptVersion(versionId: string, content: string) {
  const { error } = await supabase
    .from('prompt_versions')
    .update({ content })
    .eq('id', versionId);
  if (error) {
    logger.error('Failed to update prompt version', { versionId, error: error.message });
    throw error;
  }
}

export async function deletePromptVersion(versionId: string) {
  const { error } = await supabase
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
  await supabase.from('prompt_versions').update({ is_active: false }).eq('agent_id', agentId);
  // Activate selected
  const { error } = await supabase.from('prompt_versions').update({ is_active: true }).eq('id', versionId);
  if (error) {
    logger.error('Failed to restore prompt version', { versionId, error: error.message });
    throw error;
  }
}
