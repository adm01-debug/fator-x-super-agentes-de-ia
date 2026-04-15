/**
 * Nexus Agents Studio — Tools Service
 * CRUD for the tool_integrations table.
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { logger } from '@/lib/logger';

export interface ToolIntegration {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  type: string;
  is_enabled: boolean;
  created_at: string;
  [key: string]: unknown;
}

export async function listToolIntegrations(): Promise<ToolIntegration[]> {
  const { data, error } = await supabase
    .from('tool_integrations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    logger.error('Failed to list tool integrations', { error: error.message });
    throw error;
  }
  return (data ?? []) as ToolIntegration[];
}

export async function createToolIntegration(params: {
  workspaceId: string;
  name: string;
  description: string;
  type: string;
}): Promise<void> {
  const { error } = await supabaseExternal.from('tool_integrations').insert({
    workspace_id: params.workspaceId,
    name: params.name.trim(),
    description: params.description.trim(),
    type: params.type,
  });
  if (error) {
    logger.error('Failed to create tool integration', { name: params.name, error: error.message });
    throw error;
  }
}

export async function toggleToolIntegration(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('tool_integrations')
    .update({ is_enabled: enabled })
    .eq('id', id);
  if (error) {
    logger.error('Failed to toggle tool integration', { id, enabled, error: error.message });
    throw error;
  }
}

export async function deleteToolIntegration(id: string): Promise<void> {
  const { error } = await supabase
    .from('tool_integrations')
    .delete()
    .eq('id', id);
  if (error) {
    logger.error('Failed to delete tool integration', { id, error: error.message });
    throw error;
  }
}
