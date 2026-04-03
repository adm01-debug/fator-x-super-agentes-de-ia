/**
 * Supabase Data Layer — CRUD for ALL 37 backend tables
 * Connects the 31 previously disconnected tables to the frontend.
 * All operations are async, non-blocking, with silent fallback on error.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ═══ GENERIC CRUD HELPERS ═══

async function selectFrom(table: string, filters?: Record<string, unknown>, limit = 100): Promise<unknown[]> {
  try {
    let query = supabase.from(table).select('*').limit(limit);
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) query = query.eq(key, value);
      });
    }
    const { data, error } = await query;
    if (error) { logger.warn(`Select ${table}: ${error.message}`, 'supabaseData'); return []; }
    return data ?? [];
  } catch { return []; }
}

async function insertInto(table: string, row: Record<string, unknown>): Promise<{ data: unknown; error?: string }> {
  try {
    const { data, error } = await supabase.from(table).insert(row).select().single();
    if (error) { logger.warn(`Insert ${table}: ${error.message}`, 'supabaseData'); return { data: null, error: error.message }; }
    return { data };
  } catch (err) { return { data: null, error: err instanceof Error ? err.message : 'Unknown' }; }
}

async function updateIn(table: string, id: string, updates: Record<string, unknown>, idColumn = 'id'): Promise<{ error?: string }> {
  try {
    const { error } = await supabase.from(table).update(updates).eq(idColumn, id);
    if (error) { logger.warn(`Update ${table}: ${error.message}`, 'supabaseData'); return { error: error.message }; }
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : 'Unknown' }; }
}

async function deleteFrom(table: string, id: string, idColumn = 'id'): Promise<{ error?: string }> {
  try {
    const { error } = await supabase.from(table).delete().eq(idColumn, id);
    if (error) { logger.warn(`Delete ${table}: ${error.message}`, 'supabaseData'); return { error: error.message }; }
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : 'Unknown' }; }
}

async function upsertInto(table: string, row: Record<string, unknown>, onConflict?: string): Promise<{ error?: string }> {
  try {
    const opts = onConflict ? { onConflict } : {};
    const { error } = await supabase.from(table).upsert(row, opts);
    if (error) { logger.warn(`Upsert ${table}: ${error.message}`, 'supabaseData'); return { error: error.message }; }
    return {};
  } catch (err) { return { error: err instanceof Error ? err.message : 'Unknown' }; }
}

// ═══ AGENT TABLES ═══

export const agentTemplates = {
  list: () => selectFrom('agent_templates', { is_public: true }),
  getById: (id: string) => selectFrom('agent_templates', { id }, 1).then(r => r[0] ?? null),
  create: (row: Record<string, unknown>) => insertInto('agent_templates', row),
  update: (id: string, updates: Record<string, unknown>) => updateIn('agent_templates', id, updates),
  delete: (id: string) => deleteFrom('agent_templates', id),
  incrementUsage: (id: string) => supabase.rpc('increment_template_usage', { template_id: id }).then(() => {}).catch(() => {}),
};

export const agentTestResults = {
  list: (agentId: string) => selectFrom('agent_test_results', { agent_id: agentId }),
  create: (row: Record<string, unknown>) => insertInto('agent_test_results', row),
};

export const agentPermissions = {
  list: (agentId: string) => selectFrom('agent_permissions', { agent_id: agentId }),
  set: (row: Record<string, unknown>) => upsertInto('agent_permissions', row, 'agent_id,user_id'),
};

export const agentFeedback = {
  list: (agentId: string) => selectFrom('agent_feedback', { agent_id: agentId }),
  create: (row: Record<string, unknown>) => insertInto('agent_feedback', row),
};

export const agentExecutionTraces = {
  list: (agentId: string, limit = 50) => selectFrom('agent_execution_traces', { agent_id: agentId }, limit),
  create: (row: Record<string, unknown>) => insertInto('agent_execution_traces', row),
};

// ═══ WORKSPACE TABLES ═══

export const workspaces = {
  list: () => selectFrom('workspaces'),
  getById: (id: string) => selectFrom('workspaces', { id }, 1).then(r => r[0] ?? null),
  create: (row: Record<string, unknown>) => insertInto('workspaces', row),
  update: (id: string, updates: Record<string, unknown>) => updateIn('workspaces', id, updates),
};

export const workspaceMembers = {
  list: (workspaceId: string) => selectFrom('workspace_members', { workspace_id: workspaceId }),
  add: (row: Record<string, unknown>) => insertInto('workspace_members', row),
  updateRole: (id: string, role: string) => updateIn('workspace_members', id, { role }),
  remove: (id: string) => deleteFrom('workspace_members', id),
};

export const workspaceSecrets = {
  list: (workspaceId: string) => selectFrom('workspace_secrets', { workspace_id: workspaceId }),
  set: (row: Record<string, unknown>) => upsertInto('workspace_secrets', row, 'workspace_id,key_name'),
  delete: (id: string) => deleteFrom('workspace_secrets', id),
};

// ═══ DATAHUB TABLES ═══

export const datahubConnections = {
  list: () => selectFrom('datahub_connections'),
  create: (row: Record<string, unknown>) => insertInto('datahub_connections', row),
  update: (id: string, updates: Record<string, unknown>) => updateIn('datahub_connections', id, updates),
  delete: (id: string) => deleteFrom('datahub_connections', id),
};

export const datahubTableSchemas = {
  list: (connectionId: string) => selectFrom('datahub_table_schemas', { connection_id: connectionId }),
};

export const datahubEntityMappings = {
  list: () => selectFrom('datahub_entity_mappings'),
  create: (row: Record<string, unknown>) => insertInto('datahub_entity_mappings', row),
  update: (id: string, updates: Record<string, unknown>) => updateIn('datahub_entity_mappings', id, updates),
};

export const datahubSavedQueries = {
  list: () => selectFrom('datahub_saved_queries'),
  create: (row: Record<string, unknown>) => insertInto('datahub_saved_queries', row),
  delete: (id: string) => deleteFrom('datahub_saved_queries', id),
};

export const datahubQueryLog = {
  list: (limit = 50) => selectFrom('datahub_query_log', undefined, limit),
  log: (row: Record<string, unknown>) => insertInto('datahub_query_log', row),
};

export const datahubSyncLog = {
  list: (limit = 50) => selectFrom('datahub_sync_log', undefined, limit),
  log: (row: Record<string, unknown>) => insertInto('datahub_sync_log', row),
};

export const datahubAccessPolicies = {
  list: () => selectFrom('datahub_access_policies'),
  create: (row: Record<string, unknown>) => insertInto('datahub_access_policies', row),
  update: (id: string, updates: Record<string, unknown>) => updateIn('datahub_access_policies', id, updates),
};

export const datahubIdentityMap = {
  list: () => selectFrom('datahub_identity_map'),
  create: (row: Record<string, unknown>) => insertInto('datahub_identity_map', row),
};

export const datahubQualityIssues = {
  list: () => selectFrom('datahub_quality_issues'),
  create: (row: Record<string, unknown>) => insertInto('datahub_quality_issues', row),
  resolve: (id: string) => updateIn('datahub_quality_issues', id, { status: 'resolved' }),
};

// ═══ BRAIN / SUPER CÉREBRO TABLES ═══

export const brainCollections = {
  list: () => selectFrom('brain_collections'),
  create: (row: Record<string, unknown>) => insertInto('brain_collections', row),
  update: (id: string, updates: Record<string, unknown>) => updateIn('brain_collections', id, updates),
  delete: (id: string) => deleteFrom('brain_collections', id),
};

export const brainEntities = {
  list: (limit = 100) => selectFrom('brain_entities', undefined, limit),
  create: (row: Record<string, unknown>) => insertInto('brain_entities', row),
  update: (id: string, updates: Record<string, unknown>) => updateIn('brain_entities', id, updates),
};

export const brainRelationships = {
  list: (entityId?: string) => entityId ? selectFrom('brain_relationships', { source_entity_id: entityId }) : selectFrom('brain_relationships'),
  create: (row: Record<string, unknown>) => insertInto('brain_relationships', row),
};

export const brainDecayAlerts = {
  list: () => selectFrom('brain_decay_alerts'),
  resolve: (id: string) => updateIn('brain_decay_alerts', id, { resolved: true }),
};

export const brainSandboxTests = {
  list: () => selectFrom('brain_sandbox_tests'),
  create: (row: Record<string, unknown>) => insertInto('brain_sandbox_tests', row),
};

// ═══ ORACLE TABLES ═══

export const oracleConfigs = {
  list: () => selectFrom('oracle_configs'),
  getActive: () => selectFrom('oracle_configs', { is_active: true }, 1).then(r => r[0] ?? null),
  create: (row: Record<string, unknown>) => insertInto('oracle_configs', row),
  update: (id: string, updates: Record<string, unknown>) => updateIn('oracle_configs', id, updates),
};

export const oraclePresets = {
  list: () => selectFrom('oracle_presets'),
  create: (row: Record<string, unknown>) => insertInto('oracle_presets', row),
};

export const oracleQueries = {
  list: (limit = 50) => selectFrom('oracle_queries', undefined, limit),
  create: (row: Record<string, unknown>) => insertInto('oracle_queries', row),
};

export const oracleMemberResponses = {
  list: (queryId: string) => selectFrom('oracle_member_responses', { query_id: queryId }),
  create: (row: Record<string, unknown>) => insertInto('oracle_member_responses', row),
};

// ═══ KNOWLEDGE & EVALUATION TABLES ═══

export const knowledgeBases = {
  list: () => selectFrom('knowledge_bases'),
  create: (row: Record<string, unknown>) => insertInto('knowledge_bases', row),
  update: (id: string, updates: Record<string, unknown>) => updateIn('knowledge_bases', id, updates),
  delete: (id: string) => deleteFrom('knowledge_bases', id),
};

export const evaluationRuns = {
  list: (agentId?: string) => agentId ? selectFrom('evaluation_runs', { agent_id: agentId }) : selectFrom('evaluation_runs'),
  create: (row: Record<string, unknown>) => insertInto('evaluation_runs', row),
  update: (id: string, updates: Record<string, unknown>) => updateIn('evaluation_runs', id, updates),
};

// ═══ DATABASE MANAGER TABLES ═══

export const connectedDatabases = {
  list: () => selectFrom('connected_databases'),
  create: (row: Record<string, unknown>) => insertInto('connected_databases', row),
  update: (id: string, updates: Record<string, unknown>) => updateIn('connected_databases', id, updates),
  delete: (id: string) => deleteFrom('connected_databases', id),
};

export const dbDiscoveredTables = {
  list: (dbId: string) => selectFrom('db_discovered_tables', { database_id: dbId }),
};

export const dbDiscoveredFunctions = {
  list: (dbId: string) => selectFrom('db_discovered_functions', { database_id: dbId }),
};

// ═══ TABLE LIST FOR REFERENCE ═══

export const ALL_TABLES = [
  'agents', 'prompt_versions', 'agent_traces', 'agent_usage', 'agent_templates',
  'agent_test_results', 'agent_permissions', 'agent_feedback', 'agent_execution_traces',
  'workspaces', 'workspace_members', 'workspace_secrets',
  'datahub_connections', 'datahub_table_schemas', 'datahub_entity_mappings',
  'datahub_saved_queries', 'datahub_query_log', 'datahub_sync_log',
  'datahub_access_policies', 'datahub_identity_map', 'datahub_quality_issues',
  'brain_collections', 'brain_facts', 'brain_entities', 'brain_relationships',
  'brain_decay_alerts', 'brain_sandbox_tests',
  'oracle_configs', 'oracle_presets', 'oracle_queries', 'oracle_member_responses',
  'knowledge_bases', 'evaluation_runs',
  'connected_databases', 'db_discovered_tables', 'db_discovered_functions', 'db_operation_log',
] as const;

/** Check connectivity to Supabase by querying a simple table. */
export async function healthCheck(): Promise<{ connected: boolean; tablesAccessible: number }> {
  let accessible = 0;
  for (const table of ['agents', 'brain_facts', 'agent_traces']) {
    try {
      const { error } = await supabase.from(table).select('id', { count: 'exact', head: true });
      if (!error) accessible++;
    } catch { /* skip */ }
  }
  return { connected: accessible > 0, tablesAccessible: accessible };
}
