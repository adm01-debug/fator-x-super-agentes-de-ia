/**
 * Nexus Agents Studio — Admin CRUD Service
 * Generic list/delete with hardcoded table whitelist for security.
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { logger } from '@/lib/logger';

export const ALLOWED_ADMIN_TABLES = [
  'agents',
  'agent_traces',
  'knowledge_bases',
  'prompt_versions',
  'evaluation_runs',
  'oracle_history',
] as const;

export type AdminTable = typeof ALLOWED_ADMIN_TABLES[number];

function assertAllowed(table: string): asserts table is AdminTable {
  if (!ALLOWED_ADMIN_TABLES.includes(table as AdminTable)) {
    const msg = `Table "${table}" is not in the admin whitelist`;
    logger.error('Admin operation denied', { table, reason: 'not_in_whitelist' });
    throw new Error(msg);
  }
}

export async function listAdminRows(table: string, limit = 200): Promise<Record<string, unknown>[]> {
  assertAllowed(table);
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error('Failed to list admin rows', { table, error: error.message });
    throw error;
  }
  return (data ?? []) as Record<string, unknown>[];
}

export async function deleteAdminRow(table: string, id: string): Promise<void> {
  assertAllowed(table);
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);
  if (error) {
    logger.error('Failed to delete admin row', { table, id, error: error.message });
    throw error;
  }
}
