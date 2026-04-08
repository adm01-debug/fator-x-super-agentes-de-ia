/**
 * Nexus Agents Studio — DataHub Service
 * Cross-database queries, entity browser, MCP exposure.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export async function queryEntity(entityType: string, filters?: Record<string, unknown>, limit = 20) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/datahub-query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ entity: entityType, filters, limit }),
  });

  if (!resp.ok) {
    logger.error('DataHub query failed', { status: resp.status, entity: entityType });
    throw new Error(`DataHub query failed: ${resp.status}`);
  }
  return resp.json();
}

export async function getEntityDetail(entityType: string, entityId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/datahub-query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ entity: entityType, id: entityId, action: 'detail' }),
  });

  if (!resp.ok) {
    logger.error('Entity detail failed', { status: resp.status, entity: entityType, entityId });
    throw new Error(`Entity detail failed: ${resp.status}`);
  }
  return resp.json();
}

export async function getDatahubStats() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/datahub-query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action: 'stats' }),
  });

  if (!resp.ok) return { databases: 0, tables: 0, records: 0 };
  return resp.json();
}

export async function testDatahubConnections() {
  const { data, error } = await supabase.functions.invoke('datahub-query', {
    body: { action: 'test_connections' },
  });
  if (error) throw error;
  return data;
}

export async function listDatahubEntities() {
  const { data, error } = await supabase.functions.invoke('datahub-query', {
    body: { action: 'list_entities' },
  });
  if (error) throw error;
  return data;
}

export async function listDatahubTables() {
  const { data, error } = await supabase.functions.invoke('datahub-query', {
    body: { action: 'list_tables' },
  });
  if (error) throw error;
  return data;
}

// ============================================================================
// HEALTH METRICS (T09 — DataHub Health tab)
// ============================================================================

export interface DatahubProjectHealth {
  project: string;
  ref: string;
  reachable: boolean;
  latency_ms: number | null;
  table_count: number | null;
  total_rows: number | null;
  error?: string;
  last_checked: string;
}

export interface DatahubHealthReport {
  timestamp: string;
  projects: DatahubProjectHealth[];
  overall_status: 'healthy' | 'degraded' | 'critical';
  reachable_count: number;
  total_count: number;
}

const DATAHUB_PROJECTS: Array<{ name: string; ref: string }> = [
  { name: 'bancodadosclientes', ref: 'pgxfvjmuubtbowutlide' },
  { name: 'supabase-fuchsia-kite', ref: 'doufsxqlfjyuvxuezpln' },
  { name: 'backupgiftstore', ref: 'rhqfnvvjdwvnulxybmrk' },
  { name: 'gestao_time_promo', ref: 'hncgwjbzdajfdztqgefe' },
  { name: 'financeiro_promo', ref: 'xyykivpcdbfukaongpbw' },
];

/**
 * Pings each DataHub project via the datahub-query Edge Function and
 * collects per-project health metrics. Used by the new Health tab.
 */
// ============================================================================
// LIVE RLS POLICIES (next-frontier #5 — Permissions tab)
// ============================================================================

export interface RlsPolicy {
  table: string;
  name: string;
  cmd: string;
  roles: string[];
  using?: string;
  with_check?: string;
}

export interface RlsPolicyConnectionResult {
  ok: boolean;
  policies?: RlsPolicy[];
  error?: string;
  count?: number;
}

export interface RlsPolicyReport {
  timestamp: string;
  connections: Record<string, RlsPolicyConnectionResult>;
}

/**
 * Pulls live RLS policies from each external Supabase project via the
 * datahub-query Edge Function (action=list_rls_policies).
 *
 * Requires an `exec_sql` RPC with SECURITY DEFINER deployed on each
 * remote project that allows reading pg_policies. Connections without
 * the RPC return ok=false with a descriptive error — the UI handles
 * that gracefully.
 */
export async function getDatahubRlsPolicies(connection?: string): Promise<RlsPolicyReport> {
  const { data, error } = await supabase.functions.invoke('datahub-query', {
    body: { action: 'list_rls_policies', connection },
  });
  if (error) {
    logger.error('list_rls_policies failed', { error: error.message });
    throw error;
  }
  return data as RlsPolicyReport;
}

/**
 * Pings each DataHub project via the datahub-query Edge Function and
 * collects per-project health metrics. Used by the Health tab.
 */
export async function getDatahubHealth(): Promise<DatahubHealthReport> {
  const projects: DatahubProjectHealth[] = [];

  for (const proj of DATAHUB_PROJECTS) {
    const start = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('datahub-query', {
        body: { action: 'health_check', project_ref: proj.ref },
      });
      const latency = Date.now() - start;

      if (error) {
        projects.push({
          project: proj.name,
          ref: proj.ref,
          reachable: false,
          latency_ms: latency,
          table_count: null,
          total_rows: null,
          error: error.message,
          last_checked: new Date().toISOString(),
        });
        continue;
      }

      const result = data as Record<string, unknown>;
      projects.push({
        project: proj.name,
        ref: proj.ref,
        reachable: true,
        latency_ms: latency,
        table_count: typeof result?.table_count === 'number' ? result.table_count : null,
        total_rows: typeof result?.total_rows === 'number' ? result.total_rows : null,
        last_checked: new Date().toISOString(),
      });
    } catch (e) {
      projects.push({
        project: proj.name,
        ref: proj.ref,
        reachable: false,
        latency_ms: Date.now() - start,
        table_count: null,
        total_rows: null,
        error: e instanceof Error ? e.message : String(e),
        last_checked: new Date().toISOString(),
      });
    }
  }

  const reachableCount = projects.filter((p) => p.reachable).length;
  const totalCount = projects.length;
  const overallStatus: DatahubHealthReport['overall_status'] =
    reachableCount === totalCount
      ? 'healthy'
      : reachableCount >= totalCount / 2
        ? 'degraded'
        : 'critical';

  return {
    timestamp: new Date().toISOString(),
    projects,
    overall_status: overallStatus,
    reachable_count: reachableCount,
    total_count: totalCount,
  };
}
