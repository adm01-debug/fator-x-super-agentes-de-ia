/**
 * Nexus Agents Studio — Data Storage Service
 * Aggregates real-time row counts across the main domain tables.
 * Used by DataStoragePage to show storage utilization at a glance.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface DataStorageStats {
  agents: number;
  knowledgeBases: number;
  traces: number;
  evaluations: number;
  prompts: number;
  total: number;
}

async function countTable(tableName: string): Promise<number> {
  const { count, error } = await (supabase
    .from(tableName as any) as any)
    .select('id', { count: 'exact', head: true });
  if (error) {
    logger.error(`Failed to count ${tableName}`, { error: error.message });
    return 0;
  }
  return count ?? 0;
}

/**
 * Returns row counts for the 5 main domain tables in parallel.
 * Errors per-table are swallowed (return 0) so a single missing table
 * does not blank the entire dashboard.
 */
export async function getDataStorageStats(): Promise<DataStorageStats> {
  const [agents, knowledgeBases, traces, evaluations, prompts] = await Promise.all([
    countTable('agents'),
    countTable('knowledge_bases'),
    countTable('agent_traces'),
    countTable('evaluation_runs'),
    countTable('prompt_versions'),
  ]);
  return {
    agents,
    knowledgeBases,
    traces,
    evaluations,
    prompts,
    total: agents + knowledgeBases + traces + evaluations + prompts,
  };
}
