/**
 * agentTracesService — leitura e agrupamento de traces por execução.
 * Lê de `agent_traces` (mock data já populada) e organiza por session_id.
 */
import { supabase } from '@/integrations/supabase/client';

export type TraceLevel = 'info' | 'warning' | 'error';

export interface AgentTraceRow {
  id: string;
  agent_id: string;
  session_id: string | null;
  level: TraceLevel;
  event: string;
  input: unknown;
  output: unknown;
  metadata: Record<string, unknown> | null;
  latency_ms: number | null;
  tokens_used: number | null;
  cost_usd: number | null;
  created_at: string;
}

export interface ExecutionGroup {
  session_id: string;
  agent_id: string;
  started_at: string;
  ended_at: string;
  total_ms: number;
  total_tokens: number;
  total_cost: number;
  counts: { info: number; warning: number; error: number };
  traces: AgentTraceRow[];
}

export interface ListTracesParams {
  agentId?: string;
  level?: TraceLevel | 'all';
  event?: string | 'all';
  search?: string;
  sinceHours?: number;
  /** Absolute time window — overrides `sinceHours` when both `from` and `to` are provided. */
  from?: string;
  to?: string;
  limit?: number;
}

export async function listAgentTraces(params: ListTracesParams = {}): Promise<AgentTraceRow[]> {
  const { agentId, level, event, search, sinceHours = 24, from, to, limit = 500 } = params;
  let q = supabase
    .from('agent_traces')
    .select('id, agent_id, session_id, level, event, input, output, metadata, latency_ms, tokens_used, cost_usd, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (agentId) q = q.eq('agent_id', agentId);
  if (level && level !== 'all') q = q.eq('level', level);
  if (event && event !== 'all') q = q.eq('event', event);

  // Absolute window takes priority over relative `sinceHours`.
  if (from && to) {
    q = q.gte('created_at', from).lte('created_at', to);
  } else if (sinceHours > 0) {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
    q = q.gte('created_at', since);
  }

  const { data, error } = await q;
  if (error) throw error;

  let rows = (data ?? []) as unknown as AgentTraceRow[];
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter((r) =>
      r.event.toLowerCase().includes(s) ||
      (r.session_id ?? '').toLowerCase().includes(s) ||
      JSON.stringify(r.input ?? '').toLowerCase().includes(s) ||
      JSON.stringify(r.output ?? '').toLowerCase().includes(s),
    );
  }
  return rows;
}

/**
 * Agrupa traces por session_id. Quando session_id é nulo, agrupa em janelas
 * de 30 segundos por agent_id (fallback synthetic).
 */
export function groupBySession(traces: AgentTraceRow[]): ExecutionGroup[] {
  const groups = new Map<string, AgentTraceRow[]>();
  for (const t of traces) {
    let key = t.session_id;
    if (!key) {
      const bucket = Math.floor(new Date(t.created_at).getTime() / 30000);
      key = `auto-${t.agent_id}-${bucket}`;
    }
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  const out: ExecutionGroup[] = [];
  for (const [session_id, list] of groups) {
    const sorted = [...list].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    const counts = { info: 0, warning: 0, error: 0 };
    let total_tokens = 0;
    let total_cost = 0;
    let total_ms = 0;
    for (const t of sorted) {
      counts[t.level]++;
      total_tokens += t.tokens_used ?? 0;
      total_cost += Number(t.cost_usd ?? 0);
      total_ms += t.latency_ms ?? 0;
    }
    out.push({
      session_id,
      agent_id: sorted[0].agent_id,
      started_at: sorted[0].created_at,
      ended_at: sorted[sorted.length - 1].created_at,
      total_ms,
      total_tokens,
      total_cost,
      counts,
      traces: sorted,
    });
  }
  return out.sort((a, b) => +new Date(b.started_at) - +new Date(a.started_at));
}

export async function listAvailableEvents(agentId?: string): Promise<string[]> {
  let q = supabase.from('agent_traces').select('event').limit(1000);
  if (agentId) q = q.eq('agent_id', agentId);
  const { data, error } = await q;
  if (error) return [];
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ event: string }>) set.add(r.event);
  return Array.from(set).sort();
}
