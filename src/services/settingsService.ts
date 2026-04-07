/**
 * Nexus Agents Studio — Settings Service
 * Workspace settings, API keys (workspace_secrets), and environments.
 *
 * Encapsulates all CRUD for the SettingsPage so pages do not call
 * supabase directly. All functions log errors via logger.ts.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface MaskedSecret {
  id: string;
  key_name: string;
  masked_value: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface Environment {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  [key: string]: unknown;
}

// ═══ API Keys / Workspace Secrets ═══

/**
 * Returns workspace secrets with masked values (RPC handles masking).
 */
export async function listMaskedSecrets(workspaceId: string): Promise<MaskedSecret[]> {
  const { data, error } = await supabase.rpc('get_masked_secrets', { p_workspace_id: workspaceId });
  if (error) {
    logger.error('Failed to list masked secrets', { workspaceId, error: error.message });
    throw error;
  }
  return (data ?? []) as MaskedSecret[];
}

/**
 * Inserts a new API key in workspace_secrets.
 * Requires non-empty name and value (caller validates).
 */
export async function createWorkspaceSecret(params: {
  workspaceId: string;
  keyName: string;
  keyValue: string;
}): Promise<void> {
  const { error } = await supabase.from('workspace_secrets').insert({
    workspace_id: params.workspaceId,
    key_name: params.keyName,
    key_value: params.keyValue,
  });
  if (error) {
    logger.error('Failed to create workspace secret', { keyName: params.keyName, error: error.message });
    throw error;
  }
}

/**
 * Hard-deletes a workspace secret by id.
 */
export async function deleteWorkspaceSecret(id: string): Promise<void> {
  const { error } = await supabase.from('workspace_secrets').delete().eq('id', id);
  if (error) {
    logger.error('Failed to delete workspace secret', { id, error: error.message });
    throw error;
  }
}

/**
 * Rotates a workspace secret's encrypted value.
 */
export async function rotateWorkspaceSecret(id: string, newValue: string): Promise<void> {
  if (!newValue.trim()) throw new Error('Novo valor é obrigatório');
  const { error } = await supabase
    .from('workspace_secrets')
    .update({ encrypted_value: new TextEncoder().encode(newValue.trim()) } as Record<string, unknown>)
    .eq('id', id);
  if (error) {
    logger.error('Failed to rotate workspace secret', { id, error: error.message });
    throw error;
  }
}

// ═══ Workspace ═══

/**
 * Fetches a single workspace by id.
 */
export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .maybeSingle();
  if (error) {
    logger.error('Failed to fetch workspace', { workspaceId, error: error.message });
    throw error;
  }
  return data as Workspace | null;
}

// ═══ Environments ═══

/**
 * Lists all environments (dev/staging/prod) for a workspace.
 */
export async function listEnvironments(workspaceId: string): Promise<Environment[]> {
  const { data, error } = await supabase
    .from('environments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at');
  if (error) {
    logger.error('Failed to list environments', { workspaceId, error: error.message });
    throw error;
  }
  return (data ?? []) as Environment[];
}

/**
 * Creates a new environment (e.g. development, staging, production).
 */
export async function createEnvironment(workspaceId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('environments')
    .insert({ workspace_id: workspaceId, name: name.trim() });
  if (error) {
    logger.error('Failed to create environment', { name, error: error.message });
    throw error;
  }
}

/**
 * Deletes an environment by id.
 */
export async function deleteEnvironment(id: string): Promise<void> {
  const { error } = await supabase
    .from('environments')
    .delete()
    .eq('id', id);
  if (error) {
    logger.error('Failed to delete environment', { id, error: error.message });
    throw error;
  }
}
